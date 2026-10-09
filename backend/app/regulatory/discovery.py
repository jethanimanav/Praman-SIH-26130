from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.regulatory.schema import (
    DataStatus,
    EvaluationOutcome,
    EvaluationResult,
    RegulatoryRule,
    RequirementCategory,
    SourceMetadata,
)
from app.regulatory.engine import EvaluationContext, RuleEngine
from app.ai.service import AIService


class DiscoveryItem(BaseModel):
    requirement_id: str
    requirement_name: str
    category: RequirementCategory
    reason: str
    rule_id: str
    data_status: DataStatus
    source_metadata: Optional[SourceMetadata] = None
    department: Optional[str] = None
    estimated_timeline_days: Optional[int] = None
    documents: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    prerequisites: List[str] = Field(
        default_factory=list,
        description="Prerequisite requirement IDs",
    )
    
    # M3 Explainability & Guidance additions
    relevant_profile_fields: Dict[str, Any] = Field(
        default_factory=dict,
        description="Profile key-value pairs that determined or influenced this outcome",
    )
    missing_information: List[str] = Field(
        default_factory=list,
        description="Fields required by rule condition that were missing or unspecified in the profile",
    )
    next_action: str = Field(
        ...,
        description="Deterministic guidance for what the applicant should safely do next",
    )


class RegulatoryDiscoveryResponse(BaseModel):
    business_id: int
    business_name: str
    total_requirements: int
    summary_counts: Dict[str, int]
    requirements: List[DiscoveryItem]
    missing_critical_fields: List[str] = Field(
        default_factory=list,
        description="Aggregate list of missing fields across all Verification Required items",
    )


class RegulatoryDiscoveryService:
    """
    Transforms confirmed regulatory profiles into normalized, explainable discovery results
    using the deterministic M1 RuleEngine.
    """

    @classmethod
    def generate_next_action(
        cls,
        category: RequirementCategory,
        missing_fields: List[str],
    ) -> str:
        """Generates deterministic safe next-action guidance based on category."""
        if category == RequirementCategory.REQUIRED:
            return "Review the identified requirement and proceed through the configured workflow."
        elif category == RequirementCategory.VERIFICATION_REQUIRED:
            if missing_fields:
                clean_missing = ", ".join(f.replace(".", " ").replace("_", " ").title() for f in missing_fields)
                return f"Provide or verify the missing information ({clean_missing}) before applicability can be determined."
            return "Provide or verify the missing information before applicability can be determined."
        elif category == RequirementCategory.CONDITIONAL:
            return "Review the condition and provide the required information if applicable."
        elif category == RequirementCategory.NOT_APPLICABLE:
            return "No action required based on the current configured rules."
        return "Review requirement details."

    @classmethod
    def discover_requirements(
        cls,
        business_id: int,
        business_name: str,
        confirmed_profile: Dict[str, Any],
        rules: List[RegulatoryRule],
    ) -> RegulatoryDiscoveryResponse:
        """
        Evaluates confirmed profile against M1 rules and enriches results with explainability:
        - Exact profile fields referenced by the rule condition and their current values
        - Missing/unspecified fields that caused UNKNOWN outcomes
        - Safe next-action guidance
        """
        engine = RuleEngine(rules)
        eval_context = EvaluationContext(confirmed_profile)

        items: List[DiscoveryItem] = []
        summary_counts: Dict[str, int] = {
            RequirementCategory.REQUIRED.value: 0,
            RequirementCategory.CONDITIONAL.value: 0,
            RequirementCategory.NOT_APPLICABLE.value: 0,
            RequirementCategory.VERIFICATION_REQUIRED.value: 0,
        }
        all_missing_fields: set[str] = set()

        for rule in rules:
            eval_result: EvaluationResult = engine.evaluate_rule(rule, confirmed_profile)

            # Discover all fields evaluated by this rule condition
            rule_fields = AIService.find_fields_in_condition(rule.condition)

            relevant_fields: Dict[str, Any] = {}
            missing_fields: List[str] = []

            for field_path in sorted(rule_fields):
                exists, val = eval_context.get_field_value(field_path)
                if exists and val is not None and val != "" and val != []:
                    relevant_fields[field_path] = val
                else:
                    missing_fields.append(field_path)

            if eval_result.category == RequirementCategory.VERIFICATION_REQUIRED:
                all_missing_fields.update(missing_fields)

            next_action = cls.generate_next_action(eval_result.category, missing_fields)

            item = DiscoveryItem(
                requirement_id=eval_result.requirement_id,
                requirement_name=eval_result.requirement_name,
                category=eval_result.category,
                reason=eval_result.reason,
                rule_id=eval_result.rule_id,
                data_status=eval_result.data_status,
                source_metadata=eval_result.source_metadata,
                department=eval_result.department,
                estimated_timeline_days=eval_result.estimated_timeline_days,
                documents=eval_result.documents,
                tags=eval_result.tags,
                prerequisites=eval_result.prerequisites,
                relevant_profile_fields=relevant_fields,
                missing_information=missing_fields if eval_result.category == RequirementCategory.VERIFICATION_REQUIRED else [],
                next_action=next_action,
            )
            items.append(item)
            summary_counts[eval_result.category.value] = summary_counts.get(eval_result.category.value, 0) + 1

        return RegulatoryDiscoveryResponse(
            business_id=business_id,
            business_name=business_name,
            total_requirements=len(items),
            summary_counts=summary_counts,
            requirements=items,
            missing_critical_fields=sorted(all_missing_fields),
        )

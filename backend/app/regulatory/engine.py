from typing import Any, Dict, List, Optional
from app.regulatory.schema import (
    Condition,
    EvaluationOutcome,
    EvaluationResult,
    Operator,
    RegulatoryRule,
    RequirementCategory,
)


class EvaluationContext:
    """Encapsulates business profile evaluation data and handles nested field lookups."""

    def __init__(self, profile: Dict[str, Any]):
        self.profile = profile or {}

    def get_field_value(self, field_path: str) -> tuple[bool, Any]:
        """
        Retrieves a field value from profile using dot notation (e.g. 'emissions.air').
        Returns (exists: bool, value: Any).
        If field exists but is explicitly None, returns (True, None).
        If path is not found, returns (False, None).
        """
        parts = field_path.split(".")
        current = self.profile
        for part in parts:
            if not isinstance(current, dict):
                return False, None
            if part not in current:
                return False, None
            current = current[part]
        return True, current


class RuleEngine:
    """
    Deterministic Regulatory Rule Engine.
    Evaluates business profiles against rules using three-valued logic (True / False / Unknown).
    """

    def __init__(self, rules: Optional[List[RegulatoryRule]] = None):
        self.rules: List[RegulatoryRule] = rules or []

    def evaluate_condition(self, condition: Condition, context: EvaluationContext) -> EvaluationOutcome:
        """Evaluates a condition (atomic or composite all/any/not) against context."""
        # 1. Composite 'all' (AND logic)
        if condition.all is not None:
            has_unknown = False
            for sub in condition.all:
                res = self.evaluate_condition(sub, context)
                if res == EvaluationOutcome.FALSE:
                    # Short-circuit: false and unknown -> false
                    return EvaluationOutcome.FALSE
                if res == EvaluationOutcome.UNKNOWN:
                    has_unknown = True
            return EvaluationOutcome.UNKNOWN if has_unknown else EvaluationOutcome.TRUE

        # 2. Composite 'any' (OR logic)
        if condition.any is not None:
            has_unknown = False
            for sub in condition.any:
                res = self.evaluate_condition(sub, context)
                if res == EvaluationOutcome.TRUE:
                    # Short-circuit: true or unknown -> true
                    return EvaluationOutcome.TRUE
                if res == EvaluationOutcome.UNKNOWN:
                    has_unknown = True
            return EvaluationOutcome.UNKNOWN if has_unknown else EvaluationOutcome.FALSE

        # 3. Composite 'not'
        if condition.not_ is not None:
            res = self.evaluate_condition(condition.not_, context)
            if res == EvaluationOutcome.TRUE:
                return EvaluationOutcome.FALSE
            elif res == EvaluationOutcome.FALSE:
                return EvaluationOutcome.TRUE
            else:
                return EvaluationOutcome.UNKNOWN

        # 4. Atomic condition
        return self._evaluate_atomic(condition.field, condition.operator, condition.value, context)

    def _evaluate_atomic(
        self,
        field: str,
        operator: Operator,
        target_val: Any,
        context: EvaluationContext,
    ) -> EvaluationOutcome:
        exists, actual_val = context.get_field_value(field)

        # Operator: exists
        if operator == Operator.EXISTS:
            expected_bool = bool(target_val) if target_val is not None else True
            # Field exists and is not None
            field_is_present = exists and actual_val is not None
            return EvaluationOutcome.TRUE if (field_is_present == expected_bool) else EvaluationOutcome.FALSE

        # If field is absent from profile or explicitly None, it is UNKNOWN
        if not exists or actual_val is None:
            return EvaluationOutcome.UNKNOWN

        # Three-valued logic & operator evaluations:
        if operator == Operator.EQ:
            return EvaluationOutcome.TRUE if actual_val == target_val else EvaluationOutcome.FALSE

        elif operator == Operator.NE:
            return EvaluationOutcome.TRUE if actual_val != target_val else EvaluationOutcome.FALSE

        elif operator == Operator.IN:
            # If actual_val is a list/collection, check if any element of actual_val is in target_val,
            # or if target_val (scalar or list) contains matching items.
            if isinstance(actual_val, (list, tuple, set)):
                if isinstance(target_val, (list, tuple, set)):
                    return EvaluationOutcome.TRUE if any(x in target_val for x in actual_val) else EvaluationOutcome.FALSE
                return EvaluationOutcome.TRUE if target_val in actual_val else EvaluationOutcome.FALSE
            if not isinstance(target_val, (list, tuple, set)):
                return EvaluationOutcome.FALSE
            return EvaluationOutcome.TRUE if actual_val in target_val else EvaluationOutcome.FALSE

        elif operator == Operator.NOT_IN:
            if isinstance(actual_val, (list, tuple, set)):
                if isinstance(target_val, (list, tuple, set)):
                    return EvaluationOutcome.TRUE if not any(x in target_val for x in actual_val) else EvaluationOutcome.FALSE
                return EvaluationOutcome.TRUE if target_val not in actual_val else EvaluationOutcome.FALSE
            if not isinstance(target_val, (list, tuple, set)):
                return EvaluationOutcome.FALSE
            return EvaluationOutcome.TRUE if actual_val not in target_val else EvaluationOutcome.FALSE

        # Numeric/ordered comparisons
        try:
            if operator == Operator.GT:
                return EvaluationOutcome.TRUE if actual_val > target_val else EvaluationOutcome.FALSE
            elif operator == Operator.GTE:
                return EvaluationOutcome.TRUE if actual_val >= target_val else EvaluationOutcome.FALSE
            elif operator == Operator.LT:
                return EvaluationOutcome.TRUE if actual_val < target_val else EvaluationOutcome.FALSE
            elif operator == Operator.LTE:
                return EvaluationOutcome.TRUE if actual_val <= target_val else EvaluationOutcome.FALSE
        except TypeError:
            # Type mismatch between actual_val and target_val during comparison
            return EvaluationOutcome.FALSE

        return EvaluationOutcome.UNKNOWN

    def evaluate_rule(self, rule: RegulatoryRule, profile: Dict[str, Any]) -> EvaluationResult:
        context = EvaluationContext(profile)
        outcome = self.evaluate_condition(rule.condition, context)

        if outcome == EvaluationOutcome.TRUE:
            category = rule.category_if_matched
            reason = rule.explanation_matched
        elif outcome == EvaluationOutcome.FALSE:
            category = rule.category_if_not_matched
            reason = rule.explanation_not_matched
        else:  # UNKNOWN
            category = RequirementCategory.VERIFICATION_REQUIRED
            reason = rule.explanation_unknown

        return EvaluationResult(
            requirement_id=rule.requirement_id,
            requirement_name=rule.requirement_name,
            category=category,
            reason=reason,
            rule_id=rule.id,
            data_status=rule.data_status,
            source_metadata=rule.source_metadata,
            department=rule.department,
            estimated_timeline_days=rule.estimated_timeline_days,
            documents=rule.documents,
            tags=rule.tags,
            prerequisites=rule.prerequisites,
        )

    def evaluate_all(self, profile: Dict[str, Any]) -> List[EvaluationResult]:
        """Evaluates all configured rules against the business profile."""
        results: List[EvaluationResult] = []
        for rule in self.rules:
            res = self.evaluate_rule(rule, profile)
            results.append(res)
        return results

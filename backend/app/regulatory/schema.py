from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, model_validator


class DataStatus(str, Enum):
    VERIFIED = "VERIFIED"
    DEMO = "DEMO"
    MOCK = "MOCK"
    VERIFICATION_REQUIRED = "VERIFICATION_REQUIRED"
    CONFIGURATION_REQUIRED = "CONFIGURATION_REQUIRED"


class RequirementCategory(str, Enum):
    REQUIRED = "Required"
    CONDITIONAL = "Conditional"
    NOT_APPLICABLE = "Not Applicable"
    VERIFICATION_REQUIRED = "Verification Required"


class EvaluationOutcome(str, Enum):
    TRUE = "TRUE"
    FALSE = "FALSE"
    UNKNOWN = "UNKNOWN"


class Operator(str, Enum):
    EQ = "eq"
    NE = "ne"
    IN = "in"
    NOT_IN = "not_in"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    EXISTS = "exists"


class AtomicCondition(BaseModel):
    field: str
    operator: Operator
    value: Optional[Any] = None

    model_config = {"extra": "forbid"}


class Condition(BaseModel):
    # Support atomic condition directly or boolean composition: all, any, not_ (or not)
    field: Optional[str] = None
    operator: Optional[Operator] = None
    value: Optional[Any] = None

    all: Optional[List["Condition"]] = None
    any: Optional[List["Condition"]] = None
    not_: Optional["Condition"] = Field(default=None, alias="not")

    model_config = {"populate_by_name": True, "extra": "forbid"}

    @model_validator(mode="after")
    def validate_condition_structure(self) -> "Condition":
        modes = [
            self.field is not None or self.operator is not None,
            self.all is not None,
            self.any is not None,
            self.not_ is not None,
        ]
        active_modes = sum(1 for m in modes if m)
        if active_modes == 0:
            raise ValueError("Condition must specify an atomic condition (field + operator) or a combinator (all, any, not)")
        if active_modes > 1:
            raise ValueError("Condition must not combine atomic operators with combinators (all, any, not) in the same node")

        if self.field is not None or self.operator is not None:
            if not self.field or not self.operator:
                raise ValueError("Atomic condition requires both 'field' and 'operator'")

        return self


Condition.model_rebuild()


class SourceMetadata(BaseModel):
    source_url: Optional[str] = None
    source_title: Optional[str] = None
    source_date: Optional[str] = None
    reviewed_by: Optional[str] = None

    model_config = {"extra": "forbid"}


class RegulatoryRule(BaseModel):
    id: str
    requirement_id: str
    requirement_name: str
    description: Optional[str] = None
    data_status: DataStatus = DataStatus.DEMO
    source_metadata: Optional[SourceMetadata] = None

    # Condition determining applicability
    condition: Condition

    # What category this results in if condition evaluates to True
    # Defaults to REQUIRED if not specified
    category_if_matched: RequirementCategory = RequirementCategory.REQUIRED

    # What category this results in if condition evaluates to False
    category_if_not_matched: RequirementCategory = RequirementCategory.NOT_APPLICABLE

    # Explanation template / reason strings
    explanation_matched: str
    explanation_not_matched: Optional[str] = "Criteria for this requirement are not met."
    explanation_unknown: Optional[str] = "Applicability cannot be determined because required business profile attributes are missing."

    # Additional metadata for display/workflow (forms, department, estimated timelines)
    department: Optional[str] = None
    estimated_timeline_days: Optional[int] = None
    documents: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    prerequisites: List[str] = Field(
        default_factory=list,
        description="List of requirement_ids that must be completed/approved before this requirement can proceed",
    )

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validate_verified_records(self) -> "RegulatoryRule":
        if self.data_status == DataStatus.VERIFIED:
            meta = self.source_metadata
            if not meta:
                raise ValueError(
                    f"Rule '{self.id}' is marked VERIFIED but lacks 'source_metadata'."
                )
            missing = []
            if not meta.source_url:
                missing.append("source_url")
            if not meta.source_date:
                missing.append("source_date")
            if not meta.reviewed_by:
                missing.append("reviewed_by")
            if missing:
                raise ValueError(
                    f"Rule '{self.id}' is marked VERIFIED but missing required metadata fields: {', '.join(missing)}"
                )
        return self


class RuleFileSchema(BaseModel):
    version: str = "1.0"
    description: Optional[str] = None
    data_status: Optional[DataStatus] = None
    rules: List[RegulatoryRule]

    model_config = {"extra": "forbid"}


class EvaluationResult(BaseModel):
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
    prerequisites: List[str] = Field(default_factory=list)

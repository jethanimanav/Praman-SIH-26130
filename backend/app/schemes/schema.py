import enum
from typing import List, Optional
from pydantic import BaseModel, Field


class SchemeCategory(str, enum.Enum):
    CAPITAL_SUBSIDY = "CAPITAL_SUBSIDY"
    GREEN_TRANSITION = "GREEN_TRANSITION"
    TARIFF_REBATE = "TARIFF_REBATE"
    INTEREST_SUBVENTION = "INTEREST_SUBVENTION"
    SAFETY_UPGRADE = "SAFETY_UPGRADE"
    TAX_EXEMPTION = "TAX_EXEMPTION"


class SchemeEligibilityStatus(str, enum.Enum):
    ELIGIBLE = "ELIGIBLE"
    POTENTIALLY_ELIGIBLE = "POTENTIALLY_ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"


class CriteriaBreakdown(BaseModel):
    matched: List[str] = Field(default_factory=list)
    failed: List[str] = Field(default_factory=list)
    unknown: List[str] = Field(default_factory=list)


class SchemeEvaluationItem(BaseModel):
    scheme_id: str
    name: str
    department: str
    category: str
    description: str
    status: SchemeEligibilityStatus
    eligibility_bucket: str = "POTENTIALLY_ELIGIBLE"  # POTENTIALLY_ELIGIBLE, NOT_MATCHED, NEEDS_MORE_INFO
    max_benefit_description: str
    max_amount_inr: float = 0.0
    disbursement_mechanism: Optional[str] = None
    application_mode: str = "SINGLE_WINDOW_DIRECT"
    matched_conditions: List[str] = Field(default_factory=list)
    unmet_conditions: List[str] = Field(default_factory=list)
    unknown_conditions: List[str] = Field(default_factory=list)
    criteria_breakdown: Optional[CriteriaBreakdown] = None
    potential_action: Optional[str] = None
    missing_fields_hint: List[str] = Field(default_factory=list)
    required_documents: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    suggested_next_steps: List[str] = Field(default_factory=list)
    data_status: str = "DEMO"


class SchemesAssessmentResult(BaseModel):
    business_id: int
    business_name: str
    total_schemes_evaluated: int
    eligible_count: int
    potentially_eligible_count: int
    not_eligible_count: int
    total_potential_benefit_inr: float
    schemes: List[SchemeEvaluationItem]
    assessed_at: str
    data_status: str = "DEMO"
    disclaimer: str = (
        "Indicative technical assessment for demonstration. "
        "Final eligibility is determined exclusively by the competent sanctioning authority."
    )


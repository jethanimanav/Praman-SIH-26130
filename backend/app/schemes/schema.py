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


class SchemeEvaluationItem(BaseModel):
    scheme_id: str
    name: str
    department: str
    category: str
    description: str
    status: SchemeEligibilityStatus
    max_benefit_description: str
    max_amount_inr: float = 0.0
    disbursement_mechanism: Optional[str] = None
    application_mode: str = "SINGLE_WINDOW_DIRECT"
    matched_conditions: List[str] = Field(default_factory=list)
    unmet_conditions: List[str] = Field(default_factory=list)
    potential_action: Optional[str] = None
    missing_fields_hint: List[str] = Field(default_factory=list)
    required_documents: List[str] = Field(default_factory=list)
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

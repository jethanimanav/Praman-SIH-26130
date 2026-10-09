import enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RiskCategory(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RiskColorCode(str, enum.Enum):
    RED = "RED"
    ORANGE = "ORANGE"
    GREEN = "GREEN"


class RiskFactorDetail(BaseModel):
    factor_key: str
    description: str
    field: str
    actual_value: Any = None
    score_awarded: int
    max_weight: int
    triggered: bool
    department: Optional[str] = None
    inspection_item: Optional[str] = None
    data_status: str = "DEMO"


class RiskAssessmentResult(BaseModel):
    composite_score: int
    risk_category: RiskCategory
    color_code: RiskColorCode
    category_description: str
    joint_inspection_mandatory: bool
    inspection_frequency_months: int
    inspection_protocol: str
    factors: List[RiskFactorDetail] = Field(default_factory=list)
    mandated_departments: List[str] = Field(default_factory=list)
    inspection_checklist: List[str] = Field(default_factory=list)
    missing_critical_fields: List[str] = Field(default_factory=list)
    is_complete: bool = True
    data_status: str = "DEMO"

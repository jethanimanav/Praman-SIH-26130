from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ReadinessSeverity(str, Enum):
    BLOCKER = "BLOCKER"
    WARNING = "WARNING"
    INFO = "INFO"


class ReadinessCategory(str, Enum):
    PROFILE = "PROFILE"
    DOCUMENT = "DOCUMENT"
    APPLICATION = "APPLICATION"
    COMPLIANCE = "COMPLIANCE"
    QUERY = "QUERY"


class ReadinessOverallStatus(str, Enum):
    READY = "READY"
    NEEDS_ATTENTION = "NEEDS_ATTENTION"
    BLOCKED = "BLOCKED"


class ReadinessItem(BaseModel):
    id: str
    title: str
    severity: ReadinessSeverity
    category: ReadinessCategory
    description: str
    action_needed: str
    target_tab: Optional[str] = None  # overview, documents, queries, cis, compliance
    target_link: Optional[str] = None
    is_blocking: bool = False


class ReadinessAssessment(BaseModel):
    application_id: int
    application_title: str
    business_id: int
    project_id: Optional[int] = None
    overall_status: ReadinessOverallStatus
    readiness_score_pct: int
    can_submit: bool
    blocker_count: int
    warning_count: int
    info_count: int
    items: List[ReadinessItem]
    assessed_at: str
    data_status: str = "DEMO"
    disclaimer: str = (
        "This is an automated pre-submission technical readiness assessment to assist applicants. "
        "It does not constitute formal statutory clearance, legal advice, or guaranteed departmental approval."
    )

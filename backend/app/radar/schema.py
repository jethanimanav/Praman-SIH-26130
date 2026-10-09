from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class RegulatorySourceResponse(BaseModel):
    id: int
    source_code: str
    name: str
    issuing_authority: str
    official_url: Optional[str] = None
    source_type: str
    verification_status: str
    is_active: bool
    last_checked_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateRegulatorySourceRequest(BaseModel):
    source_code: str
    name: str
    issuing_authority: str
    official_url: Optional[str] = None
    source_type: str = "CIRCULAR"
    verification_status: str = "DEMO"
    is_active: bool = True


class RegulatoryChangeRecordResponse(BaseModel):
    id: int
    change_code: str
    source_id: Optional[int] = None
    title: str
    summary: str
    gazette_or_order_ref: Optional[str] = None
    publication_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    verification_status: str
    target_sector: Optional[str] = "all"
    affected_topics: List[str]
    matching_conditions: Dict[str, Any]
    impact_summary: str
    recommended_action: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateRegulatoryChangeRequest(BaseModel):
    change_code: str
    source_id: Optional[int] = None
    title: str
    summary: str
    gazette_or_order_ref: Optional[str] = None
    publication_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    verification_status: str = "DEMO"
    target_sector: Optional[str] = "all"
    affected_topics: List[str] = []
    matching_conditions: Dict[str, Any] = {}
    impact_summary: str
    recommended_action: Optional[str] = None


class ProjectImpactAssessmentResponse(BaseModel):
    id: int
    project_id: int
    change_id: int
    change_title: str
    change_code: str
    impact_level: str  # POTENTIALLY_AFFECTED, NEEDS_REVIEW, NO_MATCH
    explanation: str
    matched_attributes: Dict[str, Any]
    review_status: str  # PENDING_REVIEW, CONFIRMED, DISMISSED, INVESTIGATING
    review_notes: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    recommended_action: Optional[str] = None
    issuing_authority: str
    verification_status: str

    model_config = {"from_attributes": True}


class RadarImpactDashboardResponse(BaseModel):
    project_id: int
    project_name: str
    total_changes_evaluated: int
    potentially_affected_count: int
    needs_review_count: int
    no_match_count: int
    potentially_affected: List[ProjectImpactAssessmentResponse]
    needs_review: List[ProjectImpactAssessmentResponse]
    no_match: List[ProjectImpactAssessmentResponse]
    assessed_at: str
    data_status: str = "DEMO"
    disclaimer: str = (
        "Regulatory change impact suggestions are automated technical assessments. "
        "They do not constitute formal legal opinion or replace official Gazette publications."
    )


class ReviewImpactRequest(BaseModel):
    decision: str  # CONFIRMED, DISMISSED, INVESTIGATING
    review_notes: str

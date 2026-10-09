from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.inspection import InspectionStatus, InspectionOutcome


class DepartmentFindingItem(BaseModel):
    status: str  # "COMPLIANT" | "NON_COMPLIANT" | "NEEDS_OBSERVATION"
    remarks: str


class InspectionReportItem(BaseModel):
    id: int
    joint_inspection_id: int
    submitted_by_id: int
    submitted_by_name: Optional[str] = None
    submitted_at: datetime
    overall_outcome: InspectionOutcome
    department_findings: Dict[str, Any] = Field(default_factory=dict)
    deficiencies: List[str] = Field(default_factory=list)
    corrective_actions: Optional[str] = None
    reinspection_required: bool = False
    compliance_deadline: Optional[datetime] = None


class JointInspectionItem(BaseModel):
    id: int
    application_id: int
    business_id: int
    business_name: Optional[str] = None
    scheduled_date: datetime
    time_slot: str
    status: InspectionStatus
    risk_category: str
    lead_inspector_id: int
    lead_inspector_name: Optional[str] = None
    participating_departments: List[str] = Field(default_factory=list)
    checklist_items: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    data_status: str = "DEMO"
    created_at: datetime
    report: Optional[InspectionReportItem] = None


class ScheduleInspectionRequest(BaseModel):
    scheduled_date: datetime
    time_slot: str = "10:00 AM - 01:00 PM"
    notes: Optional[str] = None
    custom_checklist: Optional[List[str]] = None


class RescheduleInspectionRequest(BaseModel):
    scheduled_date: datetime
    time_slot: str
    reason: str


class SubmitInspectionReportRequest(BaseModel):
    overall_outcome: InspectionOutcome
    department_findings: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    deficiencies: List[str] = Field(default_factory=list)
    corrective_actions: Optional[str] = None
    reinspection_required: bool = False
    compliance_deadline: Optional[datetime] = None


class ApplicationInspectionsResponse(BaseModel):
    application_id: int
    business_name: str
    risk_category: str
    composite_score: int
    joint_inspection_mandatory: bool
    inspections: List[JointInspectionItem] = Field(default_factory=list)

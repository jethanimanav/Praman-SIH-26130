from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.compliance import ComplianceFilingStatus


class ComplianceMetricField(BaseModel):
    name: str
    label: str
    field_type: str = "text"
    required: bool = True


class ComplianceFilingItem(BaseModel):
    id: int
    application_id: int
    compliance_id: str
    title: str
    department: str
    frequency: str
    period_label: str
    due_date: str
    lead_notice_days: int
    statutory_act: Optional[str] = None
    penalty_clause_desc: Optional[str] = None
    status: ComplianceFilingStatus
    penalty_risk_active: bool
    days_remaining: int
    submitted_at: Optional[str] = None
    submitted_by_email: Optional[str] = None
    filing_data: Dict[str, Any] = Field(default_factory=dict)
    document_id: Optional[int] = None
    remarks: Optional[str] = None
    verified_at: Optional[str] = None
    verified_by_email: Optional[str] = None
    verification_notes: Optional[str] = None
    required_form: Optional[str] = None
    metric_fields: List[ComplianceMetricField] = Field(default_factory=list)
    data_status: str = "DEMO"


class SubmitComplianceFilingRequest(BaseModel):
    filing_data: Dict[str, Any] = Field(default_factory=dict)
    document_id: Optional[int] = None
    remarks: Optional[str] = None


class VerifyComplianceFilingRequest(BaseModel):
    decision: str  # "VERIFIED" or "REJECTED"
    verification_notes: Optional[str] = None


class ComplianceCalendarResponse(BaseModel):
    application_id: int
    business_name: str
    total_filings: int
    upcoming_count: int
    due_soon_count: int
    overdue_count: int
    submitted_count: int
    verified_count: int
    filings: List[ComplianceFilingItem]
    current_simulated_time: str
    data_status: str = "DEMO"

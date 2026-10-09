from typing import List, Optional
from pydantic import BaseModel, Field


class ExecutiveKPIs(BaseModel):
    total_applications: int = 0
    active_applications: int = 0
    completed_applications: int = 0
    rejected_applications: int = 0
    mean_processing_days: Optional[float] = None
    median_processing_days: Optional[float] = None
    sla_breach_count: int = 0
    critical_path_overdue_count: int = 0
    sla_compliance_rate: Optional[float] = None
    total_escalations: int = 0
    active_escalations: int = 0
    resolved_escalations: int = 0
    escalation_rate: Optional[float] = None
    mean_escalation_resolution_hours: Optional[float] = None
    median_escalation_resolution_hours: Optional[float] = None
    document_review_backlog: int = 0
    inspection_backlog: int = 0
    compliance_overdue_count: int = 0


class ExecutiveInsightItem(BaseModel):
    id: str
    priority: str  # "CRITICAL", "WARNING", "INFO"
    category: str  # "CRITICAL_PATH", "SLA", "ESCALATION", "DOCUMENTS", "INSPECTIONS", "COMPLIANCE"
    title: str
    message: str
    metric_value: Optional[str] = None


class DepartmentPerformanceItem(BaseModel):
    department: str
    total_steps: int = 0
    completed_steps: int = 0
    in_progress_steps: int = 0
    overdue_steps: int = 0
    active_escalations: int = 0
    on_time_rate: Optional[float] = None


class SLAHealthDistribution(BaseModel):
    on_track: int = 0
    warning: int = 0
    overdue: int = 0
    paused: int = 0
    completed: int = 0
    not_started: int = 0
    sla_verification_required: int = 0


class DocumentAnalyticsSummary(BaseModel):
    total_uploaded: int = 0
    accepted: int = 0
    under_review: int = 0
    rejected: int = 0
    query_raised: int = 0
    backlog: int = 0
    average_review_hours: Optional[float] = None


class InspectionAnalyticsSummary(BaseModel):
    total_inspections: int = 0
    scheduled: int = 0
    in_progress: int = 0
    completed: int = 0
    cancelled: int = 0
    rescheduled: int = 0
    backlog: int = 0
    satisfactory_count: int = 0
    deficiencies_noted_count: int = 0
    non_compliant_count: int = 0
    facilities_high_risk: int = 0
    facilities_medium_risk: int = 0
    facilities_low_risk: int = 0


class ComplianceAnalyticsSummary(BaseModel):
    total_filings: int = 0
    upcoming: int = 0
    due_soon: int = 0
    overdue: int = 0
    submitted: int = 0
    verified: int = 0
    rejected: int = 0
    penalty_risk_active: int = 0
    verification_backlog: int = 0


class AnalyticsOverviewResponse(BaseModel):
    kpis: ExecutiveKPIs
    insights: List[ExecutiveInsightItem] = Field(default_factory=list)
    sla_health: SLAHealthDistribution
    document_health: DocumentAnalyticsSummary
    inspection_health: InspectionAnalyticsSummary
    compliance_health: ComplianceAnalyticsSummary
    data_status: str = "DEMO"
    generated_at: str


class AnalyticsTrendItem(BaseModel):
    month: str
    applications_created: int = 0
    applications_completed: int = 0
    escalations_triggered: int = 0


class AnalyticsTrendsResponse(BaseModel):
    trends: List[AnalyticsTrendItem] = Field(default_factory=list)
    insufficient_data: bool = False
    data_status: str = "DEMO"

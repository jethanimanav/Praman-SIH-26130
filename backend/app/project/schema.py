from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProjectCreateRequest(BaseModel):
    business_id: int
    name: str
    description: Optional[str] = None
    project_type: Optional[str] = "New Setup"
    district: Optional[str] = None
    taluka: Optional[str] = None
    industrial_zone: Optional[str] = None
    location_type: Optional[str] = None
    site_address: Optional[str] = None
    survey_plot_number: Optional[str] = None
    total_area_sqm: Optional[float] = None
    built_up_area_sqm: Optional[float] = None
    sector: Optional[str] = "Manufacturing"
    activities: Optional[List[str]] = Field(default_factory=list)
    workforce_count: Optional[int] = None
    power_load_kw: Optional[float] = None
    water_consumption_kld: Optional[float] = None
    effluent_discharge_kld: Optional[float] = None
    pollution_category: Optional[str] = None
    hazardous_waste: Optional[bool] = False
    air_emissions: Optional[bool] = False


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[str] = None
    status: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    industrial_zone: Optional[str] = None
    location_type: Optional[str] = None
    site_address: Optional[str] = None
    survey_plot_number: Optional[str] = None
    total_area_sqm: Optional[float] = None
    built_up_area_sqm: Optional[float] = None
    sector: Optional[str] = None
    activities: Optional[List[str]] = None
    workforce_count: Optional[int] = None
    power_load_kw: Optional[float] = None
    water_consumption_kld: Optional[float] = None
    effluent_discharge_kld: Optional[float] = None
    pollution_category: Optional[str] = None
    hazardous_waste: Optional[bool] = None
    air_emissions: Optional[bool] = None


class ProjectResponse(BaseModel):
    id: int
    business_id: int
    business_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    project_type: str = "New Setup"
    status: str = "ACTIVE"
    district: Optional[str] = None
    taluka: Optional[str] = None
    industrial_zone: Optional[str] = None
    location_type: Optional[str] = None
    site_address: Optional[str] = None
    survey_plot_number: Optional[str] = None
    total_area_sqm: Optional[float] = None
    built_up_area_sqm: Optional[float] = None
    sector: Optional[str] = "Manufacturing"
    activities: List[str] = Field(default_factory=list)
    workforce_count: Optional[int] = None
    power_load_kw: Optional[float] = None
    water_consumption_kld: Optional[float] = None
    effluent_discharge_kld: Optional[float] = None
    pollution_category: Optional[str] = None
    hazardous_waste: bool = False
    air_emissions: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    applications_count: int = 0
    has_regulatory_profile: bool = False

    model_config = {"from_attributes": True}


class CompanyMasterInfo(BaseModel):
    id: int
    name: str
    registration_number: Optional[str] = None
    entity_type: Optional[str] = None
    pan_number: Optional[str] = None
    gstin: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    registered_office_address: Optional[str] = None


class ProjectApplicationSummary(BaseModel):
    id: int
    title: str
    status: str
    total_timeline_days: int
    critical_path_steps: List[str] = Field(default_factory=list)
    total_steps: int = 0
    approved_steps: int = 0
    in_progress_steps: int = 0
    created_at: datetime


class ProjectDocumentsSummary(BaseModel):
    total_slots: int = 0
    uploaded_count: int = 0
    accepted_count: int = 0
    under_review_count: int = 0
    query_raised_count: int = 0
    readiness_percentage: int = 0


class ProjectInspectionsSummary(BaseModel):
    total: int = 0
    scheduled: int = 0
    completed: int = 0
    rescheduled: int = 0


class ProjectComplianceSummary(BaseModel):
    total: int = 0
    upcoming: int = 0
    due_soon: int = 0
    overdue: int = 0
    submitted: int = 0
    verified: int = 0


class ProjectOverviewResponse(BaseModel):
    project: ProjectResponse
    company: CompanyMasterInfo
    applications: List[ProjectApplicationSummary] = Field(default_factory=list)
    documents_summary: ProjectDocumentsSummary
    inspections_summary: ProjectInspectionsSummary
    compliance_summary: ProjectComplianceSummary
    data_status: str = "DEMO"

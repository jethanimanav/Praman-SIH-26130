from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, model_validator
from app.regulatory.schema import DataStatus, SourceMetadata


class SLAStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    ON_TRACK = "ON_TRACK"
    WARNING = "WARNING"
    OVERDUE = "OVERDUE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    SLA_VERIFICATION_REQUIRED = "SLA_VERIFICATION_REQUIRED"


class EscalationStatus(str, Enum):
    TRIGGERED = "TRIGGERED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class SLAConfig(BaseModel):
    sla_id: str
    requirement_id: str
    duration_days: int = Field(ge=0, description="Configured SLA duration in days")
    calendar_type: str = Field(default="calendar_days", description="calendar_days or working_days")
    warning_threshold: float = Field(default=0.8, ge=0.0, le=1.0, description="Warning threshold ratio (e.g. 0.8 = 80%)")
    escalation_threshold_days: float = Field(default=0.0, ge=0.0, description="Days overdue before escalation triggers")
    escalation_level: str = Field(default="LEVEL_1", description="System escalation tier (LEVEL_1, LEVEL_2, etc.)")
    escalation_recipient_role: Optional[str] = Field(
        default=None,
        description="Configured internal recipient role; if None, results in ESCALATION_CONFIGURATION_REQUIRED",
    )
    data_status: DataStatus = DataStatus.DEMO
    source_metadata: Optional[SourceMetadata] = None
    notes: Optional[str] = None

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validate_verified(self) -> "SLAConfig":
        if self.data_status == DataStatus.VERIFIED:
            if not self.source_metadata or not self.source_metadata.source_url:
                raise ValueError(f"SLA '{self.sla_id}' marked VERIFIED must supply source_metadata with source_url.")
        return self


class SLAFileSchema(BaseModel):
    version: str = "1.0"
    description: Optional[str] = None
    data_status: Optional[DataStatus] = None
    slas: List[SLAConfig]

    model_config = {"extra": "forbid"}


class SLACalculationResult(BaseModel):
    requirement_id: str
    sla_id: Optional[str] = None
    status: SLAStatus
    duration_days: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    elapsed_days: float = 0.0
    remaining_days: float = 0.0
    days_overdue: float = 0.0
    warning_threshold_pct: float = 80.0
    is_warning: bool = False
    is_overdue: bool = False
    is_paused: bool = False
    paused_seconds: int = 0
    data_status: str = "DEMO"
    calendar_note: str = "ELAPSED_CALENDAR_DAYS"
    escalation_triggered: bool = False
    escalation_level: Optional[str] = None
    escalation_recipient: Optional[str] = None

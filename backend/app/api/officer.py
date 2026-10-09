"""
Officer Operational API Endpoints.

Handles:
- Officer escalation queue with live SLA status & critical-path relevance
- Escalation inspection details
- Deterministic acknowledgment (TRIGGERED -> ACKNOWLEDGED)
- Deterministic resolution (requires non-empty resolution note)
- Officer operational workload KPIs (real data only)
"""
from datetime import datetime
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.escalation import EscalationEvent
from app.models.workflow import ApprovalStep, Application
from app.sla.schema import EscalationStatus
from app.api.deps import get_current_active_user, require_role, OfficerUser
from app.escalation.service import EscalationService


router = APIRouter(prefix="/api/officer", tags=["officer"])


# --- Schemas ---

class ResolveEscalationRequest(BaseModel):
    resolution_note: str = Field(..., min_length=1, description="Meaningful resolution rationale")


class OfficerEscalationItem(BaseModel):
    id: int
    application_id: int
    application_title: str
    approval_step_id: int
    step_name: str
    department: str
    requirement_id: str
    sla_id: Optional[str] = None
    trigger_type: str
    level: str
    recipient_role: str
    days_overdue: float
    reason: str
    status: str
    triggered_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by_email: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by_email: Optional[str] = None
    resolution_note: Optional[str] = None
    is_critical_path: bool
    sla_status: str
    days_remaining: float
    current_days_overdue: float
    data_status: str = "DEMO"


class OfficerOverviewResponse(BaseModel):
    open_escalations: int
    triggered_escalations: int
    acknowledged_escalations: int
    resolved_escalations: int
    in_progress_steps: int
    warning_steps: int
    overdue_steps: int
    data_status: str = "DEMO"


# --- Endpoints ---

@router.get("/overview", response_model=OfficerOverviewResponse)
def get_officer_overview(
    current_user: OfficerUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns high-level queue metrics for officer dashboard.
    Only computed from actual database state. Officer and Admin only.
    """
    return EscalationService.get_officer_overview(db, current_user)


@router.get("/escalations", response_model=List[OfficerEscalationItem])
def get_officer_escalations(
    current_user: OfficerUser,
    db: Annotated[Session, Depends(get_db)],
    status: Optional[str] = Query(None, description="Filter by status: OPEN, TRIGGERED, ACKNOWLEDGED, RESOLVED"),
    sla_status: Optional[str] = Query(None, description="Filter by SLA status: ON_TRACK, WARNING, OVERDUE"),
    critical_path: bool = Query(False, description="Filter to critical-path steps only"),
):
    """
    Returns the focused officer escalation queue.
    Enriched with live M4 critical-path metadata and M5 SLA status.
    Officer and Admin only.
    """
    return EscalationService.get_escalations_for_officer(
        db=db,
        user=current_user,
        status_filter=status,
        sla_filter=sla_status,
        critical_path_only=critical_path,
    )


@router.get("/escalations/{escalation_id}", response_model=OfficerEscalationItem)
def get_escalation_detail(
    escalation_id: int,
    current_user: OfficerUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns detailed inspection for a single escalation event.
    Officer and Admin only.
    """
    items = EscalationService.get_escalations_for_officer(db, current_user)
    matching = next((item for item in items if item["id"] == escalation_id), None)
    if not matching:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Escalation #{escalation_id} not found",
        )
    return matching


@router.post("/escalations/{escalation_id}/acknowledge", response_model=OfficerEscalationItem)
def acknowledge_escalation(
    escalation_id: int,
    current_user: OfficerUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Officer acknowledges an escalation.
    Transitions TRIGGERED -> ACKNOWLEDGED.
    Creates immutable audit log. Officer and Admin only.
    """
    EscalationService.acknowledge_escalation(
        db=db,
        escalation_id=escalation_id,
        user=current_user,
    )
    # Return enriched detail
    items = EscalationService.get_escalations_for_officer(db, current_user)
    matching = next((item for item in items if item["id"] == escalation_id), None)
    return matching


@router.post("/escalations/{escalation_id}/resolve", response_model=OfficerEscalationItem)
def resolve_escalation(
    escalation_id: int,
    payload: ResolveEscalationRequest,
    current_user: OfficerUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Officer resolves an escalation.
    Transitions TRIGGERED or ACKNOWLEDGED -> RESOLVED.
    Requires non-empty resolution note. Creates immutable audit log.
    Officer and Admin only.
    """
    EscalationService.resolve_escalation(
        db=db,
        escalation_id=escalation_id,
        user=current_user,
        resolution_note=payload.resolution_note,
    )
    # Return enriched detail
    items = EscalationService.get_escalations_for_officer(db, current_user)
    matching = next((item for item in items if item["id"] == escalation_id), None)
    return matching

from datetime import datetime
from pathlib import Path
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.user import User, UserRole
from app.models.workflow import Application, ApprovalStep, StepStatus
from app.models.escalation import EscalationEvent
from app.api.deps import get_current_active_user
from app.core.clock import ClockService
from app.sla.schema import SLAConfig, SLACalculationResult, SLAStatus, EscalationStatus
from app.sla.loader import SLALoader
from app.sla.engine import SLAEngine
from app.escalation.engine import EscalationEngine


router = APIRouter(prefix="/api/workflow", tags=["sla"])

SLA_DATA_DIR = Path("data/sla")


def get_sla_configs() -> Dict[str, SLAConfig]:
    return SLALoader.load_from_directory(SLA_DATA_DIR)


# --- Response Schemas ---

class EscalationEventResponse(BaseModel):
    id: int
    application_id: int
    approval_step_id: int
    requirement_id: str
    sla_id: Optional[str] = None
    trigger_type: str
    level: str
    recipient_role: str
    days_overdue: float
    reason: str
    status: EscalationStatus
    triggered_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by_id: Optional[int] = None
    resolved_at: Optional[datetime] = None
    resolved_by_id: Optional[int] = None
    resolution_note: Optional[str] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class StepSLAResponse(BaseModel):
    step_id: int
    requirement_id: str
    step_name: str
    department: Optional[str] = None
    status: StepStatus
    is_critical_path: bool
    sla: SLACalculationResult


class ApplicationSLAResponse(BaseModel):
    application_id: int
    application_title: str
    application_status: str
    overall_sla_status: SLAStatus
    current_time: datetime
    is_clock_simulated: bool
    total_steps: int
    critical_path_steps_count: int
    critical_path_sla_status: SLAStatus
    active_escalations_count: int
    steps: List[StepSLAResponse]


# --- Endpoints ---

@router.get("/applications/{application_id}/sla", response_model=ApplicationSLAResponse)
def get_application_sla(
    application_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns deterministic SLA status for an application and all its approval steps.
    Calculations use ClockService.now(). Automatically evaluates and records escalations if overdue.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    # Ownership check
    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized application access",
        )

    now = ClockService.now()
    configs = get_sla_configs()

    # Automatically check and trigger escalations idempotently
    escalations = EscalationEngine.evaluate_and_escalate(db, application, configs, now)

    step_responses: List[StepSLAResponse] = []
    overall_status = SLAStatus.ON_TRACK
    critical_path_status = SLAStatus.ON_TRACK
    has_warning = False
    has_overdue = False
    critical_has_warning = False
    critical_has_overdue = False

    critical_set = set(application.critical_path_steps or [])

    for step in application.steps:
        cfg = configs.get(step.requirement_id)
        calc = SLAEngine.calculate_step_sla(step, cfg, now)

        # Check if step has active escalation
        matching_esc = next((e for e in escalations if e.approval_step_id == step.id), None)
        if matching_esc:
            calc.escalation_triggered = True
            calc.escalation_level = matching_esc.level
            calc.escalation_recipient = matching_esc.recipient_role

        if calc.status == SLAStatus.OVERDUE:
            has_overdue = True
            if step.requirement_id in critical_set:
                critical_has_overdue = True
        elif calc.status == SLAStatus.WARNING:
            has_warning = True
            if step.requirement_id in critical_set:
                critical_has_warning = True

        step_responses.append(
            StepSLAResponse(
                step_id=step.id,
                requirement_id=step.requirement_id,
                step_name=step.step_name,
                department=step.department,
                status=step.status,
                is_critical_path=step.is_critical_path,
                sla=calc,
            )
        )

    if has_overdue:
        overall_status = SLAStatus.OVERDUE
    elif has_warning:
        overall_status = SLAStatus.WARNING

    if critical_has_overdue:
        critical_path_status = SLAStatus.OVERDUE
    elif critical_has_warning:
        critical_path_status = SLAStatus.WARNING

    return ApplicationSLAResponse(
        application_id=application.id,
        application_title=application.title,
        application_status=application.status.value,
        overall_sla_status=overall_status,
        current_time=now,
        is_clock_simulated=ClockService.is_simulated(),
        total_steps=len(step_responses),
        critical_path_steps_count=len(critical_set),
        critical_path_sla_status=critical_path_status,
        active_escalations_count=len(escalations),
        steps=step_responses,
    )


@router.get("/applications/{application_id}/escalations", response_model=List[EscalationEventResponse])
def get_application_escalations(
    application_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Returns active and historical escalation events for an application."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized application access",
        )

    return db.query(EscalationEvent).filter(EscalationEvent.application_id == application_id).all()


@router.post("/applications/{application_id}/steps/{step_id}/pause", response_model=StepSLAResponse)
def pause_step(
    application_id: int,
    step_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Pauses an in-progress approval step."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized application access")

    step = db.query(ApprovalStep).filter(
        ApprovalStep.id == step_id, ApprovalStep.application_id == application_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Approval step not found")

    if step.status != StepStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Only in-progress steps can be paused")

    if step.is_paused:
        raise HTTPException(status_code=400, detail="Step is already paused")

    now = ClockService.now()
    step.is_paused = True
    step.paused_at = now
    db.commit()
    db.refresh(step)

    cfg = get_sla_configs().get(step.requirement_id)
    calc = SLAEngine.calculate_step_sla(step, cfg, now)

    return StepSLAResponse(
        step_id=step.id,
        requirement_id=step.requirement_id,
        step_name=step.step_name,
        department=step.department,
        status=step.status,
        is_critical_path=step.is_critical_path,
        sla=calc,
    )


@router.post("/applications/{application_id}/steps/{step_id}/resume", response_model=StepSLAResponse)
def resume_step(
    application_id: int,
    step_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Resumes a paused approval step and accumulates paused seconds."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized application access")

    step = db.query(ApprovalStep).filter(
        ApprovalStep.id == step_id, ApprovalStep.application_id == application_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Approval step not found")

    if not step.is_paused:
        raise HTTPException(status_code=400, detail="Step is not paused")

    now = ClockService.now()
    paused_delta = int((now - step.paused_at).total_seconds()) if step.paused_at else 0
    step.total_paused_seconds += max(0, paused_delta)
    step.is_paused = False
    step.paused_at = None
    db.commit()
    db.refresh(step)

    cfg = get_sla_configs().get(step.requirement_id)
    calc = SLAEngine.calculate_step_sla(step, cfg, now)

    return StepSLAResponse(
        step_id=step.id,
        requirement_id=step.requirement_id,
        step_name=step.step_name,
        department=step.department,
        status=step.status,
        is_critical_path=step.is_critical_path,
        sla=calc,
    )

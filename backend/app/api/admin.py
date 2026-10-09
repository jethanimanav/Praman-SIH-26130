from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.api.deps import AdminUser
from app.core.clock import ClockService
from datetime import datetime

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AuditLogResponse(BaseModel):
    id: int
    user_email: str | None
    user_role: str | None
    action: str
    entity_type: str | None
    entity_id: str | None
    reason: str | None
    source: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClockStatusResponse(BaseModel):
    current_time: datetime
    is_simulated: bool
    real_time: datetime


class AdvanceClockRequest(BaseModel):
    days: int = 0
    hours: int = 0
    minutes: int = 0


@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    current_user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    skip: int = 0,
    limit: int = 100,
):
    """Return recent audit logs. Admin only."""
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return logs


@router.get("/clock", response_model=ClockStatusResponse)
def get_clock_status(current_user: AdminUser):
    """Return the current simulated clock status."""
    return ClockStatusResponse(
        current_time=ClockService.now(),
        is_simulated=ClockService.is_simulated(),
        real_time=datetime.utcnow(),
    )


@router.post("/clock/advance", response_model=ClockStatusResponse)
def advance_clock(
    payload: AdvanceClockRequest,
    current_user: AdminUser,
):
    """Advance the simulated clock. Admin only. Used for SLA demos."""
    new_time = ClockService.advance(
        days=payload.days, hours=payload.hours, minutes=payload.minutes
    )
    return ClockStatusResponse(
        current_time=new_time,
        is_simulated=ClockService.is_simulated(),
        real_time=datetime.utcnow(),
    )


@router.post("/clock/reset", response_model=ClockStatusResponse)
def reset_clock(current_user: AdminUser):
    """Reset the simulated clock to real time. Admin only."""
    ClockService.reset()
    return ClockStatusResponse(
        current_time=ClockService.now(),
        is_simulated=False,
        real_time=datetime.utcnow(),
    )


@router.get("/users")
def list_users(
    current_user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    """List all users. Admin only."""
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


# --- Operational Analytics & Bottleneck Models ---

class AdminOverviewResponse(BaseModel):
    total_applications: int
    applications_by_status: dict
    total_steps: int
    steps_by_status: dict
    total_escalations: int
    escalations_by_status: dict
    active_escalations: int
    sla_health: dict  # {"ON_TRACK": n, "WARNING": n, "OVERDUE": n, "NOT_STARTED": n, "COMPLETED": n}
    critical_path_overdue_count: int
    average_resolution_hours: float | None
    data_status: str = "DEMO"


class AdminBottleneckItem(BaseModel):
    step_id: int
    application_id: int
    application_title: str
    requirement_id: str
    step_name: str
    department: str
    is_critical_path: bool
    status: str
    sla_status: str
    days_overdue: float
    escalation_status: str | None
    escalation_level: str | None
    recipient_role: str | None
    data_status: str = "DEMO"


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    current_user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns system-wide operational metrics for administrators.
    All metrics computed from real database state. Admin only.
    """
    from app.models.workflow import Application, ApprovalStep, StepStatus, ApplicationStatus
    from app.models.escalation import EscalationEvent
    from app.sla.schema import EscalationStatus, SLAStatus
    from app.sla.engine import SLAEngine
    from app.sla.loader import SLALoader
    from pathlib import Path

    now = ClockService.now()
    sla_configs = SLALoader.load_from_directory(Path("data/sla"))

    # Applications
    apps = db.query(Application).all()
    apps_by_status = {s.value: 0 for s in ApplicationStatus}
    for a in apps:
        apps_by_status[a.status.value] = apps_by_status.get(a.status.value, 0) + 1

    # Steps
    steps = db.query(ApprovalStep).all()
    steps_by_status = {s.value: 0 for s in StepStatus}
    for s in steps:
        steps_by_status[s.status.value] = steps_by_status.get(s.status.value, 0) + 1

    # Escalations
    escalations = db.query(EscalationEvent).all()
    esc_by_status = {s.value: 0 for s in EscalationStatus}
    for e in escalations:
        esc_by_status[e.status.value] = esc_by_status.get(e.status.value, 0) + 1
    active_esc = esc_by_status.get(EscalationStatus.TRIGGERED.value, 0) + esc_by_status.get(EscalationStatus.ACKNOWLEDGED.value, 0)

    # SLA health distribution across in-progress steps
    sla_health = {
        "ON_TRACK": 0,
        "WARNING": 0,
        "OVERDUE": 0,
        "NOT_STARTED": 0,
        "PAUSED": 0,
        "COMPLETED": 0,
        "SLA_VERIFICATION_REQUIRED": 0,
    }
    critical_overdue = 0

    for step in steps:
        cfg = sla_configs.get(step.requirement_id)
        calc = SLAEngine.calculate_step_sla(step, cfg, now)
        sla_health[calc.status.value] = sla_health.get(calc.status.value, 0) + 1
        if step.is_critical_path and calc.status == SLAStatus.OVERDUE:
            critical_overdue += 1

    # Average resolution time in hours for resolved escalations
    resolved_durations = []
    for e in escalations:
        if e.status == EscalationStatus.RESOLVED and e.resolved_at and e.triggered_at:
            delta = (e.resolved_at - e.triggered_at).total_seconds() / 3600.0
            if delta >= 0:
                resolved_durations.append(delta)

    avg_resolution_hours = round(sum(resolved_durations) / len(resolved_durations), 1) if resolved_durations else None

    return AdminOverviewResponse(
        total_applications=len(apps),
        applications_by_status=apps_by_status,
        total_steps=len(steps),
        steps_by_status=steps_by_status,
        total_escalations=len(escalations),
        escalations_by_status=esc_by_status,
        active_escalations=active_esc,
        sla_health=sla_health,
        critical_path_overdue_count=critical_overdue,
        average_resolution_hours=avg_resolution_hours,
        data_status="DEMO",
    )


@router.get("/bottlenecks", response_model=List[AdminBottleneckItem])
def get_admin_bottlenecks(
    current_user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Identifies actual bottlenecks: overdue steps or steps with active escalations.
    Prioritizes critical-path steps. Derived strictly from real data. Admin only.
    """
    from app.models.workflow import ApprovalStep, StepStatus
    from app.models.escalation import EscalationEvent
    from app.sla.schema import SLAStatus, EscalationStatus
    from app.sla.engine import SLAEngine
    from app.sla.loader import SLALoader
    from sqlalchemy.orm import joinedload
    from pathlib import Path

    now = ClockService.now()
    sla_configs = SLALoader.load_from_directory(Path("data/sla"))

    steps = (
        db.query(ApprovalStep)
        .options(
            joinedload(ApprovalStep.application),
            joinedload(ApprovalStep.escalations),
        )
        .filter(ApprovalStep.status.in_([StepStatus.IN_PROGRESS, StepStatus.READY, StepStatus.BLOCKED]))
        .all()
    )

    bottlenecks = []
    for step in steps:
        cfg = sla_configs.get(step.requirement_id)
        calc = SLAEngine.calculate_step_sla(step, cfg, now)

        # Active escalation if any
        active_esc = next((e for e in step.escalations if e.status in [EscalationStatus.TRIGGERED, EscalationStatus.ACKNOWLEDGED]), None)

        # A step is a bottleneck if it is overdue or has an active escalation
        if calc.status == SLAStatus.OVERDUE or active_esc is not None:
            bottlenecks.append(
                AdminBottleneckItem(
                    step_id=step.id,
                    application_id=step.application_id,
                    application_title=step.application.title if step.application else f"App #{step.application_id}",
                    requirement_id=step.requirement_id,
                    step_name=step.step_name,
                    department=step.department or "DEPARTMENT_CONFIGURATION_REQUIRED",
                    is_critical_path=step.is_critical_path,
                    status=step.status.value,
                    sla_status=calc.status.value,
                    days_overdue=calc.days_overdue,
                    escalation_status=active_esc.status.value if active_esc else None,
                    escalation_level=active_esc.level if active_esc else None,
                    recipient_role=active_esc.recipient_role if active_esc else None,
                    data_status="DEMO",
                )
            )

    # Sort bottlenecks: critical path first, then by highest days overdue
    bottlenecks.sort(key=lambda b: (not b.is_critical_path, -b.days_overdue))
    return bottlenecks

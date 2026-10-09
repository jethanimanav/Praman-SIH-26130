"""
Escalation Service.

Manages the deterministic lifecycle of EscalationEvents:
TRIGGERED -> ACKNOWLEDGED -> RESOLVED.

Enforces:
- Strict state machine transitions (prevents invalid jumps and re-openings).
- Non-empty resolution notes for resolving escalations.
- Immutable audit logging for every lifecycle event.
- Live SLA calculation and critical path evaluation integration.
"""
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.workflow import Application, ApprovalStep, StepStatus
from app.models.escalation import EscalationEvent
from app.models.user import User, UserRole
from app.sla.schema import EscalationStatus, SLAConfig, SLACalculationResult, SLAStatus
from app.sla.engine import SLAEngine
from app.sla.loader import SLALoader
from app.core.clock import ClockService
from app.core.audit import record_audit
from pathlib import Path


SLA_DATA_DIR = Path("data/sla")


class EscalationService:

    @classmethod
    def get_sla_configs(cls) -> Dict[str, SLAConfig]:
        return SLALoader.load_from_directory(SLA_DATA_DIR)

    @classmethod
    def acknowledge_escalation(
        cls,
        db: Session,
        escalation_id: int,
        user: User,
    ) -> EscalationEvent:
        """
        Transitions an escalation from TRIGGERED -> ACKNOWLEDGED.
        Records actor, timestamp, and audit trail.
        """
        escalation = db.query(EscalationEvent).filter(EscalationEvent.id == escalation_id).first()
        if not escalation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Escalation #{escalation_id} not found",
            )

        if escalation.status == EscalationStatus.RESOLVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot acknowledge escalation #{escalation_id}: already RESOLVED",
            )

        if escalation.status == EscalationStatus.ACKNOWLEDGED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Escalation #{escalation_id} is already ACKNOWLEDGED",
            )

        previous_status = escalation.status.value
        now = ClockService.now()

        escalation.status = EscalationStatus.ACKNOWLEDGED
        escalation.acknowledged_at = now
        escalation.acknowledged_by_id = user.id

        record_audit(
            db=db,
            action="escalation.acknowledged",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="escalation_event",
            entity_id=str(escalation.id),
            previous_value={"status": previous_status},
            new_value={
                "status": EscalationStatus.ACKNOWLEDGED.value,
                "acknowledged_at": now.isoformat(),
                "acknowledged_by_id": user.id,
            },
            reason=f"Escalation acknowledged by {user.role.value} ({user.email})",
        )

        db.commit()
        db.refresh(escalation)
        return escalation

    @classmethod
    def resolve_escalation(
        cls,
        db: Session,
        escalation_id: int,
        user: User,
        resolution_note: str,
    ) -> EscalationEvent:
        """
        Transitions an escalation from TRIGGERED or ACKNOWLEDGED -> RESOLVED.
        Requires a non-empty human resolution note.
        Records actor, timestamp, note, and audit trail.
        """
        escalation = db.query(EscalationEvent).filter(EscalationEvent.id == escalation_id).first()
        if not escalation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Escalation #{escalation_id} not found",
            )

        if not resolution_note or not resolution_note.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A non-empty resolution note is required to resolve an escalation",
            )

        if escalation.status == EscalationStatus.RESOLVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Escalation #{escalation_id} is already RESOLVED",
            )

        previous_status = escalation.status.value
        now = ClockService.now()
        clean_note = resolution_note.strip()

        escalation.status = EscalationStatus.RESOLVED
        escalation.resolved_at = now
        escalation.resolved_by_id = user.id
        escalation.resolution_note = clean_note

        record_audit(
            db=db,
            action="escalation.resolved",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="escalation_event",
            entity_id=str(escalation.id),
            previous_value={"status": previous_status},
            new_value={
                "status": EscalationStatus.RESOLVED.value,
                "resolved_at": now.isoformat(),
                "resolved_by_id": user.id,
                "resolution_note": clean_note,
            },
            reason=f"Escalation resolved by {user.role.value} ({user.email}): {clean_note}",
        )

        db.commit()
        db.refresh(escalation)
        return escalation

    @classmethod
    def get_escalations_for_officer(
        cls,
        db: Session,
        user: User,
        status_filter: Optional[str] = None,
        sla_filter: Optional[str] = None,
        critical_path_only: bool = False,
    ) -> List[dict]:
        """
        Retrieves escalations for the officer queue with live SLA status
        and critical path information from M4 & M5.
        """
        query = db.query(EscalationEvent).options(
            joinedload(EscalationEvent.approval_step),
            joinedload(EscalationEvent.application),
            joinedload(EscalationEvent.acknowledged_by),
            joinedload(EscalationEvent.resolved_by),
        )

        if status_filter:
            norm_filter = status_filter.upper()
            if norm_filter in [e.value for e in EscalationStatus]:
                query = query.filter(EscalationEvent.status == norm_filter)
            elif norm_filter == "OPEN":
                query = query.filter(EscalationEvent.status.in_([EscalationStatus.TRIGGERED, EscalationStatus.ACKNOWLEDGED]))

        escalations = query.order_by(EscalationEvent.triggered_at.desc()).all()
        now = ClockService.now()
        sla_configs = cls.get_sla_configs()

        results = []
        for esc in escalations:
            step = esc.approval_step
            app = esc.application
            cfg = sla_configs.get(esc.requirement_id)

            sla_calc: Optional[SLACalculationResult] = None
            if step:
                sla_calc = SLAEngine.calculate_step_sla(step, cfg, now)

            is_critical = step.is_critical_path if step else False
            if critical_path_only and not is_critical:
                continue

            if sla_filter and sla_calc:
                if sla_calc.status.value != sla_filter.upper():
                    continue

            results.append({
                "id": esc.id,
                "application_id": esc.application_id,
                "application_title": app.title if app else f"App #{esc.application_id}",
                "approval_step_id": esc.approval_step_id,
                "step_name": step.step_name if step else "Unknown Step",
                "department": step.department if step else "DEPARTMENT_CONFIGURATION_REQUIRED",
                "requirement_id": esc.requirement_id,
                "sla_id": esc.sla_id,
                "trigger_type": esc.trigger_type,
                "level": esc.level,
                "recipient_role": esc.recipient_role,
                "days_overdue": esc.days_overdue,
                "reason": esc.reason,
                "status": esc.status.value,
                "triggered_at": esc.triggered_at,
                "acknowledged_at": esc.acknowledged_at,
                "acknowledged_by_email": esc.acknowledged_by.email if esc.acknowledged_by else None,
                "resolved_at": esc.resolved_at,
                "resolved_by_email": esc.resolved_by.email if esc.resolved_by else None,
                "resolution_note": esc.resolution_note,
                "is_critical_path": is_critical,
                "sla_status": sla_calc.status.value if sla_calc else "UNKNOWN",
                "days_remaining": sla_calc.remaining_days if sla_calc else 0.0,
                "current_days_overdue": sla_calc.days_overdue if sla_calc else 0.0,
                "data_status": "DEMO",
            })

        return results

    @classmethod
    def get_officer_overview(cls, db: Session, user: User) -> dict:
        """
        Computes officer queue workload KPIs from actual database state.
        Zero fabricated statistics.
        """
        all_escalations = db.query(EscalationEvent).all()
        now = ClockService.now()
        configs = cls.get_sla_configs()

        triggered_count = sum(1 for e in all_escalations if e.status == EscalationStatus.TRIGGERED)
        acknowledged_count = sum(1 for e in all_escalations if e.status == EscalationStatus.ACKNOWLEDGED)
        resolved_count = sum(1 for e in all_escalations if e.status == EscalationStatus.RESOLVED)
        open_escalations_count = triggered_count + acknowledged_count

        # Step-level SLA warnings and overdue counts
        steps = db.query(ApprovalStep).filter(ApprovalStep.status == StepStatus.IN_PROGRESS).all()
        warning_steps_count = 0
        overdue_steps_count = 0
        for step in steps:
            cfg = configs.get(step.requirement_id)
            calc = SLAEngine.calculate_step_sla(step, cfg, now)
            if calc.status == SLAStatus.WARNING:
                warning_steps_count += 1
            elif calc.status == SLAStatus.OVERDUE:
                overdue_steps_count += 1

        return {
            "open_escalations": open_escalations_count,
            "triggered_escalations": triggered_count,
            "acknowledged_escalations": acknowledged_count,
            "resolved_escalations": resolved_count,
            "in_progress_steps": len(steps),
            "warning_steps": warning_steps_count,
            "overdue_steps": overdue_steps_count,
            "data_status": "DEMO",
        }

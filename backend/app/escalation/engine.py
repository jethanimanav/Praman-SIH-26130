"""
Deterministic Escalation Engine.

Handles evaluation of SLA breach thresholds and idempotent dispatch
of EscalationEvents without creating duplicates.
"""
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.workflow import Application, ApprovalStep, StepStatus
from app.models.escalation import EscalationEvent
from app.sla.schema import SLAConfig, SLACalculationResult, SLAStatus, EscalationStatus
from app.sla.engine import SLAEngine
from app.core.audit import record_audit


class EscalationEngine:

    @classmethod
    def evaluate_and_escalate(
        cls,
        db: Session,
        application: Application,
        sla_configs: Dict[str, SLAConfig],
        current_time: datetime,
    ) -> List[EscalationEvent]:
        """
        Evaluates SLA for all steps of an application, detects threshold breaches,
        and creates auditable EscalationEvents.
        Idempotency guarantee: If an escalation event already exists for a step at the configured level,
        it will NOT be recreated.
        """
        new_or_existing_escalations: List[EscalationEvent] = []

        for step in application.steps:
            config = sla_configs.get(step.requirement_id)
            sla_res: SLACalculationResult = SLAEngine.calculate_step_sla(step, config, current_time)

            # Check if escalation conditions are met:
            # 1. Step must be OVERDUE
            # 2. Config must exist
            # 3. Days overdue must meet or exceed escalation_threshold_days
            if sla_res.status == SLAStatus.OVERDUE and config is not None:
                if sla_res.days_overdue >= config.escalation_threshold_days:
                    # Check Idempotency: Does an active or triggered event already exist for this step & level?
                    existing_event = db.query(EscalationEvent).filter(
                        EscalationEvent.approval_step_id == step.id,
                        EscalationEvent.level == config.escalation_level,
                        EscalationEvent.status.in_([EscalationStatus.TRIGGERED, EscalationStatus.ACKNOWLEDGED]),
                    ).first()

                    if existing_event:
                        new_or_existing_escalations.append(existing_event)
                        continue

                    # If no recipient role configured, flag ESCALATION_CONFIGURATION_REQUIRED
                    recipient = config.escalation_recipient_role or "ESCALATION_CONFIGURATION_REQUIRED"

                    reason = (
                        f"Approval step '{step.step_name}' exceeded configured SLA deadline "
                        f"by {sla_res.days_overdue:.1f} days (Threshold: {config.escalation_threshold_days} days). "
                        f"Escalated to internal tier {config.escalation_level} ({recipient})."
                    )

                    event = EscalationEvent(
                        application_id=application.id,
                        approval_step_id=step.id,
                        requirement_id=step.requirement_id,
                        sla_id=config.sla_id,
                        trigger_type="OVERDUE_THRESHOLD_BREACH",
                        level=config.escalation_level,
                        recipient_role=recipient,
                        days_overdue=sla_res.days_overdue,
                        reason=reason,
                        status=EscalationStatus.TRIGGERED,
                        triggered_at=current_time,
                    )
                    db.add(event)
                    db.flush()

                    record_audit(
                        db=db,
                        action="sla_escalation_triggered",
                        entity_type="escalation_event",
                        entity_id=event.id,
                        new_value={
                            "application_id": application.id,
                            "step_id": step.id,
                            "requirement_id": step.requirement_id,
                            "level": config.escalation_level,
                            "recipient_role": recipient,
                            "days_overdue": sla_res.days_overdue,
                        },
                    )

                    new_or_existing_escalations.append(event)

        db.commit()
        return new_or_existing_escalations

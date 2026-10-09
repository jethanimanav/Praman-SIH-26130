"""
SLA Engine.

Provides deterministic, configuration-driven calculation of SLA status,
elapsed duration, remaining duration, deadline, warning threshold, and overdue state.

Core invariants:
- ClockService.now() is the sole time authority.
- No AI/LLM guesswork: missing configurations yield SLA_VERIFICATION_REQUIRED.
- Paused intervals extend deadlines deterministically.
- Completed steps freeze their elapsed time and stop timer progression.
"""
from datetime import datetime, timedelta
from typing import Optional
from app.models.workflow import ApprovalStep, StepStatus
from app.sla.schema import SLAConfig, SLACalculationResult, SLAStatus


class SLAEngine:

    @classmethod
    def calculate_step_sla(
        cls,
        step: ApprovalStep,
        config: Optional[SLAConfig],
        current_time: datetime,
    ) -> SLACalculationResult:
        """
        Calculates the SLA metrics and deterministic status for a single ApprovalStep.
        """
        req_id = step.requirement_id

        # 1. Check if SLA configuration exists
        if not config:
            return SLACalculationResult(
                requirement_id=req_id,
                sla_id=None,
                status=SLAStatus.SLA_VERIFICATION_REQUIRED,
                duration_days=None,
                started_at=step.started_at,
                completed_at=step.completed_at,
                deadline=None,
                elapsed_days=0.0,
                remaining_days=0.0,
                days_overdue=0.0,
                warning_threshold_pct=80.0,
                is_warning=False,
                is_overdue=False,
                is_paused=step.is_paused,
                paused_seconds=step.total_paused_seconds,
                data_status="VERIFICATION_REQUIRED",
                calendar_note="SLA_CALENDAR_VERIFICATION_REQUIRED",
            )

        duration_days = config.duration_days
        warning_threshold_pct = config.warning_threshold * 100.0

        # 2. Check if step has started
        if not step.started_at or step.status in (StepStatus.BLOCKED, StepStatus.READY):
            return SLACalculationResult(
                requirement_id=req_id,
                sla_id=config.sla_id,
                status=SLAStatus.NOT_STARTED,
                duration_days=duration_days,
                started_at=step.started_at,
                completed_at=step.completed_at,
                deadline=None,
                elapsed_days=0.0,
                remaining_days=float(duration_days),
                days_overdue=0.0,
                warning_threshold_pct=warning_threshold_pct,
                is_warning=False,
                is_overdue=False,
                is_paused=step.is_paused,
                paused_seconds=step.total_paused_seconds,
                data_status=config.data_status.value,
            )

        # 3. Calculate accumulated paused time
        paused_seconds = step.total_paused_seconds
        if step.is_paused and step.paused_at:
            # Currently active pause
            paused_seconds += int((current_time - step.paused_at).total_seconds())

        paused_delta = timedelta(seconds=max(0, paused_seconds))

        # Base deadline = started_at + duration_days + total_paused_delta
        base_duration = timedelta(days=duration_days)
        deadline = step.started_at + base_duration + paused_delta

        # Determine reference time for elapsed calculation
        # If completed, frozen at completed_at; otherwise evaluated against current_time
        if step.status in (StepStatus.APPROVED, StepStatus.REJECTED) and step.completed_at:
            ref_time = step.completed_at
            # When completed, pause accumulator is fixed
            effective_elapsed_seconds = (ref_time - step.started_at).total_seconds() - step.total_paused_seconds
            effective_elapsed_days = max(0.0, effective_elapsed_seconds / 86400.0)

            # Check if it was completed before or after deadline
            was_overdue = ref_time > deadline
            days_overdue = max(0.0, (ref_time - deadline).total_seconds() / 86400.0) if was_overdue else 0.0

            return SLACalculationResult(
                requirement_id=req_id,
                sla_id=config.sla_id,
                status=SLAStatus.COMPLETED,
                duration_days=duration_days,
                started_at=step.started_at,
                completed_at=step.completed_at,
                deadline=deadline,
                elapsed_days=round(effective_elapsed_days, 2),
                remaining_days=0.0,
                days_overdue=round(days_overdue, 2),
                warning_threshold_pct=warning_threshold_pct,
                is_warning=False,
                is_overdue=was_overdue,
                is_paused=False,
                paused_seconds=step.total_paused_seconds,
                data_status=config.data_status.value,
            )

        # 4. Currently Paused Step
        if step.is_paused:
            # Active pause
            effective_elapsed_seconds = (current_time - step.started_at).total_seconds() - paused_seconds
            effective_elapsed_days = max(0.0, effective_elapsed_seconds / 86400.0)
            remaining_seconds = max(0.0, (deadline - current_time).total_seconds())
            remaining_days = remaining_seconds / 86400.0

            return SLACalculationResult(
                requirement_id=req_id,
                sla_id=config.sla_id,
                status=SLAStatus.PAUSED,
                duration_days=duration_days,
                started_at=step.started_at,
                completed_at=None,
                deadline=deadline,
                elapsed_days=round(effective_elapsed_days, 2),
                remaining_days=round(remaining_days, 2),
                days_overdue=0.0,
                warning_threshold_pct=warning_threshold_pct,
                is_warning=False,
                is_overdue=False,
                is_paused=True,
                paused_seconds=paused_seconds,
                data_status=config.data_status.value,
            )

        # 5. Active In-Progress Step
        effective_elapsed_seconds = (current_time - step.started_at).total_seconds() - paused_seconds
        effective_elapsed_days = max(0.0, effective_elapsed_seconds / 86400.0)

        # Warning threshold cutoff
        warning_seconds = base_duration.total_seconds() * config.warning_threshold
        is_warning = effective_elapsed_seconds >= warning_seconds
        is_overdue = current_time > deadline

        if is_overdue:
            status = SLAStatus.OVERDUE
            remaining_days = 0.0
            days_overdue = (current_time - deadline).total_seconds() / 86400.0
        elif is_warning:
            status = SLAStatus.WARNING
            remaining_seconds = max(0.0, (deadline - current_time).total_seconds())
            remaining_days = remaining_seconds / 86400.0
            days_overdue = 0.0
        else:
            status = SLAStatus.ON_TRACK
            remaining_seconds = max(0.0, (deadline - current_time).total_seconds())
            remaining_days = remaining_seconds / 86400.0
            days_overdue = 0.0

        return SLACalculationResult(
            requirement_id=req_id,
            sla_id=config.sla_id,
            status=status,
            duration_days=duration_days,
            started_at=step.started_at,
            completed_at=None,
            deadline=deadline,
            elapsed_days=round(effective_elapsed_days, 2),
            remaining_days=round(remaining_days, 2),
            days_overdue=round(days_overdue, 2),
            warning_threshold_pct=warning_threshold_pct,
            is_warning=is_warning,
            is_overdue=is_overdue,
            is_paused=False,
            paused_seconds=paused_seconds,
            data_status=config.data_status.value,
        )

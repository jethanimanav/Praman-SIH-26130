import statistics
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from app.core.clock import ClockService
from app.models.workflow import Application, ApprovalStep, ApplicationStatus, StepStatus
from app.models.escalation import EscalationEvent
from app.models.document import Document, DocumentStatus
from app.models.inspection import JointInspection, InspectionStatus, InspectionReport, InspectionOutcome
from app.models.compliance import ComplianceFiling, ComplianceFilingStatus
from app.compliance.service import ComplianceService
from app.sla.schema import SLAStatus, EscalationStatus
from app.sla.engine import SLAEngine
from app.sla.loader import SLALoader
from app.analytics.schema import (
    ExecutiveKPIs,
    ExecutiveInsightItem,
    DepartmentPerformanceItem,
    SLAHealthDistribution,
    DocumentAnalyticsSummary,
    InspectionAnalyticsSummary,
    ComplianceAnalyticsSummary,
    AnalyticsOverviewResponse,
    AnalyticsTrendItem,
    AnalyticsTrendsResponse,
)


def _get_sla_data_dir() -> Path:
    p = Path("data/sla")
    if p.exists() and any(p.glob("*sla*.yaml")):
        return p
    alt = Path(__file__).resolve().parent.parent.parent / "data" / "sla"
    if alt.exists():
        return alt
    return p


class AnalyticsService:
    """
    Deterministic Analytics & Executive Insights Engine for ROP / PRAMAN.
    Aggregates facts directly from actual SQLite state across M0 through M9.
    Zero hallucination. Missing data surfaces None / INSUFFICIENT DATA.
    """

    @classmethod
    def get_overview(cls, db: Session) -> AnalyticsOverviewResponse:
        now = ClockService.now()
        sla_configs = SLALoader.load_from_directory(_get_sla_data_dir())

        # --- 1. Applications ---
        apps = db.query(Application).all()
        total_apps = len(apps)
        active_apps = sum(
            1 for a in apps if a.status in [ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.IN_REVIEW]
        )
        completed_apps = sum(1 for a in apps if a.status == ApplicationStatus.APPROVED)
        rejected_apps = sum(1 for a in apps if a.status == ApplicationStatus.REJECTED)

        # Processing days for completed applications
        proc_durations = []
        for a in apps:
            if a.status == ApplicationStatus.APPROVED and a.completed_at:
                start_dt = a.submitted_at or a.created_at
                if start_dt and a.completed_at >= start_dt:
                    proc_durations.append((a.completed_at - start_dt).total_seconds() / 86400.0)

        mean_proc_days = round(statistics.mean(proc_durations), 2) if proc_durations else None
        median_proc_days = round(statistics.median(proc_durations), 2) if proc_durations else None

        # --- 2. Approval Steps & SLA Health ---
        steps = db.query(ApprovalStep).options(joinedload(ApprovalStep.escalations)).all()
        sla_health_counts = {
            "ON_TRACK": 0,
            "WARNING": 0,
            "OVERDUE": 0,
            "PAUSED": 0,
            "COMPLETED": 0,
            "NOT_STARTED": 0,
            "SLA_VERIFICATION_REQUIRED": 0,
        }
        critical_overdue_count = 0
        sla_breach_count = 0
        completed_with_sla = 0
        completed_on_time = 0

        for step in steps:
            cfg = sla_configs.get(step.requirement_id)
            calc = SLAEngine.calculate_step_sla(step, cfg, now)
            status_val = calc.status.value
            sla_health_counts[status_val] = sla_health_counts.get(status_val, 0) + 1

            if calc.status == SLAStatus.OVERDUE:
                sla_breach_count += 1
                if step.is_critical_path:
                    critical_overdue_count += 1

            if step.status in [StepStatus.APPROVED, StepStatus.REJECTED] and cfg:
                completed_with_sla += 1
                # Check if it was on time
                if step.completed_at and step.started_at:
                    elapsed = (step.completed_at - step.started_at).total_seconds() / 86400.0
                    effective = max(0.0, elapsed - (step.total_paused_seconds / 86400.0))
                    if effective <= cfg.duration_days:
                        completed_on_time += 1

        sla_comp_rate = (
            round((completed_on_time / completed_with_sla) * 100.0, 1) if completed_with_sla > 0 else None
        )

        sla_health = SLAHealthDistribution(
            on_track=sla_health_counts["ON_TRACK"],
            warning=sla_health_counts["WARNING"],
            overdue=sla_health_counts["OVERDUE"],
            paused=sla_health_counts["PAUSED"],
            completed=sla_health_counts["COMPLETED"],
            not_started=sla_health_counts["NOT_STARTED"],
            sla_verification_required=sla_health_counts["SLA_VERIFICATION_REQUIRED"],
        )

        # --- 3. Escalations ---
        escalations = db.query(EscalationEvent).all()
        total_esc = len(escalations)
        active_esc = sum(
            1 for e in escalations if e.status in [EscalationStatus.TRIGGERED, EscalationStatus.ACKNOWLEDGED]
        )
        resolved_esc = sum(1 for e in escalations if e.status == EscalationStatus.RESOLVED)
        esc_rate = round(total_esc / len(steps), 3) if steps else None

        resolution_hours = []
        for e in escalations:
            if e.status == EscalationStatus.RESOLVED and e.resolved_at and e.triggered_at:
                delta = (e.resolved_at - e.triggered_at).total_seconds() / 3600.0
                if delta >= 0:
                    resolution_hours.append(delta)

        mean_res_hours = round(statistics.mean(resolution_hours), 1) if resolution_hours else None
        median_res_hours = round(statistics.median(resolution_hours), 1) if resolution_hours else None

        # --- 4. Documents ---
        docs = db.query(Document).filter(Document.is_current == True).all()
        doc_uploaded = len(docs)
        doc_accepted = sum(1 for d in docs if d.status == DocumentStatus.ACCEPTED)
        doc_under_review = sum(1 for d in docs if d.status == DocumentStatus.UNDER_REVIEW)
        doc_rejected = sum(1 for d in docs if d.status == DocumentStatus.REJECTED)
        doc_query_raised = sum(1 for d in docs if d.status == DocumentStatus.QUERY_RAISED)
        doc_backlog = sum(1 for d in docs if d.status in [DocumentStatus.UPLOADED, DocumentStatus.UNDER_REVIEW])

        review_durations = []
        for d in docs:
            if d.reviewed_at and d.uploaded_at and d.reviewed_at >= d.uploaded_at:
                review_durations.append((d.reviewed_at - d.uploaded_at).total_seconds() / 3600.0)

        avg_review_hours = round(statistics.mean(review_durations), 1) if review_durations else None

        doc_summary = DocumentAnalyticsSummary(
            total_uploaded=doc_uploaded,
            accepted=doc_accepted,
            under_review=doc_under_review,
            rejected=doc_rejected,
            query_raised=doc_query_raised,
            backlog=doc_backlog,
            average_review_hours=avg_review_hours,
        )

        # --- 5. Inspections & Facility Risk ---
        inspections = db.query(JointInspection).options(joinedload(JointInspection.report)).all()
        total_insp = len(inspections)
        insp_scheduled = sum(1 for i in inspections if i.status == InspectionStatus.SCHEDULED)
        insp_in_progress = sum(1 for i in inspections if i.status == InspectionStatus.IN_PROGRESS)
        insp_completed = sum(1 for i in inspections if i.status == InspectionStatus.COMPLETED)
        insp_cancelled = sum(1 for i in inspections if i.status == InspectionStatus.CANCELLED)
        insp_rescheduled = sum(1 for i in inspections if i.status == InspectionStatus.RESCHEDULED)
        insp_backlog = insp_scheduled + insp_in_progress

        satisfactory_count = 0
        deficiencies_count = 0
        non_compliant_count = 0
        risk_high = 0
        risk_med = 0
        risk_low = 0

        for i in inspections:
            rk = (i.risk_category or "LOW").upper()
            if rk == "HIGH":
                risk_high += 1
            elif rk == "MEDIUM":
                risk_med += 1
            else:
                risk_low += 1

            if i.report:
                if i.report.overall_outcome == InspectionOutcome.SATISFACTORY:
                    satisfactory_count += 1
                elif i.report.overall_outcome == InspectionOutcome.DEFICIENCIES_NOTED:
                    deficiencies_count += 1
                elif i.report.overall_outcome == InspectionOutcome.NON_COMPLIANT:
                    non_compliant_count += 1

        insp_summary = InspectionAnalyticsSummary(
            total_inspections=total_insp,
            scheduled=insp_scheduled,
            in_progress=insp_in_progress,
            completed=insp_completed,
            cancelled=insp_cancelled,
            rescheduled=insp_rescheduled,
            backlog=insp_backlog,
            satisfactory_count=satisfactory_count,
            deficiencies_noted_count=deficiencies_count,
            non_compliant_count=non_compliant_count,
            facilities_high_risk=risk_high,
            facilities_medium_risk=risk_med,
            facilities_low_risk=risk_low,
        )

        # --- 6. Ongoing Compliance ---
        filings = db.query(ComplianceFiling).all()
        comp_upcoming = 0
        comp_due_soon = 0
        comp_overdue = 0
        comp_submitted = 0
        comp_verified = 0
        comp_rejected = 0
        comp_penalty_active = 0

        for f in filings:
            current_status = f.status
            is_penalty = bool(f.penalty_risk_active)

            # Recalculate dynamic status if filing was in pending stages
            if current_status in [
                ComplianceFilingStatus.UPCOMING,
                ComplianceFilingStatus.DUE_SOON,
                ComplianceFilingStatus.OVERDUE,
            ] and f.due_date:
                delta_seconds = (f.due_date - now).total_seconds()
                days_remaining = int(delta_seconds // 86400)
                notice_days = f.lead_notice_days if f.lead_notice_days is not None else 15
                if delta_seconds < 0:
                    current_status = ComplianceFilingStatus.OVERDUE
                    is_penalty = True
                elif days_remaining <= notice_days:
                    current_status = ComplianceFilingStatus.DUE_SOON
                    is_penalty = False
                else:
                    current_status = ComplianceFilingStatus.UPCOMING
                    is_penalty = False

            if current_status == ComplianceFilingStatus.UPCOMING:
                comp_upcoming += 1
            elif current_status == ComplianceFilingStatus.DUE_SOON:
                comp_due_soon += 1
            elif current_status == ComplianceFilingStatus.OVERDUE:
                comp_overdue += 1
            elif current_status == ComplianceFilingStatus.SUBMITTED:
                comp_submitted += 1
            elif current_status == ComplianceFilingStatus.VERIFIED:
                comp_verified += 1
            elif current_status == ComplianceFilingStatus.REJECTED:
                comp_rejected += 1

            if is_penalty:
                comp_penalty_active += 1

        comp_summary = ComplianceAnalyticsSummary(
            total_filings=len(filings),
            upcoming=comp_upcoming,
            due_soon=comp_due_soon,
            overdue=comp_overdue,
            submitted=comp_submitted,
            verified=comp_verified,
            rejected=comp_rejected,
            penalty_risk_active=comp_penalty_active,
            verification_backlog=comp_submitted,
        )

        # --- 7. Executive KPIs ---
        kpis = ExecutiveKPIs(
            total_applications=total_apps,
            active_applications=active_apps,
            completed_applications=completed_apps,
            rejected_applications=rejected_apps,
            mean_processing_days=mean_proc_days,
            median_processing_days=median_proc_days,
            sla_breach_count=sla_breach_count,
            critical_path_overdue_count=critical_overdue_count,
            sla_compliance_rate=sla_comp_rate,
            total_escalations=total_esc,
            active_escalations=active_esc,
            resolved_escalations=resolved_esc,
            escalation_rate=esc_rate,
            mean_escalation_resolution_hours=mean_res_hours,
            median_escalation_resolution_hours=median_res_hours,
            document_review_backlog=doc_backlog,
            inspection_backlog=insp_backlog,
            compliance_overdue_count=comp_overdue,
        )

        # --- 8. Deterministic Executive Insights ---
        insights: List[ExecutiveInsightItem] = []

        if critical_overdue_count > 0:
            insights.append(
                ExecutiveInsightItem(
                    id="INSIGHT-CRIT-PATH",
                    priority="CRITICAL",
                    category="CRITICAL_PATH",
                    title="Critical Path Bottlenecks Detected",
                    message=f"{critical_overdue_count} critical-path approval milestone(s) are overdue, directly delaying overall facility commissioning.",
                    metric_value=f"{critical_overdue_count} overdue",
                )
            )

        if sla_breach_count > 0:
            insights.append(
                ExecutiveInsightItem(
                    id="INSIGHT-SLA-BREACH",
                    priority="CRITICAL",
                    category="SLA",
                    title="Statutory SLA Deadlines Breached",
                    message=f"{sla_breach_count} approval milestone(s) have exceeded statutory SLA turnaround limits across regulatory authorities.",
                    metric_value=f"{sla_breach_count} breaches",
                )
            )

        if active_esc > 0:
            insights.append(
                ExecutiveInsightItem(
                    id="INSIGHT-ACTIVE-ESC",
                    priority="WARNING",
                    category="ESCALATION",
                    title="Unresolved Departmental Escalations",
                    message=f"{active_esc} SLA escalation(s) remain active and require departmental or administrative intervention.",
                    metric_value=f"{active_esc} active",
                )
            )

        if doc_backlog > 0:
            insights.append(
                ExecutiveInsightItem(
                    id="INSIGHT-DOC-BACKLOG",
                    priority="WARNING",
                    category="DOCUMENTS",
                    title="Document Scrutiny Backlog",
                    message=f"{doc_backlog} submitted compliance dossier(s) currently awaiting officer scrutiny.",
                    metric_value=f"{doc_backlog} dossiers",
                )
            )

        if comp_overdue > 0:
            insights.append(
                ExecutiveInsightItem(
                    id="INSIGHT-COMPLIANCE-OVERDUE",
                    priority="WARNING",
                    category="COMPLIANCE",
                    title="Statutory Compliance Filings Overdue",
                    message=f"{comp_overdue} periodic compliance return(s) are overdue with active penalty risk.",
                    metric_value=f"{comp_overdue} overdue",
                )
            )

        if insp_backlog > 0:
            insights.append(
                ExecutiveInsightItem(
                    id="INSIGHT-INSP-SCHEDULED",
                    priority="INFO",
                    category="INSPECTIONS",
                    title="Synchronized Joint Inspections Active",
                    message=f"{insp_backlog} multi-department site visit(s) currently coordinated under Central Inspection System (CIS).",
                    metric_value=f"{insp_backlog} visits",
                )
            )

        if not insights:
            insights.append(
                ExecutiveInsightItem(
                    id="INSIGHT-OPTIMAL-OPS",
                    priority="INFO",
                    category="SLA",
                    title="Optimal Operational Performance",
                    message="All statutory approval milestones, SLA timelines, and compliance filings are operating within normal parameters.",
                    metric_value="100% on track",
                )
            )

        return AnalyticsOverviewResponse(
            kpis=kpis,
            insights=insights,
            sla_health=sla_health,
            document_health=doc_summary,
            inspection_health=insp_summary,
            compliance_health=comp_summary,
            data_status="DEMO",
            generated_at=now.isoformat(),
        )

    @classmethod
    def get_departments(cls, db: Session) -> List[DepartmentPerformanceItem]:
        now = ClockService.now()
        sla_configs = SLALoader.load_from_directory(_get_sla_data_dir())

        steps = db.query(ApprovalStep).options(joinedload(ApprovalStep.escalations)).all()

        dept_groups = {}
        for s in steps:
            dept = s.department or "DEPARTMENT_CONFIGURATION_REQUIRED"
            if dept not in dept_groups:
                dept_groups[dept] = []
            dept_groups[dept].append(s)

        results = []
        for dept_name, d_steps in sorted(dept_groups.items(), key=lambda x: x[0]):
            tot = len(d_steps)
            comp = sum(1 for s in d_steps if s.status == StepStatus.APPROVED)
            inp = sum(1 for s in d_steps if s.status == StepStatus.IN_PROGRESS)
            
            overdue_count = 0
            active_esc_count = 0
            completed_with_sla = 0
            completed_on_time = 0

            for s in d_steps:
                cfg = sla_configs.get(s.requirement_id)
                calc = SLAEngine.calculate_step_sla(s, cfg, now)
                if calc.status == SLAStatus.OVERDUE:
                    overdue_count += 1

                for e in s.escalations:
                    if e.status in [EscalationStatus.TRIGGERED, EscalationStatus.ACKNOWLEDGED]:
                        active_esc_count += 1

                if s.status == StepStatus.APPROVED and cfg and s.completed_at and s.started_at:
                    completed_with_sla += 1
                    elapsed = (s.completed_at - s.started_at).total_seconds() / 86400.0
                    effective = max(0.0, elapsed - (s.total_paused_seconds / 86400.0))
                    if effective <= cfg.duration_days:
                        completed_on_time += 1

            on_time_pct = (
                round((completed_on_time / completed_with_sla) * 100.0, 1) if completed_with_sla > 0 else None
            )

            results.append(
                DepartmentPerformanceItem(
                    department=dept_name,
                    total_steps=tot,
                    completed_steps=comp,
                    in_progress_steps=inp,
                    overdue_steps=overdue_count,
                    active_escalations=active_esc_count,
                    on_time_rate=on_time_pct,
                )
            )

        return results

    @classmethod
    def get_trends(cls, db: Session) -> AnalyticsTrendsResponse:
        apps = db.query(Application).all()
        escalations = db.query(EscalationEvent).all()

        if not apps and not escalations:
            return AnalyticsTrendsResponse(trends=[], insufficient_data=True, data_status="DEMO")

        monthly_data = {}

        for a in apps:
            if a.created_at:
                m_key = a.created_at.strftime("%Y-%m")
                if m_key not in monthly_data:
                    monthly_data[m_key] = {"created": 0, "completed": 0, "escalations": 0}
                monthly_data[m_key]["created"] += 1

            if a.status == ApplicationStatus.APPROVED and a.completed_at:
                m_key = a.completed_at.strftime("%Y-%m")
                if m_key not in monthly_data:
                    monthly_data[m_key] = {"created": 0, "completed": 0, "escalations": 0}
                monthly_data[m_key]["completed"] += 1

        for e in escalations:
            if e.triggered_at:
                m_key = e.triggered_at.strftime("%Y-%m")
                if m_key not in monthly_data:
                    monthly_data[m_key] = {"created": 0, "completed": 0, "escalations": 0}
                monthly_data[m_key]["escalations"] += 1

        trends = [
            AnalyticsTrendItem(
                month=m,
                applications_created=v["created"],
                applications_completed=v["completed"],
                escalations_triggered=v["escalations"],
            )
            for m, v in sorted(monthly_data.items(), key=lambda x: x[0])
        ]

        return AnalyticsTrendsResponse(trends=trends, insufficient_data=False, data_status="DEMO")

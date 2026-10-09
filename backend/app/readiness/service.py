from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.workflow import Application, ApplicationStatus, StepStatus
from app.models.business import Business, RegulatoryProfile
from app.models.project import Project
from app.models.document import Document, DocumentStatus
from app.models.query import DepartmentQuery, QueryStatus
from app.models.inspection import JointInspection, InspectionOutcome
from app.readiness.schema import (
    ReadinessSeverity,
    ReadinessCategory,
    ReadinessOverallStatus,
    ReadinessItem,
    ReadinessAssessment,
)
from app.core.clock import ClockService


class ReadinessService:
    """
    Deterministic Pre-Submission Readiness Assessment Service.
    Evaluates enterprise profile completeness, document dossier readiness,
    outstanding departmental queries, inspection outcomes, and validation blockers.
    """

    @classmethod
    def assess_application_readiness(
        cls,
        db: Session,
        application: Application,
    ) -> ReadinessAssessment:
        items: List[ReadinessItem] = []
        business = application.business
        profile: Optional[RegulatoryProfile] = business.regulatory_profile if business else None
        project: Optional[Project] = application.project

        # =========================================================================
        # 1. PROFILE & ENTERPRISE CHECKS
        # =========================================================================
        if not business:
            items.append(
                ReadinessItem(
                    id="RDY-BIZ-001",
                    title="Missing Business Association",
                    severity=ReadinessSeverity.BLOCKER,
                    category=ReadinessCategory.PROFILE,
                    description="Application does not have a linked commercial entity.",
                    action_needed="Link a valid business entity to this application.",
                    target_tab="overview",
                    is_blocking=True,
                )
            )
        elif profile and not profile.is_confirmed:
            items.append(
                ReadinessItem(
                    id="RDY-PRF-001",
                    title="Unconfirmed Regulatory Profile",
                    severity=ReadinessSeverity.BLOCKER,
                    category=ReadinessCategory.PROFILE,
                    description="The business regulatory intake profile has not been confirmed by the applicant.",
                    action_needed="Review and confirm your regulatory intake questions and parameters.",
                    target_tab="overview",
                    is_blocking=True,
                )
            )
        elif not profile:
            items.append(
                ReadinessItem(
                    id="RDY-PRF-002",
                    title="Intake Profile Pending",
                    severity=ReadinessSeverity.WARNING,
                    category=ReadinessCategory.PROFILE,
                    description="No formal regulatory intake profile is linked to this business.",
                    action_needed="Complete the regulatory intake questionnaire.",
                    target_tab="overview",
                    is_blocking=False,
                )
            )

        # Operational attributes check
        confirmed_data: Dict[str, Any] = profile.confirmed_data if profile and profile.confirmed_data else {}
        if project:
            if not project.district:
                items.append(
                    ReadinessItem(
                        id="RDY-PRJ-001",
                        title="Project District Not Specified",
                        severity=ReadinessSeverity.WARNING,
                        category=ReadinessCategory.PROFILE,
                        description="Location district is missing. Specific local municipal/MIDC rules require geographic jurisdiction.",
                        action_needed="Update project location details in the Project Workspace.",
                        target_tab="overview",
                        is_blocking=False,
                    )
                )
            if not project.power_load_kw and not confirmed_data.get("power_connected_kw"):
                items.append(
                    ReadinessItem(
                        id="RDY-PRJ-002",
                        title="Connected Power Load Missing",
                        severity=ReadinessSeverity.WARNING,
                        category=ReadinessCategory.PROFILE,
                        description="Electrical power load (kW) is not specified. DISCOM sub-station clearances depend on this value.",
                        action_needed="Specify the anticipated sanctioned contract demand load in kW.",
                        target_tab="overview",
                        is_blocking=False,
                    )
                )

        # =========================================================================
        # 2. DOCUMENT DOSSIER CHECKS
        # =========================================================================
        # Query all documents uploaded for this business/application
        docs = db.query(Document).filter(
            Document.business_id == application.business_id
        ).all()

        rejected_docs = [d for d in docs if d.status == DocumentStatus.REJECTED]
        for r_doc in rejected_docs:
            items.append(
                ReadinessItem(
                    id=f"RDY-DOC-REJ-{r_doc.id}",
                    title=f"Rejected Document: {r_doc.document_name}",
                    severity=ReadinessSeverity.BLOCKER,
                    category=ReadinessCategory.DOCUMENT,
                    description=f"Department officer rejected '{r_doc.original_filename}'. Scrutiny remarks: {r_doc.review_note or 'Deficiencies noted'}",
                    action_needed=f"Re-upload a compliant version of '{r_doc.document_name}' in the Document Vault.",
                    target_tab="documents",
                    is_blocking=True,
                )
            )

        # Check required regulatory documents across approval steps
        # Siting typically requires Land/Lease/Site Plan; CTE requires ETP/Consent; Factory requires Layout
        existing_doc_names = {d.document_name.lower() for d in docs}
        step_doc_expectations = {
            "REQ-SITING-001": ("Site Plan & Siting Layout", "site plan"),
            "REQ-ENV-CTE-001": ("Consent to Establish (CTE) DPR", "cte"),
            "REQ-FACTORY-001": ("Factory Layout & Machinery Plan", "factory"),
        }

        for step in application.steps:
            if step.requirement_id in step_doc_expectations:
                doc_title, doc_key = step_doc_expectations[step.requirement_id]
                has_doc = any(doc_key in dn for dn in existing_doc_names)
                if not has_doc and not docs:
                    # If completely no documents uploaded, raise a warning for initial guidance
                    items.append(
                        ReadinessItem(
                            id=f"RDY-DOC-REQ-{step.requirement_id}",
                            title=f"Missing Document: {doc_title}",
                            severity=ReadinessSeverity.WARNING,
                            category=ReadinessCategory.DOCUMENT,
                            description=f"Approval step '{step.step_name}' typically requires '{doc_title}' before statutory scrutiny.",
                            action_needed=f"Upload '{doc_title}' to ensure expedited processing.",
                            target_tab="documents",
                            is_blocking=False,
                        )
                    )

        # Documents awaiting scrutiny
        uploaded_docs = [d for d in docs if d.status in (DocumentStatus.UPLOADED, DocumentStatus.UNDER_REVIEW)]
        if uploaded_docs:
            items.append(
                ReadinessItem(
                    id="RDY-DOC-SCRUTINY",
                    title=f"{len(uploaded_docs)} Document(s) Awaiting Scrutiny",
                    severity=ReadinessSeverity.INFO,
                    category=ReadinessCategory.DOCUMENT,
                    description="Documents have been uploaded to the vault and are pending departmental officer verification.",
                    action_needed="No action required. Officer will review during the scrutiny milestone.",
                    target_tab="documents",
                    is_blocking=False,
                )
            )

        # =========================================================================
        # 3. DEPARTMENT QUERIES & CLARIFICATIONS
        # =========================================================================
        queries = db.query(DepartmentQuery).filter(
            DepartmentQuery.application_id == application.id
        ).all()

        open_queries = [q for q in queries if q.status == QueryStatus.OPEN]
        for q in open_queries:
            items.append(
                ReadinessItem(
                    id=f"RDY-QRY-{q.query_code}",
                    title=f"Unresolved Query: {q.query_code} ({q.subject})",
                    severity=ReadinessSeverity.BLOCKER,
                    category=ReadinessCategory.QUERY,
                    description=f"{q.department} has raised an active inquiry: {q.query_details}",
                    action_needed=f"Submit a formal clarification response in Tab 4 (Queries) before statutory deadline.",
                    target_tab="queries",
                    is_blocking=True,
                )
            )

        responded_queries = [q for q in queries if q.status == QueryStatus.RESPONDED]
        if responded_queries:
            items.append(
                ReadinessItem(
                    id="RDY-QRY-PENDING-DEPT",
                    title=f"{len(responded_queries)} Clarification(s) Under Department Review",
                    severity=ReadinessSeverity.INFO,
                    category=ReadinessCategory.QUERY,
                    description="You have responded to department inquiries; waiting for the inspecting officer to resolve.",
                    action_needed="Monitor query status for closure or additional clarifications.",
                    target_tab="queries",
                    is_blocking=False,
                )
            )

        # =========================================================================
        # 4. CENTRAL JOINT INSPECTION SYSTEM (CIS) CHECKS
        # =========================================================================
        inspections = db.query(JointInspection).filter(
            JointInspection.application_id == application.id
        ).all()

        for ins in inspections:
            if ins.report and ins.report.outcome == InspectionOutcome.NON_COMPLIANT:
                items.append(
                    ReadinessItem(
                        id=f"RDY-CIS-{ins.id}",
                        title="Joint Inspection Deficiencies Identified",
                        severity=ReadinessSeverity.BLOCKER,
                        category=ReadinessCategory.APPLICATION,
                        description=f"Inspection report flagged non-compliance: {ins.report.findings or 'Deficiencies noted'}",
                        action_needed="Rectify site non-compliances and contact department for re-inspection.",
                        target_tab="cis",
                        is_blocking=True,
                    )
                )

        # =========================================================================
        # 5. AGGREGATION & METRICS
        # =========================================================================
        blockers = [it for it in items if it.severity == ReadinessSeverity.BLOCKER]
        warnings = [it for it in items if it.severity == ReadinessSeverity.WARNING]
        infos = [it for it in items if it.severity == ReadinessSeverity.INFO]

        can_submit = (len(blockers) == 0)

        if len(blockers) > 0:
            overall_status = ReadinessOverallStatus.BLOCKED
        elif len(warnings) > 0:
            overall_status = ReadinessOverallStatus.NEEDS_ATTENTION
        else:
            overall_status = ReadinessOverallStatus.READY

        # Deterministic scoring: 100 - (30 * blockers) - (10 * warnings), floor 0
        raw_score = 100 - (len(blockers) * 30) - (len(warnings) * 10)
        readiness_score_pct = max(0, min(100, raw_score))

        # Informational item if score is 100%
        if readiness_score_pct == 100:
            items.append(
                ReadinessItem(
                    id="RDY-CLEAN-001",
                    title="All Technical Pre-Checks Passed",
                    severity=ReadinessSeverity.INFO,
                    category=ReadinessCategory.APPLICATION,
                    description="No blocking issues, unresolved queries, or rejected documents detected.",
                    action_needed="Proceed with application submission or stage progression.",
                    target_tab="overview",
                    is_blocking=False,
                )
            )

        return ReadinessAssessment(
            application_id=application.id,
            application_title=application.title,
            business_id=application.business_id,
            project_id=application.project_id,
            overall_status=overall_status,
            readiness_score_pct=readiness_score_pct,
            can_submit=can_submit,
            blocker_count=len(blockers),
            warning_count=len(warnings),
            info_count=len(infos),
            items=items,
            assessed_at=ClockService.now().isoformat(),
            data_status="DEMO",
        )

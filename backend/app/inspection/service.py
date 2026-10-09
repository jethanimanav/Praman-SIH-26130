from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.business import Business, RegulatoryProfile
from app.models.user import User, UserRole
from app.models.workflow import Application, ApprovalStep, StepStatus
from app.models.inspection import (
    JointInspection,
    InspectionReport,
    InspectionStatus,
    InspectionOutcome,
)
from app.risk.engine import RiskEngine
from app.risk.schema import RiskAssessmentResult
from app.inspection.schema import (
    ScheduleInspectionRequest,
    RescheduleInspectionRequest,
    SubmitInspectionReportRequest,
    JointInspectionItem,
    InspectionReportItem,
    ApplicationInspectionsResponse,
)
from app.core.audit import record_audit
from app.core.clock import ClockService


class InspectionService:

    @classmethod
    def get_application_profile_data(cls, db: Session, application: Application) -> Dict[str, Any]:
        """Extracts confirmed regulatory profile data for risk assessment."""
        profile = db.query(RegulatoryProfile).filter(
            RegulatoryProfile.business_id == application.business_id
        ).first()
        if not profile:
            return {}
        return profile.confirmed_data or profile.extracted_data or {}

    @classmethod
    def assess_application_risk(cls, db: Session, application_id: int) -> RiskAssessmentResult:
        """Deterministically evaluates composite risk for the application's business."""
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application #{application_id} not found",
            )
        data = cls.get_application_profile_data(db, app)
        return RiskEngine.evaluate_risk(data)

    @classmethod
    def schedule_joint_inspection(
        cls,
        db: Session,
        application_id: int,
        user: User,
        req: ScheduleInspectionRequest,
    ) -> JointInspection:
        """
        Coordinates and schedules a single unified Joint Inspection visit
        across all approving regulatory bodies for the application.
        """
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application #{application_id} not found",
            )

        # Check existing scheduled inspection
        active_existing = db.query(JointInspection).filter(
            JointInspection.application_id == application_id,
            JointInspection.status.in_([InspectionStatus.SCHEDULED, InspectionStatus.IN_PROGRESS]),
        ).first()
        if active_existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An active joint inspection #{active_existing.id} is already scheduled for this application",
            )

        # Run risk assessment
        risk_res = cls.assess_application_risk(db, application_id)

        # Aggregate participating departments from application approval steps
        step_depts = [
            s.department for s in application.steps
            if s.department and s.department != "None"
        ]
        # Combine with risk-mandated departments
        participating_departments = list(dict.fromkeys(risk_res.mandated_departments + step_depts))
        if not participating_departments:
            participating_departments = ["State Pollution Control Board (DEMO)", "Directorate of Industrial Safety & Health (DEMO)"]

        # Aggregate checklist items
        combined_checklist = list(dict.fromkeys(risk_res.inspection_checklist + (req.custom_checklist or [])))
        if not combined_checklist:
            combined_checklist = [
                "Verify boundary setback and land siting clearance",
                "Inspect factory building layout and emergency exits",
                "Review environmental pollution prevention apparatus",
            ]

        # Determine lead inspector: if scheduling user is officer/admin, assign them; else pick a demo officer
        lead_officer_id = user.id if user.role in (UserRole.OFFICER, UserRole.ADMIN) else None
        if not lead_officer_id:
            officer_user = db.query(User).filter(User.role == UserRole.OFFICER, User.is_active == True).first()
            lead_officer_id = officer_user.id if officer_user else user.id

        inspection = JointInspection(
            application_id=application.id,
            business_id=application.business_id,
            scheduled_date=req.scheduled_date,
            time_slot=req.time_slot,
            status=InspectionStatus.SCHEDULED,
            risk_category=risk_res.risk_category.value,
            lead_inspector_id=lead_officer_id,
            participating_departments=participating_departments,
            checklist_items=combined_checklist,
            notes=req.notes,
            data_status="DEMO",
            created_at=ClockService.now(),
            updated_at=ClockService.now(),
        )
        db.add(inspection)
        db.flush()

        record_audit(
            db=db,
            action="joint_inspection_scheduled",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="joint_inspection",
            entity_id=inspection.id,
            new_value={
                "application_id": application.id,
                "scheduled_date": req.scheduled_date.isoformat(),
                "time_slot": req.time_slot,
                "risk_category": risk_res.risk_category.value,
                "participating_departments": participating_departments,
                "lead_inspector_id": lead_officer_id,
            },
        )
        db.commit()
        db.refresh(inspection)
        return inspection

    @classmethod
    def reschedule_joint_inspection(
        cls,
        db: Session,
        inspection_id: int,
        user: User,
        req: RescheduleInspectionRequest,
    ) -> JointInspection:
        """Reschedules an existing inspection with reason logging."""
        inspection = db.query(JointInspection).filter(JointInspection.id == inspection_id).first()
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Joint inspection #{inspection_id} not found",
            )

        if inspection.status in (InspectionStatus.COMPLETED, InspectionStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reschedule inspection in status {inspection.status.value}",
            )

        if not req.reason or not req.reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid reason is required to reschedule an inspection",
            )

        prev_date = inspection.scheduled_date
        prev_slot = inspection.time_slot

        inspection.scheduled_date = req.scheduled_date
        inspection.time_slot = req.time_slot
        inspection.status = InspectionStatus.RESCHEDULED
        inspection.notes = (inspection.notes or "") + f"\n[Rescheduled by {user.email}]: {req.reason.strip()}"
        inspection.updated_at = ClockService.now()

        record_audit(
            db=db,
            action="joint_inspection_rescheduled",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="joint_inspection",
            entity_id=inspection.id,
            previous_value={
                "scheduled_date": prev_date.isoformat() if prev_date else None,
                "time_slot": prev_slot,
            },
            new_value={
                "scheduled_date": req.scheduled_date.isoformat(),
                "time_slot": req.time_slot,
                "reason": req.reason.strip(),
            },
        )
        db.commit()
        db.refresh(inspection)
        return inspection

    @classmethod
    def submit_inspection_report(
        cls,
        db: Session,
        inspection_id: int,
        officer: User,
        req: SubmitInspectionReportRequest,
    ) -> InspectionReport:
        """
        Records the official findings of the Joint Inspection team.
        Enforces mandatory explanations for deficiencies or non-compliance.
        """
        inspection = db.query(JointInspection).filter(JointInspection.id == inspection_id).first()
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Joint inspection #{inspection_id} not found",
            )

        if inspection.report:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Inspection report already exists for inspection #{inspection_id}",
            )

        # Validation: If deficiencies or non-compliant, require non-empty notes
        if req.overall_outcome in (InspectionOutcome.DEFICIENCIES_NOTED, InspectionOutcome.NON_COMPLIANT):
            if not req.deficiencies and not req.corrective_actions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Deficiencies list or corrective actions are mandatory when outcome is {req.overall_outcome.value}",
                )

        report = InspectionReport(
            joint_inspection_id=inspection.id,
            submitted_by_id=officer.id,
            submitted_at=ClockService.now(),
            overall_outcome=req.overall_outcome,
            department_findings=req.department_findings or {},
            deficiencies=req.deficiencies or [],
            corrective_actions=req.corrective_actions,
            reinspection_required=req.reinspection_required,
            compliance_deadline=req.compliance_deadline,
            created_at=ClockService.now(),
        )
        db.add(report)

        # Mark inspection COMPLETED
        inspection.status = InspectionStatus.COMPLETED
        inspection.updated_at = ClockService.now()

        # If SATISFACTORY, annotate application approval steps with inspection clearance
        if req.overall_outcome == InspectionOutcome.SATISFACTORY:
            for step in inspection.application.steps:
                if step.department in inspection.participating_departments:
                    step.notes = (step.notes or "") + f" [Joint Inspection #{inspection.id} CLEARED on {ClockService.now().strftime('%Y-%m-%d')}]"
                    step.updated_at = ClockService.now()

        record_audit(
            db=db,
            action="inspection_report_submitted",
            user_id=officer.id,
            user_email=officer.email,
            user_role=officer.role.value,
            entity_type="inspection_report",
            entity_id=inspection.id,
            new_value={
                "inspection_id": inspection.id,
                "overall_outcome": req.overall_outcome.value,
                "reinspection_required": req.reinspection_required,
                "deficiencies_count": len(req.deficiencies or []),
            },
        )
        db.commit()
        db.refresh(report)
        return report

    @classmethod
    def get_joint_inspection_detail(cls, db: Session, inspection_id: int) -> JointInspectionItem:
        """Retrieves formatted joint inspection detail."""
        inspection = db.query(JointInspection).filter(JointInspection.id == inspection_id).first()
        if not inspection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Joint inspection #{inspection_id} not found",
            )
        return cls._serialize_joint_inspection(inspection)

    @classmethod
    def get_application_inspections(cls, db: Session, application_id: int) -> ApplicationInspectionsResponse:
        """Retrieves all joint inspections for an application with risk summary."""
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application #{application_id} not found",
            )

        risk_res = cls.assess_application_risk(db, application_id)
        inspections = db.query(JointInspection).filter(
            JointInspection.application_id == application_id
        ).order_by(JointInspection.id.desc()).all()

        items = [cls._serialize_joint_inspection(insp) for insp in inspections]

        return ApplicationInspectionsResponse(
            application_id=app.id,
            business_name=app.business.name if app.business else "Unknown",
            risk_category=risk_res.risk_category.value,
            composite_score=risk_res.composite_score,
            joint_inspection_mandatory=risk_res.joint_inspection_mandatory,
            inspections=items,
        )

    @classmethod
    def get_officer_inspections(
        cls,
        db: Session,
        officer: User,
        status_filter: Optional[InspectionStatus] = None,
    ) -> List[JointInspectionItem]:
        """Lists joint inspections for officers to view and manage."""
        query = db.query(JointInspection)
        if status_filter:
            query = query.filter(JointInspection.status == status_filter)

        inspections = query.order_by(JointInspection.scheduled_date.asc(), JointInspection.id.desc()).all()
        return [cls._serialize_joint_inspection(insp) for insp in inspections]

    @classmethod
    def _serialize_joint_inspection(cls, insp: JointInspection) -> JointInspectionItem:
        report_item = None
        if insp.report:
            rep = insp.report
            report_item = InspectionReportItem(
                id=rep.id,
                joint_inspection_id=rep.joint_inspection_id,
                submitted_by_id=rep.submitted_by_id,
                submitted_by_name=rep.submitted_by.full_name if rep.submitted_by else None,
                submitted_at=rep.submitted_at,
                overall_outcome=rep.overall_outcome,
                department_findings=rep.department_findings or {},
                deficiencies=rep.deficiencies or [],
                corrective_actions=rep.corrective_actions,
                reinspection_required=rep.reinspection_required,
                compliance_deadline=rep.compliance_deadline,
            )

        return JointInspectionItem(
            id=insp.id,
            application_id=insp.application_id,
            business_id=insp.business_id,
            business_name=insp.business.name if insp.business else None,
            scheduled_date=insp.scheduled_date,
            time_slot=insp.time_slot,
            status=insp.status,
            risk_category=insp.risk_category,
            lead_inspector_id=insp.lead_inspector_id,
            lead_inspector_name=insp.lead_inspector.full_name if insp.lead_inspector else None,
            participating_departments=insp.participating_departments or [],
            checklist_items=insp.checklist_items or [],
            notes=insp.notes,
            data_status=insp.data_status,
            created_at=insp.created_at,
            report=report_item,
        )

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.workflow import Application
from app.models.inspection import JointInspection, InspectionStatus
from app.api.deps import get_current_user, OfficerUser
from app.risk.schema import RiskAssessmentResult
from app.inspection.schema import (
    JointInspectionItem,
    InspectionReportItem,
    ScheduleInspectionRequest,
    RescheduleInspectionRequest,
    SubmitInspectionReportRequest,
    ApplicationInspectionsResponse,
)
from app.inspection.service import InspectionService

router = APIRouter(tags=["Inspections & Risk Assessment"])


def verify_application_access(application_id: int, user: User, db: Session) -> Application:
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application #{application_id} not found",
        )
    if user.role == UserRole.APPLICANT and app.applicant_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not own this application",
        )
    return app


# ==========================================
# Application Risk & Inspection Endpoints
# ==========================================

@router.get(
    "/api/workflow/applications/{id}/risk-assessment",
    response_model=RiskAssessmentResult,
    summary="Get application risk assessment and inspection mandates",
)
def get_application_risk(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_application_access(id, current_user, db)
    return InspectionService.assess_application_risk(db, id)


@router.get(
    "/api/workflow/applications/{id}/inspections",
    response_model=ApplicationInspectionsResponse,
    summary="List joint inspections for an application",
)
def get_application_inspections(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_application_access(id, current_user, db)
    return InspectionService.get_application_inspections(db, id)


@router.post(
    "/api/workflow/applications/{id}/inspections/schedule",
    response_model=JointInspectionItem,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a multi-department joint inspection",
)
def schedule_joint_inspection(
    id: int,
    req: ScheduleInspectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_application_access(id, current_user, db)
    inspection = InspectionService.schedule_joint_inspection(db, id, current_user, req)
    return InspectionService.get_joint_inspection_detail(db, inspection.id)


@router.post(
    "/api/workflow/applications/{id}/inspections/{inspection_id}/reschedule",
    response_model=JointInspectionItem,
    summary="Reschedule a joint inspection",
)
def reschedule_joint_inspection(
    id: int,
    inspection_id: int,
    req: RescheduleInspectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_application_access(id, current_user, db)
    inspection = InspectionService.reschedule_joint_inspection(db, inspection_id, current_user, req)
    return InspectionService.get_joint_inspection_detail(db, inspection.id)


# ==========================================
# Officer Inspection Management Endpoints
# ==========================================


@router.get(
    "/api/officer/inspections",
    response_model=List[JointInspectionItem],
    summary="Officer queue of joint inspections",
)
def get_officer_inspections(
    status_filter: Optional[InspectionStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    officer: OfficerUser = None,
):
    return InspectionService.get_officer_inspections(db, officer, status_filter)


@router.get(
    "/api/officer/inspections/{id}",
    response_model=JointInspectionItem,
    summary="Get single joint inspection detail",
)
def get_officer_inspection_detail(
    id: int,
    db: Session = Depends(get_db),
    officer: OfficerUser = None,
):
    return InspectionService.get_joint_inspection_detail(db, id)


@router.post(
    "/api/officer/inspections/{id}/report",
    response_model=InspectionReportItem,
    status_code=status.HTTP_201_CREATED,
    summary="Submit official joint inspection report",
)
def submit_officer_inspection_report(
    id: int,
    req: SubmitInspectionReportRequest,
    db: Session = Depends(get_db),
    officer: OfficerUser = None,
):
    report = InspectionService.submit_inspection_report(db, id, officer, req)
    return InspectionReportItem(
        id=report.id,
        joint_inspection_id=report.joint_inspection_id,
        submitted_by_id=report.submitted_by_id,
        submitted_by_name=report.submitted_by.full_name if report.submitted_by else None,
        submitted_at=report.submitted_at,
        overall_outcome=report.overall_outcome,
        department_findings=report.department_findings or {},
        deficiencies=report.deficiencies or [],
        corrective_actions=report.corrective_actions,
        reinspection_required=report.reinspection_required,
        compliance_deadline=report.compliance_deadline,
    )

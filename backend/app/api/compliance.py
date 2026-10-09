from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.business import Business
from app.models.workflow import Application
from app.api.deps import get_current_user, OfficerUser
from app.schemes.schema import SchemesAssessmentResult
from app.schemes.engine import SchemesEngine
from app.compliance.schema import (
    ComplianceCalendarResponse,
    ComplianceFilingItem,
    SubmitComplianceFilingRequest,
    VerifyComplianceFilingRequest,
)
from app.compliance.service import ComplianceService

router = APIRouter(tags=["Schemes & Post-Approval Ongoing Compliance"])


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
# Schemes & Subsidies Discovery Endpoint
# ==========================================

@router.get(
    "/api/business/{business_id}/schemes",
    response_model=SchemesAssessmentResult,
    summary="Evaluate government schemes, incentives and subsidy eligibility for a business",
)
def get_business_schemes(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business #{business_id} not found",
        )

    if current_user.role == UserRole.APPLICANT and business.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not own this business",
        )

    profile = business.regulatory_profile
    profile_data = profile.confirmed_data if (profile and profile.is_confirmed) else (profile.extracted_data if profile else {})

    return SchemesEngine.evaluate_schemes(
        business_id=business.id,
        business_name=business.name,
        profile_data=profile_data,
    )


class SchemeQuestionnaireRequest(BaseModel):
    answers: Dict[str, Any]


@router.post(
    "/api/business/{business_id}/schemes/interactive-assessment",
    response_model=SchemesAssessmentResult,
    summary="Interactive questionnaire assessment for government schemes",
)
def interactive_scheme_assessment(
    business_id: int,
    req: SchemeQuestionnaireRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business #{business_id} not found",
        )

    if current_user.role == UserRole.APPLICANT and business.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not own this business",
        )

    profile = business.regulatory_profile
    base_data = dict(profile.confirmed_data) if (profile and profile.is_confirmed and profile.confirmed_data) else (dict(profile.extracted_data) if (profile and profile.extracted_data) else {})
    merged = {**base_data, **req.answers}

    return SchemesEngine.evaluate_schemes(
        business_id=business.id,
        business_name=business.name,
        profile_data=merged,
    )


@router.get(
    "/api/projects/{project_id}/schemes",
    response_model=SchemesAssessmentResult,
    summary="Evaluate government schemes for a project",
)
def get_project_schemes(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.project import Project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project #{project_id} not found",
        )
    business = project.business
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project has no associated business",
        )
    if current_user.role == UserRole.APPLICANT and business.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not own this project",
        )

    profile = business.regulatory_profile
    base_data = dict(profile.confirmed_data) if (profile and profile.is_confirmed and profile.confirmed_data) else (dict(profile.extracted_data) if (profile and profile.extracted_data) else {})
    if project.power_load_kw:
        base_data["power_connected_kw"] = project.power_load_kw
    if project.built_up_area_sqm:
        base_data["built_up_area_sqm"] = project.built_up_area_sqm
    if project.workforce_count:
        base_data["workers_count"] = project.workforce_count
    if project.hazardous_waste:
        base_data["hazardous_waste_generated"] = project.hazardous_waste

    return SchemesEngine.evaluate_schemes(
        business_id=business.id,
        business_name=f"{business.name} ({project.name})",
        profile_data=base_data,
    )


# ===================================================
# Post-Approval Ongoing Compliance Calendar Endpoints
# ===================================================

@router.get(
    "/api/workflow/applications/{id}/compliance-calendar",
    response_model=ComplianceCalendarResponse,
    summary="Get 12-month projected post-approval periodic compliance calendar",
)
def get_compliance_calendar(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_application_access(id, current_user, db)
    return ComplianceService.get_calendar_response(db, id)


@router.post(
    "/api/workflow/applications/{id}/compliance-filings/{filing_id}/submit",
    response_model=ComplianceFilingItem,
    summary="Submit periodic compliance return filing",
)
def submit_compliance_filing(
    id: int,
    filing_id: int,
    payload: SubmitComplianceFilingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_application_access(id, current_user, db)
    return ComplianceService.submit_filing(
        db=db,
        application_id=id,
        filing_id=filing_id,
        user=current_user,
        payload=payload,
    )


# ==========================================
# Officer Periodic Compliance Queue Endpoints
# ==========================================

@router.get(
    "/api/officer/compliance-filings",
    response_model=List[ComplianceFilingItem],
    summary="Get officer queue of periodic compliance filings",
)
def get_officer_compliance_filings(
    status: Optional[str] = Query(None, description="Optional status filter e.g. SUBMITTED, VERIFIED, OVERDUE"),
    db: Session = Depends(get_db),
    officer: OfficerUser = None,
):
    return ComplianceService.get_officer_filings_queue(
        db=db,
        officer=officer,
        status_filter=status,
    )


@router.post(
    "/api/officer/compliance-filings/{filing_id}/verify",
    response_model=ComplianceFilingItem,
    summary="Officer verify or reject periodic compliance filing",
)
def verify_officer_compliance_filing(
    filing_id: int,
    payload: VerifyComplianceFilingRequest,
    db: Session = Depends(get_db),
    officer: OfficerUser = None,
):
    return ComplianceService.verify_filing(
        db=db,
        filing_id=filing_id,
        officer=officer,
        payload=payload,
    )

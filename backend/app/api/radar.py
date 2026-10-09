from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import CurrentUser, OfficerUser
from app.models.project import Project
from app.models.user import UserRole
from app.radar.schema import (
    RegulatorySourceResponse,
    CreateRegulatorySourceRequest,
    RegulatoryChangeRecordResponse,
    CreateRegulatoryChangeRequest,
    RadarImpactDashboardResponse,
    ProjectImpactAssessmentResponse,
    ReviewImpactRequest,
)
from app.radar.service import RadarService

router = APIRouter(prefix="/api/radar", tags=["radar"])


@router.get("/sources", response_model=List[RegulatorySourceResponse])
def get_regulatory_sources(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """List registered official and verified regulatory sources."""
    sources = RadarService.list_sources(db)
    return [RegulatorySourceResponse.model_validate(s) for s in sources]


@router.post("/sources", response_model=RegulatorySourceResponse, status_code=status.HTTP_201_CREATED)
def create_regulatory_source(
    req: CreateRegulatorySourceRequest,
    current_user: OfficerUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Register a new regulatory source (Officer/Admin only)."""
    source = RadarService.create_source(db, req)
    return RegulatorySourceResponse.model_validate(source)


@router.get("/changes", response_model=List[RegulatoryChangeRecordResponse])
def get_regulatory_changes(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """List tracked regulatory changes, gazette notifications, and circulars."""
    changes = RadarService.list_changes(db)
    return [RegulatoryChangeRecordResponse.model_validate(c) for c in changes]


@router.post("/changes", response_model=RegulatoryChangeRecordResponse, status_code=status.HTTP_201_CREATED)
def create_regulatory_change(
    req: CreateRegulatoryChangeRequest,
    current_user: OfficerUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Record a new regulatory change (Officer/Admin only)."""
    change = RadarService.create_change(db, req)
    return RegulatoryChangeRecordResponse.model_validate(change)


@router.get("/projects/{project_id}/impacts", response_model=RadarImpactDashboardResponse)
def get_project_radar_impacts(
    project_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Evaluates regulatory change impacts for a specific industrial project.
    Groups into Potentially Affected, Needs Review, and No Configured Match.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Tenant authorization
    if current_user.role == UserRole.APPLICANT:
        if project.business and project.business.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized access to project regulatory radar",
            )

    return RadarService.evaluate_project_impacts(db, project)


@router.post("/impacts/{impact_id}/review", response_model=ProjectImpactAssessmentResponse)
def review_project_impact(
    impact_id: int,
    req: ReviewImpactRequest,
    current_user: OfficerUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Review and record determination on a project impact assessment (Officer/Admin only)."""
    impact = RadarService.review_impact(db, impact_id, current_user, req)
    authority = impact.change.source.issuing_authority if impact.change and impact.change.source else "Statutory Authority"
    return ProjectImpactAssessmentResponse(
        id=impact.id,
        project_id=impact.project_id,
        change_id=impact.change_id,
        change_title=impact.change.title if impact.change else "Unknown Change",
        change_code=impact.change.change_code if impact.change else "UNKNOWN",
        impact_level=impact.impact_level,
        explanation=impact.explanation,
        matched_attributes=impact.matched_attributes,
        review_status=impact.review_status,
        review_notes=impact.review_notes,
        reviewed_at=impact.reviewed_at,
        recommended_action=impact.change.recommended_action if impact.change else None,
        issuing_authority=authority,
        verification_status=impact.change.verification_status if impact.change else "DEMO",
    )

from datetime import datetime
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.business import Business
from app.models.user import User, UserRole
from app.models.workflow import (
    Application,
    ApprovalStep,
    ApplicationStatus,
    StepStatus,
)
from app.api.deps import get_current_active_user, require_role
from app.workflow.service import WorkflowService
from app.workflow.draft_schema import (
    UpdateDraftRequest,
    ApplicationVersionResponse,
    RestoreVersionRequest,
)
from app.workflow.draft_service import DraftService


router = APIRouter(prefix="/api/workflow", tags=["workflow"])


# --- Schemas ---

class CreateApplicationRequest(BaseModel):
    business_id: int
    project_id: Optional[int] = None
    title: Optional[str] = None


class StepTransitionRequest(BaseModel):
    target_status: StepStatus
    notes: Optional[str] = None


class ApprovalStepResponse(BaseModel):
    id: int
    application_id: int
    requirement_id: str
    step_name: str
    department: Optional[str] = None
    estimated_timeline_days: int
    status: StepStatus
    data_status: str
    prerequisites: List[str]
    is_critical_path: bool
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ApplicationDetailResponse(BaseModel):
    id: int
    business_id: int
    project_id: Optional[int] = None
    applicant_id: int
    title: str
    status: ApplicationStatus
    version: int = 1
    form_data: Optional[Dict[str, Any]] = None
    total_timeline_days: int
    critical_path_steps: List[str]
    submitted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    steps: List[ApprovalStepResponse]

    model_config = {"from_attributes": True}


class WorkflowGraphResponse(BaseModel):
    application_id: int
    application_title: str
    application_status: str
    total_timeline_days: int
    critical_path_steps: List[str]
    parallel_stages: List[List[str]]
    graph: Dict[str, Any]


# --- Endpoints ---

@router.post("/applications", response_model=ApplicationDetailResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: CreateApplicationRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Creates an Application and its ApprovalSteps directly from the business's confirmed regulatory discovery.
    Calculates initial critical path and step statuses (READY for roots, BLOCKED for dependents).
    """
    business = db.query(Business).filter(Business.id == payload.business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found",
        )

    # Check ownership (applicants can only create for their own business)
    if current_user.role == UserRole.APPLICANT and business.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized business access",
        )

    return WorkflowService.create_application_from_discovery(
        db=db,
        business=business,
        user=current_user,
        title=payload.title,
        project_id=payload.project_id,
    )



@router.get("/applications", response_model=List[ApplicationDetailResponse])
def list_applications(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
    business_id: Optional[int] = None,
    project_id: Optional[int] = None,
):
    """Lists applications for current user (or all if officer/admin), optionally filtered by business or project."""
    query = db.query(Application)
    if current_user.role == UserRole.APPLICANT:
        query = query.filter(Application.applicant_id == current_user.id)
    if business_id is not None:
        query = query.filter(Application.business_id == business_id)
    if project_id is not None:
        query = query.filter(Application.project_id == project_id)
    return query.order_by(Application.created_at.desc()).all()


@router.get("/applications/{application_id}", response_model=ApplicationDetailResponse)
def get_application(
    application_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Returns application details and list of approval steps."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized application access",
        )

    return application


@router.post("/applications/{application_id}/submit", response_model=ApplicationDetailResponse)
def submit_application(
    application_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Submits a DRAFT application for processing."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized application access",
        )

    return WorkflowService.submit_application(
        db=db,
        application=application,
        user=current_user,
    )


@router.put("/applications/{application_id}/draft", response_model=ApplicationDetailResponse)
def update_application_draft(
    application_id: int,
    payload: UpdateDraftRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Updates application draft with optimistic concurrency control (OCC).
    Saves form_data and generates an immutable version snapshot.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized application access",
        )

    return DraftService.save_draft(
        db=db,
        application=application,
        payload=payload,
        user=current_user,
    )


@router.get("/applications/{application_id}/versions", response_model=List[ApplicationVersionResponse])
def list_application_versions(
    application_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Lists all immutable version snapshots for an application."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized application access",
        )

    return DraftService.list_versions(db=db, application=application)


@router.get("/applications/{application_id}/versions/{version_number}", response_model=ApplicationVersionResponse)
def get_application_version(
    application_id: int,
    version_number: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieves full snapshot data for a specific historical version."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized application access",
        )

    return DraftService.get_version(db=db, application=application, version_number=version_number)


@router.post("/applications/{application_id}/versions/{version_number}/restore", response_model=ApplicationDetailResponse)
def restore_application_version(
    application_id: int,
    version_number: int,
    payload: RestoreVersionRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Restores application data from a previous version snapshot.
    Advances version monotonically without overwriting history.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized application access",
        )

    return DraftService.restore_version(
        db=db,
        application=application,
        version_number=version_number,
        user=current_user,
        change_summary=payload.change_summary,
    )


@router.post("/applications/{application_id}/steps/{step_id}/transition", response_model=ApprovalStepResponse)
def transition_step(
    application_id: int,
    step_id: int,
    payload: StepTransitionRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Transitions an approval step to a new status.
    Enforces milestone advance validation:
    - Rejects approval if prerequisite steps are not yet APPROVED.
    - Cascades to unblock downstream dependent steps when all prerequisites are met.
    - Officers and Admins can approve/reject; applicants can start steps or submit clarifications.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    # RBAC check: Applicants cannot mark steps APPROVED or REJECTED
    if current_user.role == UserRole.APPLICANT:
        if payload.target_status in (StepStatus.APPROVED, StepStatus.REJECTED):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only regulatory officers or admins may approve or reject approval steps",
            )
        if application.applicant_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized application access",
            )

    return WorkflowService.transition_step_status(
        db=db,
        application=application,
        step_id=step_id,
        target_status=payload.target_status,
        user=current_user,
        notes=payload.notes,
    )


@router.get("/applications/{application_id}/graph", response_model=WorkflowGraphResponse)
def get_workflow_graph(
    application_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Returns the React Flow DAG representation with parallel stages and critical path."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    if current_user.role == UserRole.APPLICANT and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized application access",
        )

    return WorkflowService.get_workflow_graph(application)

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_active_user
from app.project.schema import (
    ProjectCreateRequest,
    ProjectOverviewResponse,
    ProjectResponse,
    ProjectUpdateRequest,
)
from app.project.service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreateRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new project/facility under a business owned by current user.
    Enforces tenant isolation (user must own the parent business).
    """
    return ProjectService.create_project(db=db, user=current_user, payload=payload)


@router.get("", response_model=List[ProjectResponse])
def list_projects(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
    business_id: Optional[int] = Query(None, description="Filter by business ID"),
):
    """
    List all projects for the current user.
    If business_id is provided, filters to projects under that business.
    """
    return ProjectService.list_projects(db=db, user=current_user, business_id=business_id)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get project details.
    Enforces tenant isolation (rejects cross-user access with 403).
    """
    return ProjectService.get_project(db=db, user=current_user, project_id=project_id)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdateRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update project details.
    Enforces tenant isolation.
    """
    return ProjectService.update_project(
        db=db,
        user=current_user,
        project_id=project_id,
        payload=payload,
    )


@router.get("/{project_id}/overview", response_model=ProjectOverviewResponse)
def get_project_overview(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get unified project workspace overview for a specific project.
    Aggregates company master data, project applications, documents,
    inspections, and compliance filings for this project scope.
    """
    return ProjectService.get_project_overview(
        db=db,
        user=current_user,
        project_id=project_id,
    )

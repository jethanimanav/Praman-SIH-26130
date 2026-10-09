from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.api.deps import get_current_active_user, require_role, OfficerUser
from app.query.schema import (
    CreateQueryRequest,
    SendQueryMessageRequest,
    ResolveQueryRequest,
    DepartmentQueryResponse,
    QueryMessageResponse,
)
from app.query.service import QueryService


router = APIRouter(prefix="/api/queries", tags=["queries"])


@router.post("", response_model=DepartmentQueryResponse, status_code=status.HTTP_201_CREATED)
def create_query(
    payload: CreateQueryRequest,
    current_user: Annotated[User, Depends(require_role(UserRole.OFFICER, UserRole.ADMIN))],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Officer / Admin issues a formal clarification or deficiency query on an application.
    Enforces attachment document validation and generates sequential query code.
    """
    query = QueryService.create_query(db=db, payload=payload, officer=current_user)
    return QueryService.format_query_response(db, query)


@router.get("", response_model=List[DepartmentQueryResponse])
def list_queries(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
    application_id: Optional[int] = Query(None, description="Filter by application ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    status: Optional[str] = Query(None, description="Filter by query status (OPEN, RESPONDED, RESOLVED, CLOSED)"),
):
    """
    Lists department queries.
    Enforces tenant isolation: Applicants only see queries for their applications.
    """
    queries = QueryService.list_queries(
        db=db,
        user=current_user,
        application_id=application_id,
        project_id=project_id,
        status=status,
    )
    return [QueryService.format_query_response(db, q) for q in queries]


@router.get("/{query_id}", response_model=DepartmentQueryResponse)
def get_query(
    query_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns query details including chronological message history and resolved attachments.
    Enforces tenant access verification (403 for unauthorized applicants).
    """
    query = QueryService.get_query(db=db, user=current_user, query_id=query_id)
    return QueryService.format_query_response(db, query)


@router.post("/{query_id}/messages", response_model=DepartmentQueryResponse)
def send_query_message(
    query_id: int,
    payload: SendQueryMessageRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Submits a response or clarification message to the query.
    If applicant responds, query status transitions from OPEN to RESPONDED.
    Validates document attachments to prevent cross-tenant hijacking.
    """
    query = QueryService.send_message(
        db=db,
        user=current_user,
        query_id=query_id,
        payload=payload,
    )
    return QueryService.format_query_response(db, query)


@router.post("/{query_id}/resolve", response_model=DepartmentQueryResponse)
def resolve_query(
    query_id: int,
    payload: ResolveQueryRequest,
    current_user: Annotated[User, Depends(require_role(UserRole.OFFICER, UserRole.ADMIN))],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Officer marks the query as RESOLVED with recorded resolver identity and timestamp.
    """
    query = QueryService.resolve_query(
        db=db,
        user=current_user,
        query_id=query_id,
        payload=payload,
    )
    return QueryService.format_query_response(db, query)


@router.post("/{query_id}/close", response_model=DepartmentQueryResponse)
def close_query(
    query_id: int,
    current_user: Annotated[User, Depends(require_role(UserRole.OFFICER, UserRole.ADMIN))],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Officer closes the query.
    """
    query = QueryService.close_query(
        db=db,
        user=current_user,
        query_id=query_id,
    )
    return QueryService.format_query_response(db, query)

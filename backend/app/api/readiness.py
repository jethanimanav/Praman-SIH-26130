from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import CurrentUser
from app.models.workflow import Application
from app.models.user import UserRole
from app.readiness.schema import ReadinessAssessment
from app.readiness.service import ReadinessService

router = APIRouter(prefix="/api/workflow/applications", tags=["readiness"])


@router.get("/{application_id}/readiness", response_model=ReadinessAssessment)
def get_application_readiness(
    application_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Evaluates pre-submission technical readiness for an application.
    Checks profile completeness, document dossier status, unresolved queries,
    and joint inspection outcomes.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    # Tenant isolation
    if current_user.role == UserRole.APPLICANT:
        if application.applicant_id != current_user.id and (
            application.business and application.business.user_id != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized access to application readiness",
            )

    return ReadinessService.assess_application_readiness(db, application)

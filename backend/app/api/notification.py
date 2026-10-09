from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import CurrentUser
from app.notification.schema import (
    NotificationResponse,
    NotificationListResponse,
)
from app.notification.service import NotificationService

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
def get_user_notifications(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List notifications for the current authenticated user."""
    items = NotificationService.list_notifications(
        db=db,
        user_id=current_user.id,
        unread_only=unread_only,
        skip=skip,
        limit=limit,
    )
    unread_count = NotificationService.get_unread_count(db=db, user_id=current_user.id)
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        unread_count=unread_count,
        total_count=len(items),
    )


@router.get("/unread-count")
def get_unread_count(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Get the current count of unread notifications."""
    count = NotificationService.get_unread_count(db=db, user_id=current_user.id)
    return {"unread_count": count}


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Mark a specific notification as read."""
    notif = NotificationService.mark_as_read(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    return NotificationResponse.model_validate(notif)


@router.post("/read-all")
def mark_all_notifications_as_read(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Mark all unread notifications as read for current user."""
    count = NotificationService.mark_all_as_read(db=db, user_id=current_user.id)
    return {"marked_read_count": count, "message": f"{count} notifications marked as read."}

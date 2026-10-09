from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.notification import Notification
from app.models.user import User
from app.core.clock import ClockService


class NotificationService:
    """
    Unified Notification and Deadline Event Service.
    Handles user notification routing, deduplication/idempotency,
    and unread state management.
    """

    @classmethod
    def create_notification(
        cls,
        db: Session,
        user_id: int,
        title: str,
        message: str,
        event_type: str,
        severity: str = "INFO",
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        action_url: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        data_status: str = "DEMO",
    ) -> Notification:
        # Check idempotency to prevent duplicate spam
        if idempotency_key:
            existing = db.query(Notification).filter(
                Notification.idempotency_key == idempotency_key
            ).first()
            if existing:
                return existing

        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            event_type=event_type,
            severity=severity,
            is_read=False,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            action_url=action_url,
            idempotency_key=idempotency_key,
            data_status=data_status,
            created_at=ClockService.now(),
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification

    @classmethod
    def list_notifications(
        cls,
        db: Session,
        user_id: int,
        unread_only: bool = False,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Notification]:
        query = db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            query = query.filter(Notification.is_read.is_(False))
        return query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

    @classmethod
    def get_unread_count(cls, db: Session, user_id: int) -> int:
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        ).count()

    @classmethod
    def mark_as_read(cls, db: Session, notification_id: int, user_id: int) -> Notification:
        notif = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notif:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )
        if notif.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized to access this notification",
            )

        if not notif.is_read:
            notif.is_read = True
            notif.read_at = ClockService.now()
            db.commit()
            db.refresh(notif)
        return notif

    @classmethod
    def mark_all_as_read(cls, db: Session, user_id: int) -> int:
        unread = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        ).all()
        now = ClockService.now()
        for item in unread:
            item.is_read = True
            item.read_at = now
        db.commit()
        return len(unread)

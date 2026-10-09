from datetime import datetime
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog


def record_audit(
    db: Session,
    action: str,
    *,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    user_role: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    previous_value: Optional[Any] = None,
    new_value: Optional[Any] = None,
    reason: Optional[str] = None,
    extra: Optional[dict] = None,
    source: str = "api",
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Record an audit event. Call this for every sensitive action.
    Returns the created AuditLog (already added to session, not yet committed).
    """
    log = AuditLog(
        user_id=user_id,
        user_email=user_email,
        user_role=user_role,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        previous_value=previous_value,
        new_value=new_value,
        reason=reason,
        extra=extra,
        source=source,
        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(log)
    return log

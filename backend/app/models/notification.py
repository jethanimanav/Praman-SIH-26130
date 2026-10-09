from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from app.database import Base


class Notification(Base):
    """
    Persistent, user-specific notification model.
    Tracks notifications across applications, queries, inspections,
    compliance filings, and regulatory change alerts.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    event_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(50), default="INFO", nullable=False)  # INFO, WARNING, URGENT, SUCCESS
    is_read = Column(Boolean, default=False, nullable=False, index=True)

    entity_type = Column(String(100), nullable=True)  # application, query, inspection, compliance, project, radar
    entity_id = Column(String(100), nullable=True)
    action_url = Column(String(255), nullable=True)
    idempotency_key = Column(String(255), unique=True, index=True, nullable=True)

    data_status = Column(String(50), default="DEMO", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", backref="notifications")

    def __repr__(self):
        return f"<Notification id={self.id} user_id={self.user_id} title={self.title!r} is_read={self.is_read}>"

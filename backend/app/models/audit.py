from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class AuditLog(Base):
    """
    Immutable audit trail for all significant actions.
    Records who did what, when, and (where applicable) the before/after values.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    # Who
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)  # denormalised for log integrity
    user_role = Column(String(50), nullable=True)
    # What
    action = Column(String(200), nullable=False, index=True)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(String(100), nullable=True)
    # Detail
    previous_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    extra = Column(JSON, nullable=True)  # e.g. AI provider info
    # When
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    # Source
    source = Column(String(100), nullable=True)  # e.g. "api", "system", "demo"
    ip_address = Column(String(50), nullable=True)

    user = relationship("User", back_populates="audit_logs")

    def __repr__(self):
        return f"<AuditLog id={self.id} action={self.action!r} user={self.user_email!r}>"

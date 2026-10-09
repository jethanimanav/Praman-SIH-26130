import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.database import Base
from app.sla.schema import EscalationStatus


class EscalationEvent(Base):
    __tablename__ = "escalation_events"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False, index=True)
    approval_step_id = Column(Integer, ForeignKey("approval_steps.id"), nullable=False, index=True)
    requirement_id = Column(String(100), nullable=False, index=True)
    sla_id = Column(String(100), nullable=True)
    
    trigger_type = Column(String(100), nullable=False, default="OVERDUE_THRESHOLD_BREACH")
    level = Column(String(50), nullable=False, default="LEVEL_1")
    recipient_role = Column(String(100), nullable=False)
    days_overdue = Column(Float, default=0.0, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(SAEnum(EscalationStatus), default=EscalationStatus.TRIGGERED, nullable=False, index=True)
    
    triggered_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolution_note = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    application = relationship("Application", back_populates="escalations")
    approval_step = relationship("ApprovalStep", back_populates="escalations")
    acknowledged_by = relationship("User", foreign_keys=[acknowledged_by_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])

    def __repr__(self):
        return f"<EscalationEvent id={self.id} req={self.requirement_id!r} level={self.level} status={self.status}>"

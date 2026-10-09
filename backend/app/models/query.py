import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.database import Base


class QueryStatus(str, enum.Enum):
    OPEN = "OPEN"
    RESPONDED = "RESPONDED"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class DepartmentQuery(Base):
    __tablename__ = "department_queries"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    approval_step_id = Column(Integer, ForeignKey("approval_steps.id"), nullable=True, index=True)

    query_code = Column(String(50), unique=True, index=True, nullable=False)
    subject = Column(String(255), nullable=False)
    query_details = Column(Text, nullable=False)
    department = Column(String(255), nullable=False)  # e.g. "MIDC Planning Directorate"
    issued_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    status = Column(SAEnum(QueryStatus), default=QueryStatus.OPEN, nullable=False, index=True)
    data_status = Column(String(50), default="DEMO", nullable=False)
    deadline_at = Column(DateTime, nullable=True)  # Marked VERIFICATION_REQUIRED in schema / UI

    resolved_at = Column(DateTime, nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolution_note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    application = relationship("Application", back_populates="queries")
    business = relationship("Business")
    project = relationship("Project")
    approval_step = relationship("ApprovalStep")
    issued_by = relationship("User", foreign_keys=[issued_by_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
    messages = relationship(
        "QueryMessage",
        back_populates="query",
        cascade="all, delete-orphan",
        order_by="QueryMessage.created_at",
    )

    def __repr__(self):
        return f"<DepartmentQuery code={self.query_code} status={self.status}>"


class QueryMessage(Base):
    __tablename__ = "query_messages"

    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, ForeignKey("department_queries.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sender_role = Column(String(50), nullable=False)  # "applicant", "officer", "admin"
    message_text = Column(Text, nullable=False)
    attachment_document_ids = Column(JSON, default=list, nullable=False)  # List of integer document IDs

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    query = relationship("DepartmentQuery", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])

    def __repr__(self):
        return f"<QueryMessage id={self.id} query_id={self.query_id}>"

import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.database import Base
from app.regulatory.schema import DataStatus


class ApplicationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class StepStatus(str, enum.Enum):
    BLOCKED = "BLOCKED"
    READY = "READY"
    IN_PROGRESS = "IN_PROGRESS"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    applicant_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    status = Column(SAEnum(ApplicationStatus), default=ApplicationStatus.DRAFT, nullable=False, index=True)
    total_timeline_days = Column(Integer, default=0, nullable=False)
    critical_path_steps = Column(JSON, default=list, nullable=False)  # List of requirement_id strings
    form_data = Column(JSON, default=dict, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    
    submitted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    business = relationship("Business", back_populates="applications")
    project = relationship("Project", back_populates="applications")
    applicant = relationship("User", back_populates="applications")
    steps = relationship(
        "ApprovalStep",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="ApprovalStep.id",
    )
    escalations = relationship(
        "EscalationEvent",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="EscalationEvent.id",
    )
    inspections = relationship(
        "JointInspection",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="JointInspection.id",
    )
    versions = relationship(
        "ApplicationVersion",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="ApplicationVersion.version_number",
    )
    queries = relationship(
        "DepartmentQuery",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="DepartmentQuery.id",
    )

    def __repr__(self):
        return f"<Application id={self.id} title={self.title!r} status={self.status} v={self.version}>"


class ApplicationVersion(Base):
    __tablename__ = "application_versions"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, index=True)
    status = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    form_data = Column(JSON, nullable=True)
    snapshot = Column(JSON, nullable=False)
    change_summary = Column(Text, nullable=True)
    source = Column(String(100), default="api", nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    application = relationship("Application", back_populates="versions")
    created_by = relationship("User", foreign_keys=[created_by_id])

    def __repr__(self):
        return f"<ApplicationVersion app_id={self.application_id} v={self.version_number}>"


class ApprovalStep(Base):
    __tablename__ = "approval_steps"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False, index=True)
    requirement_id = Column(String(100), nullable=False, index=True)
    step_name = Column(String(255), nullable=False)
    department = Column(String(255), nullable=True)
    estimated_timeline_days = Column(Integer, default=0, nullable=False)
    
    status = Column(SAEnum(StepStatus), default=StepStatus.BLOCKED, nullable=False, index=True)
    data_status = Column(SAEnum(DataStatus), default=DataStatus.DEMO, nullable=False)
    
    # Prerequisites as requirement_id strings (e.g. ["REQ-SITING-001"])
    prerequisites = Column(JSON, default=list, nullable=False)
    is_critical_path = Column(Boolean, default=False, nullable=False)
    
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # SLA Pause tracking
    is_paused = Column(Boolean, default=False, nullable=False)
    paused_at = Column(DateTime, nullable=True)
    total_paused_seconds = Column(Integer, default=0, nullable=False)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = relationship("Application", back_populates="steps")
    escalations = relationship(
        "EscalationEvent",
        back_populates="approval_step",
        cascade="all, delete-orphan",
        order_by="EscalationEvent.id",
    )

    def __repr__(self):
        return f"<ApprovalStep id={self.id} req={self.requirement_id!r} status={self.status}>"

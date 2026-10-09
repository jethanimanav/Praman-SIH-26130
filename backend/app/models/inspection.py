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


class InspectionStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    RESCHEDULED = "RESCHEDULED"


class InspectionOutcome(str, enum.Enum):
    SATISFACTORY = "SATISFACTORY"
    DEFICIENCIES_NOTED = "DEFICIENCIES_NOTED"
    NON_COMPLIANT = "NON_COMPLIANT"


class JointInspection(Base):
    __tablename__ = "joint_inspections"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    
    scheduled_date = Column(DateTime, nullable=False)
    time_slot = Column(String(100), nullable=False)  # e.g. "10:00 AM - 01:00 PM"
    status = Column(SAEnum(InspectionStatus), default=InspectionStatus.SCHEDULED, nullable=False, index=True)
    risk_category = Column(String(50), default="HIGH", nullable=False)
    
    lead_inspector_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    participating_departments = Column(JSON, default=list, nullable=False)
    checklist_items = Column(JSON, default=list, nullable=False)
    notes = Column(Text, nullable=True)
    data_status = Column(String(50), default="DEMO", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    application = relationship("Application", back_populates="inspections")
    business = relationship("Business")
    lead_inspector = relationship("User", foreign_keys=[lead_inspector_id])
    report = relationship("InspectionReport", back_populates="joint_inspection", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<JointInspection id={self.id} app_id={self.application_id} status={self.status}>"


class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id = Column(Integer, primary_key=True, index=True)
    joint_inspection_id = Column(Integer, ForeignKey("joint_inspections.id"), nullable=False, unique=True, index=True)
    submitted_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    submitted_at = Column(DateTime, nullable=False)
    overall_outcome = Column(SAEnum(InspectionOutcome), nullable=False, index=True)
    department_findings = Column(JSON, default=dict, nullable=False)
    deficiencies = Column(JSON, default=list, nullable=False)
    corrective_actions = Column(Text, nullable=True)
    reinspection_required = Column(Boolean, default=False, nullable=False)
    compliance_deadline = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    joint_inspection = relationship("JointInspection", back_populates="report")
    submitted_by = relationship("User", foreign_keys=[submitted_by_id])

    def __repr__(self):
        return f"<InspectionReport id={self.id} inspection_id={self.joint_inspection_id} outcome={self.overall_outcome}>"

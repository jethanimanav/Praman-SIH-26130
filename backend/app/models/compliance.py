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


class ComplianceFilingStatus(str, enum.Enum):
    UPCOMING = "UPCOMING"
    DUE_SOON = "DUE_SOON"
    OVERDUE = "OVERDUE"
    SUBMITTED = "SUBMITTED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class ComplianceFiling(Base):
    __tablename__ = "compliance_filings"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False, index=True)
    compliance_id = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    department = Column(String(255), nullable=False)
    frequency = Column(String(50), nullable=False)  # MONTHLY, QUARTERLY, HALF_YEARLY, ANNUAL, BIENNIAL
    period_label = Column(String(100), nullable=False)  # e.g. "October 2026", "Q3 2026"
    due_date = Column(DateTime, nullable=False, index=True)
    lead_notice_days = Column(Integer, default=15, nullable=False)
    statutory_act = Column(String(255), nullable=True)
    penalty_clause_desc = Column(Text, nullable=True)

    status = Column(
        SAEnum(ComplianceFilingStatus),
        default=ComplianceFilingStatus.UPCOMING,
        nullable=False,
        index=True,
    )
    penalty_risk_active = Column(Boolean, default=False, nullable=False)

    # Submission fields
    submitted_at = Column(DateTime, nullable=True)
    submitted_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filing_data = Column(JSON, default=dict, nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    remarks = Column(Text, nullable=True)

    # Verification fields
    verified_at = Column(DateTime, nullable=True)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verification_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    application = relationship("Application", backref="compliance_filings")
    submitted_by = relationship("User", foreign_keys=[submitted_by_id])
    verified_by = relationship("User", foreign_keys=[verified_by_id])

    def __repr__(self):
        return f"<ComplianceFiling id={self.id} compliance_id={self.compliance_id!r} period={self.period_label!r} status={self.status}>"

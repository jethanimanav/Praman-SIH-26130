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
)
from sqlalchemy.orm import relationship
from app.database import Base


class RegulatorySource(Base):
    """
    Source registry for official or verified regulatory publishers
    (e.g., MPCB, MIDC, DISH, Central MoEFCC).
    """
    __tablename__ = "regulatory_sources"

    id = Column(Integer, primary_key=True, index=True)
    source_code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    issuing_authority = Column(String(255), nullable=False)
    official_url = Column(String(500), nullable=True)
    source_type = Column(String(100), default="CIRCULAR", nullable=False)  # CIRCULAR, GAZETTE, ACT_AMENDMENT, POLICY
    verification_status = Column(String(50), default="DEMO", nullable=False)  # VERIFIED, DEMO, VERIFICATION_REQUIRED
    is_active = Column(Boolean, default=True, nullable=False)
    last_checked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    changes = relationship("RegulatoryChangeRecord", back_populates="source", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<RegulatorySource code={self.source_code!r} name={self.name!r}>"


class RegulatoryChangeRecord(Base):
    """
    Record of a regulatory amendment, circular, or statutory update
    with criteria for automated impact matching.
    """
    __tablename__ = "regulatory_change_records"

    id = Column(Integer, primary_key=True, index=True)
    change_code = Column(String(100), unique=True, index=True, nullable=False)
    source_id = Column(Integer, ForeignKey("regulatory_sources.id"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    gazette_or_order_ref = Column(String(255), nullable=True)
    publication_date = Column(DateTime, nullable=True)
    effective_date = Column(DateTime, nullable=True)
    verification_status = Column(String(50), default="DEMO", nullable=False)

    target_sector = Column(String(100), default="all", nullable=True)
    affected_topics = Column(JSON, default=list, nullable=False)  # e.g. ["effluent", "cems", "water"]
    matching_conditions = Column(JSON, default=dict, nullable=False)  # rule conditions to match project profile
    impact_summary = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    source = relationship("RegulatorySource", back_populates="changes")
    impact_assessments = relationship("ProjectImpactAssessment", back_populates="change", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<RegulatoryChangeRecord code={self.change_code!r} title={self.title!r}>"


class ProjectImpactAssessment(Base):
    """
    Evaluated regulatory impact linking a specific Project to a RegulatoryChangeRecord.
    Categorized into POTENTIALLY_AFFECTED, NEEDS_REVIEW, or NO_MATCH.
    """
    __tablename__ = "project_impact_assessments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), index=True, nullable=False)
    change_id = Column(Integer, ForeignKey("regulatory_change_records.id"), index=True, nullable=False)

    impact_level = Column(String(50), default="POTENTIALLY_AFFECTED", nullable=False, index=True)
    # POTENTIALLY_AFFECTED, NEEDS_REVIEW, NO_MATCH
    explanation = Column(Text, nullable=False)
    matched_attributes = Column(JSON, default=dict, nullable=False)

    review_status = Column(String(50), default="PENDING_REVIEW", nullable=False, index=True)
    # PENDING_REVIEW, CONFIRMED, DISMISSED, INVESTIGATING
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", backref="impact_assessments")
    change = relationship("RegulatoryChangeRecord", back_populates="impact_assessments")
    reviewed_by = relationship("User")

    def __repr__(self):
        return f"<ProjectImpactAssessment proj={self.project_id} change={self.change_id} level={self.impact_level}>"

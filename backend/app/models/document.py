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
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.database import Base


class DocumentStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    QUERY_RAISED = "QUERY_RAISED"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=True, index=True)
    approval_step_id = Column(Integer, ForeignKey("approval_steps.id"), nullable=True, index=True)
    requirement_id = Column(String(100), nullable=False, index=True)
    
    document_name = Column(String(255), nullable=False)  # e.g. "Site Layout Plan"
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)  # Internal UUID filename relative to upload vault
    mime_type = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    checksum_sha256 = Column(String(64), nullable=False, index=True)
    
    version = Column(Integer, default=1, nullable=False)
    is_current = Column(Boolean, default=True, nullable=False, index=True)
    status = Column(SAEnum(DocumentStatus), default=DocumentStatus.UPLOADED, nullable=False, index=True)
    data_status = Column(String(50), default="DEMO", nullable=False)
    
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_decision = Column(String(50), nullable=True)  # ACCEPTED, REJECTED, QUERY_RAISED
    review_note = Column(Text, nullable=True)

    # Relationships
    business = relationship("Business", foreign_keys=[business_id])
    application = relationship("Application", foreign_keys=[application_id])
    approval_step = relationship("ApprovalStep", foreign_keys=[approval_step_id])
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])

    def __repr__(self):
        return f"<Document id={self.id} name={self.document_name!r} v={self.version} status={self.status}>"

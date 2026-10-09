from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.document import DocumentStatus


class DocumentVersionInfo(BaseModel):
    id: int
    version: int
    original_filename: str
    mime_type: str
    file_size_bytes: int
    checksum_sha256: str
    status: DocumentStatus
    uploaded_at: datetime
    uploaded_by_email: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by_email: Optional[str] = None
    review_decision: Optional[str] = None
    review_note: Optional[str] = None
    data_status: str = "DEMO"

    model_config = {"from_attributes": True}


class DocumentSlotItem(BaseModel):
    requirement_id: str
    step_name: str
    approval_step_id: Optional[int] = None
    document_name: str
    status: str  # MISSING | UPLOADED | UNDER_REVIEW | ACCEPTED | REJECTED | QUERY_RAISED
    is_uploaded: bool
    data_status: str = "DEMO"
    current_document: Optional[DocumentVersionInfo] = None
    history: List[DocumentVersionInfo] = Field(default_factory=list)
    guidance: Optional[str] = None


class DocumentCompletenessSummary(BaseModel):
    total_required: int
    uploaded_count: int
    accepted_count: int
    under_review_count: int
    query_raised_count: int
    rejected_count: int
    missing_count: int
    upload_completeness_pct: float
    scrutiny_acceptance_pct: float
    is_complete: bool  # True ONLY when accepted_count >= total_required and total_required > 0
    data_status: str = "DEMO"


class ApplicationDocumentsResponse(BaseModel):
    application_id: int
    application_title: str
    business_id: int
    business_name: str
    completeness: DocumentCompletenessSummary
    documents: List[DocumentSlotItem]
    data_status: str = "DEMO"


class OfficerPendingDocumentItem(BaseModel):
    id: int
    application_id: int
    application_title: str
    business_id: int
    business_name: str
    approval_step_id: Optional[int] = None
    step_name: str
    requirement_id: str
    document_name: str
    original_filename: str
    mime_type: str
    file_size_bytes: int
    checksum_sha256: str
    version: int
    status: DocumentStatus
    uploaded_at: datetime
    uploaded_by_email: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by_email: Optional[str] = None
    review_decision: Optional[str] = None
    review_note: Optional[str] = None
    data_status: str = "DEMO"

    model_config = {"from_attributes": True}


class ReviewDocumentRequest(BaseModel):
    decision: DocumentStatus = Field(
        ...,
        description="Scrutiny decision: ACCEPTED, REJECTED, QUERY_RAISED, or UNDER_REVIEW",
    )
    note: Optional[str] = Field(
        default=None,
        description="Officer scrutiny note. Mandatory for REJECTED and QUERY_RAISED.",
    )

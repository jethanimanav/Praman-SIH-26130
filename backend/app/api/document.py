"""
Document Management & Officer Scrutiny API Endpoints.

Handles:
- Applicant / officer document checklist retrieval with completeness calculations
- Secure multipart file upload with automatic versioning (v1 -> v2)
- Local file download with path traversal defense
- Officer scrutiny queue for pending documents
- Officer scrutiny actions (ACCEPTED, REJECTED, QUERY_RAISED) with mandatory notes
"""
from typing import Annotated, List, Optional
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import DocumentStatus
from app.models.user import User, UserRole
from app.api.deps import get_current_active_user, require_role, OfficerUser
from app.document.schema import (
    ApplicationDocumentsResponse,
    DocumentCompletenessSummary,
    DocumentSlotItem,
    DocumentVersionInfo,
    OfficerPendingDocumentItem,
    ReviewDocumentRequest,
)
from app.document.service import DocumentService
from app.document.storage import DocumentStorageService


router = APIRouter(tags=["documents"])


# --- Application Document Endpoints ---

@router.get(
    "/api/workflow/applications/{application_id}/documents",
    response_model=ApplicationDocumentsResponse,
    summary="Get all required and uploaded documents for an application with completeness metrics",
)
def get_application_documents(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return DocumentService.get_application_documents(
        db=db,
        application_id=application_id,
        user=current_user,
    )


@router.post(
    "/api/workflow/applications/{application_id}/documents/upload",
    response_model=DocumentVersionInfo,
    summary="Upload or replace a required document for an application (increments version)",
)
async def upload_application_document(
    application_id: int,
    requirement_id: Annotated[str, Form(...)],
    document_name: Annotated[str, Form(...)],
    file: UploadFile = File(...),
    approval_step_id: Annotated[Optional[int], Form()] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if getattr(file, "size", None) and file.size > DocumentStorageService.MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {DocumentStorageService.MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB",
        )
    content = await file.read()
    clean_display_filename = DocumentStorageService.sanitize_display_filename(file.filename or "uploaded_document")
    doc = DocumentService.upload_document(
        db=db,
        user=current_user,
        application_id=application_id,
        requirement_id=requirement_id,
        document_name=document_name,
        original_filename=clean_display_filename,
        content=content,
        mime_type=file.content_type or "application/octet-stream",
        approval_step_id=approval_step_id,
    )
    return DocumentVersionInfo(
        id=doc.id,
        version=doc.version,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size_bytes=doc.file_size_bytes,
        checksum_sha256=doc.checksum_sha256,
        status=doc.status,
        uploaded_at=doc.uploaded_at,
        uploaded_by_email=current_user.email,
        reviewed_at=doc.reviewed_at,
        reviewed_by_email=None,
        review_decision=doc.review_decision,
        review_note=doc.review_note,
        data_status=doc.data_status,
    )


@router.get(
    "/api/documents/{document_id}/download",
    summary="Securely download a document from the local vault",
)
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    file_path, filename, mime_type = DocumentService.get_document_file_for_download(
        db=db,
        user=current_user,
        document_id=document_id,
    )
    return FileResponse(
        path=str(file_path),
        filename=DocumentStorageService.sanitize_display_filename(filename),
        media_type=mime_type,
    )


# --- Officer Scrutiny Endpoints ---

@router.get(
    "/api/officer/documents/pending",
    response_model=List[OfficerPendingDocumentItem],
    summary="Get documents awaiting officer scrutiny or with queries raised",
)
def get_officer_pending_documents(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: OfficerUser = None,
):
    return DocumentService.get_officer_pending_documents(
        db=db,
        user=current_user,
        status_filter=status_filter,
    )


@router.post(
    "/api/officer/documents/{document_id}/review",
    response_model=DocumentVersionInfo,
    summary="Submit officer scrutiny decision (ACCEPTED, REJECTED, QUERY_RAISED) with mandatory note",
)
def review_document(
    document_id: int,
    payload: ReviewDocumentRequest,
    db: Session = Depends(get_db),
    current_user: OfficerUser = None,
):
    doc = DocumentService.review_document(
        db=db,
        user=current_user,
        document_id=document_id,
        decision=payload.decision,
        note=payload.note,
    )
    return DocumentVersionInfo(
        id=doc.id,
        version=doc.version,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size_bytes=doc.file_size_bytes,
        checksum_sha256=doc.checksum_sha256,
        status=doc.status,
        uploaded_at=doc.uploaded_at,
        uploaded_by_email=None,
        reviewed_at=doc.reviewed_at,
        reviewed_by_email=current_user.email,
        review_decision=doc.review_decision,
        review_note=doc.review_note,
        data_status=doc.data_status,
    )

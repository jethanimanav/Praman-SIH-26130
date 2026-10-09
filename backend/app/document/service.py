"""
Document Management & Scrutiny Service.

Provides:
- Mapping of expected documents from regulatory rules to approval steps
- Versioned document storage with SHA-256 checksums
- Scrutiny review workflow (UPLOADED -> UNDER_REVIEW -> ACCEPTED / REJECTED / QUERY_RAISED)
- Mandatory reason enforcement for rejections and query notices
- Deterministic completeness and readiness calculation
- Secure download verification
- Full immutable audit trail recording
"""
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.document import Document, DocumentStatus
from app.models.user import User, UserRole
from app.models.workflow import Application, ApprovalStep
from app.core.audit import record_audit
from app.core.clock import ClockService
from app.document.storage import DocumentStorageService
from app.document.schema import (
    ApplicationDocumentsResponse,
    DocumentCompletenessSummary,
    DocumentSlotItem,
    DocumentVersionInfo,
    OfficerPendingDocumentItem,
)
from app.workflow.service import WorkflowService


class DocumentService:

    @classmethod
    def _doc_to_version_info(cls, doc: Document, user_cache: Dict[int, str]) -> DocumentVersionInfo:
        return DocumentVersionInfo(
            id=doc.id,
            version=doc.version,
            original_filename=doc.original_filename,
            mime_type=doc.mime_type,
            file_size_bytes=doc.file_size_bytes,
            checksum_sha256=doc.checksum_sha256,
            status=doc.status,
            uploaded_at=doc.uploaded_at,
            uploaded_by_email=user_cache.get(doc.uploaded_by_id),
            reviewed_at=doc.reviewed_at,
            reviewed_by_email=user_cache.get(doc.reviewed_by_id) if doc.reviewed_by_id else None,
            review_decision=doc.review_decision,
            review_note=doc.review_note,
            data_status=doc.data_status,
        )

    @classmethod
    def get_application_documents(
        cls,
        db: Session,
        application_id: int,
        user: User,
    ) -> ApplicationDocumentsResponse:
        """
        Calculates all expected document slots for an application, joining M1/M3 rule
        requirements with existing uploaded/versioned documents and scrutiny states.
        """
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application {application_id} not found",
            )

        # Access check: Applicant can only access own application; Officer and Admin can access all
        if user.role == UserRole.APPLICANT and app.applicant_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view documents for this application",
            )

        business = db.query(Business).filter(Business.id == app.business_id).first()
        business_name = business.name if business else "Unknown Business"

        steps = (
            db.query(ApprovalStep)
            .filter(ApprovalStep.application_id == application_id)
            .order_by(ApprovalStep.id)
            .all()
        )

        # Load rules to determine expected documents per requirement
        rules = WorkflowService.get_rules()
        rules_by_req: Dict[str, Any] = {r.requirement_id: r for r in rules}

        # Query all documents for this application
        all_docs = (
            db.query(Document)
            .filter(Document.application_id == application_id)
            .order_by(Document.version.desc())
            .all()
        )

        # Build user email cache
        user_ids = {d.uploaded_by_id for d in all_docs if d.uploaded_by_id} | {
            d.reviewed_by_id for d in all_docs if d.reviewed_by_id
        }
        user_cache: Dict[int, str] = {}
        if user_ids:
            users = db.query(User.id, User.email).filter(User.id.in_(user_ids)).all()
            user_cache = {u.id: u.email for u in users}

        # Group documents by (requirement_id, document_name)
        docs_by_slot: Dict[Tuple[str, str], List[Document]] = {}
        for d in all_docs:
            key = (d.requirement_id, d.document_name)
            docs_by_slot.setdefault(key, []).append(d)

        slots: List[DocumentSlotItem] = []
        total_required = 0
        uploaded_count = 0
        accepted_count = 0
        under_review_count = 0
        query_raised_count = 0
        rejected_count = 0

        # Iterate steps and match against rule documents
        seen_slots: set[Tuple[str, str]] = set()

        for step in steps:
            rule = rules_by_req.get(step.requirement_id)
            expected_docs = rule.documents if rule and rule.documents else []

            for doc_name in expected_docs:
                slot_key = (step.requirement_id, doc_name)
                seen_slots.add(slot_key)
                total_required += 1

                docs_for_slot = docs_by_slot.get(slot_key, [])
                current_doc = next((d for d in docs_for_slot if d.is_current), None)
                history = [
                    cls._doc_to_version_info(d, user_cache)
                    for d in docs_for_slot
                    if not d.is_current
                ]

                if current_doc:
                    uploaded_count += 1
                    status_str = current_doc.status.value
                    if current_doc.status == DocumentStatus.ACCEPTED:
                        accepted_count += 1
                    elif current_doc.status in (DocumentStatus.UPLOADED, DocumentStatus.UNDER_REVIEW):
                        under_review_count += 1
                    elif current_doc.status == DocumentStatus.QUERY_RAISED:
                        query_raised_count += 1
                    elif current_doc.status == DocumentStatus.REJECTED:
                        rejected_count += 1

                    current_info = cls._doc_to_version_info(current_doc, user_cache)
                    is_uploaded = True
                else:
                    status_str = "MISSING"
                    current_info = None
                    is_uploaded = False

                slots.append(
                    DocumentSlotItem(
                        requirement_id=step.requirement_id,
                        step_name=step.step_name,
                        approval_step_id=step.id,
                        document_name=doc_name,
                        status=status_str,
                        is_uploaded=is_uploaded,
                        data_status="DEMO",
                        current_document=current_info,
                        history=history,
                        guidance=f"Required for step: {step.step_name}",
                    )
                )

        # Include any ad-hoc documents uploaded that were not in expected rule lists
        for slot_key, docs_for_slot in docs_by_slot.items():
            if slot_key not in seen_slots:
                req_id, doc_name = slot_key
                step = next((s for s in steps if s.requirement_id == req_id), None)
                step_name = step.step_name if step else req_id
                step_id = step.id if step else None

                current_doc = next((d for d in docs_for_slot if d.is_current), None)
                history = [
                    cls._doc_to_version_info(d, user_cache)
                    for d in docs_for_slot
                    if not d.is_current
                ]

                if current_doc:
                    status_str = current_doc.status.value
                    current_info = cls._doc_to_version_info(current_doc, user_cache)
                    is_uploaded = True
                else:
                    status_str = "MISSING"
                    current_info = None
                    is_uploaded = False

                slots.append(
                    DocumentSlotItem(
                        requirement_id=req_id,
                        step_name=step_name,
                        approval_step_id=step_id,
                        document_name=doc_name,
                        status=status_str,
                        is_uploaded=is_uploaded,
                        data_status="DEMO",
                        current_document=current_info,
                        history=history,
                        guidance="Supplementary or ad-hoc document",
                    )
                )

        missing_count = max(0, total_required - uploaded_count)
        upload_pct = round((uploaded_count / total_required * 100.0), 1) if total_required > 0 else 100.0
        acceptance_pct = round((accepted_count / total_required * 100.0), 1) if total_required > 0 else 100.0
        is_complete = bool(total_required > 0 and accepted_count >= total_required)

        completeness = DocumentCompletenessSummary(
            total_required=total_required,
            uploaded_count=uploaded_count,
            accepted_count=accepted_count,
            under_review_count=under_review_count,
            query_raised_count=query_raised_count,
            rejected_count=rejected_count,
            missing_count=missing_count,
            upload_completeness_pct=upload_pct,
            scrutiny_acceptance_pct=acceptance_pct,
            is_complete=is_complete,
            data_status="DEMO",
        )

        return ApplicationDocumentsResponse(
            application_id=app.id,
            application_title=app.title,
            business_id=app.business_id,
            business_name=business_name,
            completeness=completeness,
            documents=slots,
            data_status="DEMO",
        )

    @classmethod
    def upload_document(
        cls,
        db: Session,
        user: User,
        application_id: int,
        requirement_id: str,
        document_name: str,
        original_filename: str,
        content: bytes,
        mime_type: str,
        approval_step_id: Optional[int] = None,
    ) -> Document:
        """
        Stores a file in the local vault and registers a versioned Document record.
        If an active document already exists for this requirement and document name,
        marks the prior version inactive (is_current=False) and creates version N+1.
        """
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application {application_id} not found",
            )

        # Ownership security check
        if user.role == UserRole.APPLICANT and app.applicant_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to upload documents to this application",
            )

        # Resolve approval step if not directly provided
        if not approval_step_id:
            step = (
                db.query(ApprovalStep)
                .filter(
                    ApprovalStep.application_id == application_id,
                    ApprovalStep.requirement_id == requirement_id,
                )
                .first()
            )
            approval_step_id = step.id if step else None

        # Save to filesystem vault with checksum and path traversal checks
        storage_filename, checksum, file_size_bytes = DocumentStorageService.save_file(
            original_filename=original_filename,
            content=content,
            mime_type=mime_type,
        )

        try:
            # Check existing current document to increment version
            existing = (
                db.query(Document)
                .filter(
                    Document.application_id == application_id,
                    Document.requirement_id == requirement_id,
                    Document.document_name == document_name,
                    Document.is_current == True,
                )
                .first()
            )

            if existing:
                new_version = existing.version + 1
                existing.is_current = False
                db.add(existing)
            else:
                new_version = 1

            new_doc = Document(
                business_id=app.business_id,
                application_id=app.id,
                approval_step_id=approval_step_id,
                requirement_id=requirement_id,
                document_name=document_name,
                original_filename=original_filename,
                storage_path=storage_filename,
                mime_type=mime_type or "application/octet-stream",
                file_size_bytes=file_size_bytes,
                checksum_sha256=checksum,
                version=new_version,
                is_current=True,
                status=DocumentStatus.UPLOADED,
                data_status="DEMO",
                uploaded_at=ClockService.now(),
                uploaded_by_id=user.id,
            )
            db.add(new_doc)
            db.flush()

            record_audit(
                db=db,
                action="document_uploaded",
                user_id=user.id,
                user_email=user.email,
                user_role=user.role.value,
                entity_type="document",
                entity_id=str(new_doc.id),
                previous_value=(
                    {"version": existing.version, "checksum": existing.checksum_sha256}
                    if existing
                    else None
                ),
                new_value={
                    "document_name": document_name,
                    "version": new_version,
                    "checksum": checksum,
                    "original_filename": original_filename,
                    "requirement_id": requirement_id,
                    "application_id": app.id,
                    "is_replacement": bool(existing),
                },
                source="api",
            )

            db.commit()
            db.refresh(new_doc)
            return new_doc
        except Exception:
            db.rollback()
            # Clean up orphaned physical file from vault if commit or DB operation failed
            DocumentStorageService.delete_file(storage_filename)
            raise

    @classmethod
    def review_document(
        cls,
        db: Session,
        user: User,
        document_id: int,
        decision: DocumentStatus,
        note: Optional[str] = None,
    ) -> Document:
        """
        Officer scrutiny action.
        Only Officer and Admin roles can review documents.
        Rejection and Query Raised decisions strictly require a non-empty scrutiny note.
        """
        if user.role not in (UserRole.OFFICER, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only regulatory officers and administrators can perform document scrutiny",
            )

        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document {document_id} not found",
            )

        # Scrutiny validation: REJECTED and QUERY_RAISED must have an explanation
        if decision in (DocumentStatus.REJECTED, DocumentStatus.QUERY_RAISED):
            if not note or not note.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Officer scrutiny note is mandatory when decision is '{decision.value}'. Please provide a clear explanation for the applicant.",
                )

        prev_status = doc.status.value
        prev_decision = doc.review_decision
        prev_note = doc.review_note

        doc.status = decision
        doc.review_decision = decision.value
        doc.review_note = note.strip() if note else None
        doc.reviewed_at = ClockService.now()
        doc.reviewed_by_id = user.id

        db.add(doc)
        db.flush()

        record_audit(
            db=db,
            action="document_scrutiny_reviewed",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="document",
            entity_id=str(doc.id),
            previous_value={
                "status": prev_status,
                "decision": prev_decision,
                "note": prev_note,
            },
            new_value={
                "status": decision.value,
                "decision": decision.value,
                "note": doc.review_note,
                "document_name": doc.document_name,
                "requirement_id": doc.requirement_id,
                "application_id": doc.application_id,
            },
            reason=doc.review_note or f"Scrutiny decision: {decision.value}",
            source="api",
        )

        db.commit()
        db.refresh(doc)
        return doc

    @classmethod
    def get_officer_pending_documents(
        cls,
        db: Session,
        user: User,
        status_filter: Optional[str] = None,
    ) -> List[OfficerPendingDocumentItem]:
        """
        Retrieves current documents awaiting scrutiny or with queries raised.
        Restricted to Officers and Admins.
        """
        if user.role not in (UserRole.OFFICER, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only regulatory officers and administrators can view the scrutiny queue",
            )

        query = db.query(Document).filter(Document.is_current == True)
        if status_filter:
            query = query.filter(Document.status == status_filter)
        else:
            query = query.filter(
                Document.status.in_([
                    DocumentStatus.UPLOADED,
                    DocumentStatus.UNDER_REVIEW,
                    DocumentStatus.QUERY_RAISED,
                ])
            )

        docs = query.order_by(Document.uploaded_at.desc()).all()
        if not docs:
            return []

        # Load references
        app_ids = {d.application_id for d in docs if d.application_id}
        business_ids = {d.business_id for d in docs if d.business_id}
        step_ids = {d.approval_step_id for d in docs if d.approval_step_id}
        user_ids = {d.uploaded_by_id for d in docs if d.uploaded_by_id} | {
            d.reviewed_by_id for d in docs if d.reviewed_by_id
        }

        apps_map = {a.id: a.title for a in db.query(Application.id, Application.title).filter(Application.id.in_(app_ids)).all()}
        biz_map = {b.id: b.name for b in db.query(Business.id, Business.name).filter(Business.id.in_(business_ids)).all()}
        steps_map = {s.id: s.step_name for s in db.query(ApprovalStep.id, ApprovalStep.step_name).filter(ApprovalStep.id.in_(step_ids)).all()}
        users_map = {u.id: u.email for u in db.query(User.id, User.email).filter(User.id.in_(user_ids)).all()}

        results: List[OfficerPendingDocumentItem] = []
        for d in docs:
            results.append(
                OfficerPendingDocumentItem(
                    id=d.id,
                    application_id=d.application_id or 0,
                    application_title=apps_map.get(d.application_id, "Unknown Application"),
                    business_id=d.business_id,
                    business_name=biz_map.get(d.business_id, "Unknown Business"),
                    approval_step_id=d.approval_step_id,
                    step_name=steps_map.get(d.approval_step_id, d.requirement_id),
                    requirement_id=d.requirement_id,
                    document_name=d.document_name,
                    original_filename=d.original_filename,
                    mime_type=d.mime_type,
                    file_size_bytes=d.file_size_bytes,
                    checksum_sha256=d.checksum_sha256,
                    version=d.version,
                    status=d.status,
                    uploaded_at=d.uploaded_at,
                    uploaded_by_email=users_map.get(d.uploaded_by_id),
                    reviewed_at=d.reviewed_at,
                    reviewed_by_email=users_map.get(d.reviewed_by_id),
                    review_decision=d.review_decision,
                    review_note=d.review_note,
                    data_status=d.data_status,
                )
            )

        return results

    @classmethod
    def get_document_file_for_download(
        cls,
        db: Session,
        user: User,
        document_id: int,
    ) -> Tuple[Path, str, str]:
        """
        Retrieves the physical file path, filename, and MIME type for download.
        Enforces ownership access control and path traversal defense.
        """
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document {document_id} not found",
            )

        # Access check
        if user.role == UserRole.APPLICANT:
            app = db.query(Application).filter(Application.id == doc.application_id).first()
            if not app or app.applicant_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to download this document",
                )

        file_path = DocumentStorageService.get_file_path(doc.storage_path)
        return file_path, doc.original_filename, doc.mime_type

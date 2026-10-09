from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.query import DepartmentQuery, QueryMessage, QueryStatus
from app.models.workflow import Application, ApprovalStep
from app.models.document import Document
from app.models.user import User, UserRole
from app.query.schema import (
    CreateQueryRequest,
    SendQueryMessageRequest,
    ResolveQueryRequest,
    DepartmentQueryResponse,
    QueryMessageResponse,
)
from app.core.audit import record_audit
from app.core.clock import ClockService


class QueryService:
    @classmethod
    def _validate_attachments(
        cls,
        db: Session,
        application: Application,
        attachment_ids: List[int],
    ) -> List[Dict[str, Any]]:
        """
        Validates that all attachment document IDs belong to the application or business.
        Prevents cross-tenant document hijacking.
        """
        if not attachment_ids:
            return []

        docs = (
            db.query(Document)
            .filter(
                Document.id.in_(attachment_ids),
                Document.business_id == application.business_id,
            )
            .all()
        )

        found_ids = {d.id for d in docs}
        invalid_ids = set(attachment_ids) - found_ids
        if invalid_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Attachment validation failed: document IDs {list(invalid_ids)} do not belong to this application/business.",
            )

        return [
            {
                "id": d.id,
                "document_name": d.document_name,
                "original_filename": d.original_filename,
                "file_size_bytes": d.file_size_bytes,
                "mime_type": d.mime_type,
                "status": d.status.value,
            }
            for d in docs
        ]

    @classmethod
    def create_query(
        cls,
        db: Session,
        payload: CreateQueryRequest,
        officer: User,
    ) -> DepartmentQuery:
        """
        Officer issues a formal clarification/deficiency query on an application.
        """
        if officer.role not in (UserRole.OFFICER, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only regulatory officers or admins can issue queries.",
            )

        application = db.query(Application).filter(Application.id == payload.application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application {payload.application_id} not found.",
            )

        if payload.approval_step_id is not None:
            step = (
                db.query(ApprovalStep)
                .filter(
                    ApprovalStep.id == payload.approval_step_id,
                    ApprovalStep.application_id == application.id,
                )
                .first()
            )
            if not step:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Approval step {payload.approval_step_id} does not belong to application {application.id}.",
                )

        # Validate attachments
        attachments = payload.attachment_document_ids or []
        cls._validate_attachments(db, application, attachments)

        # Generate unique sequential query code: QRY-YYYY-XXXX
        year = ClockService.now().year
        count = db.query(DepartmentQuery).filter(DepartmentQuery.application_id == application.id).count()
        query_code = f"QRY-{year}-{(count + 1):04d}"

        # Create query
        dept_name = payload.department or "MIDC Planning Directorate"
        query = DepartmentQuery(
            application_id=application.id,
            business_id=application.business_id,
            project_id=application.project_id,
            approval_step_id=payload.approval_step_id,
            query_code=query_code,
            subject=payload.subject.strip(),
            query_details=payload.query_details.strip(),
            department=dept_name,
            issued_by_id=officer.id,
            status=QueryStatus.OPEN,
            data_status="DEMO",
            deadline_at=payload.deadline_at,
            created_at=ClockService.now(),
            updated_at=ClockService.now(),
        )
        db.add(query)
        db.flush()

        # Create opening message from officer
        initial_msg = QueryMessage(
            query_id=query.id,
            sender_id=officer.id,
            sender_role=officer.role.value,
            message_text=payload.query_details.strip(),
            attachment_document_ids=attachments,
            created_at=ClockService.now(),
        )
        db.add(initial_msg)

        record_audit(
            db=db,
            action="query_created",
            user_id=officer.id,
            user_email=officer.email,
            user_role=officer.role.value,
            entity_type="department_query",
            entity_id=query.id,
            new_value={
                "query_code": query_code,
                "application_id": application.id,
                "subject": query.subject,
                "department": query.department,
            },
        )

        from app.notification.service import NotificationService
        NotificationService.create_notification(
            db=db,
            user_id=application.applicant_id,
            title=f"New Query: {query_code}",
            message=f"{dept_name} raised a formal query on '{application.title}': {query.subject}",
            event_type="QUERY_RAISED",
            severity="WARNING",
            entity_type="query",
            entity_id=str(query.id),
            action_url=f"/applicant/workflow/{application.id}?tab=queries",
            idempotency_key=f"notif-query-created-{query.id}",
        )

        db.commit()
        db.refresh(query)
        return query

    @classmethod
    def list_queries(
        cls,
        db: Session,
        user: User,
        application_id: Optional[int] = None,
        project_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> List[DepartmentQuery]:
        """Lists queries with tenant authorization filtering."""
        query_obj = db.query(DepartmentQuery)

        if user.role == UserRole.APPLICANT:
            # Applicants only see queries for their applications
            query_obj = query_obj.join(Application).filter(Application.applicant_id == user.id)

        if application_id is not None:
            query_obj = query_obj.filter(DepartmentQuery.application_id == application_id)

        if project_id is not None:
            query_obj = query_obj.filter(DepartmentQuery.project_id == project_id)

        if status is not None:
            query_obj = query_obj.filter(DepartmentQuery.status == status)

        return query_obj.order_by(DepartmentQuery.created_at.desc()).all()

    @classmethod
    def get_query(
        cls,
        db: Session,
        user: User,
        query_id: int,
    ) -> DepartmentQuery:
        """Retrieves query by ID with strict ownership validation."""
        query = db.query(DepartmentQuery).filter(DepartmentQuery.id == query_id).first()
        if not query:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Department query {query_id} not found.",
            )

        if user.role == UserRole.APPLICANT:
            if query.application.applicant_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Unauthorized query access.",
                )

        return query

    @classmethod
    def send_message(
        cls,
        db: Session,
        user: User,
        query_id: int,
        payload: SendQueryMessageRequest,
    ) -> DepartmentQuery:
        """
        Appends a response/clarification message to the query.
        If applicant responds, transitions status from OPEN to RESPONDED.
        """
        query = cls.get_query(db, user, query_id)

        if query.status in (QueryStatus.RESOLVED, QueryStatus.CLOSED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot submit response to query in '{query.status.value}' status.",
            )

        attachments = payload.attachment_document_ids or []
        cls._validate_attachments(db, query.application, attachments)

        msg = QueryMessage(
            query_id=query.id,
            sender_id=user.id,
            sender_role=user.role.value,
            message_text=payload.message_text.strip(),
            attachment_document_ids=attachments,
            created_at=ClockService.now(),
        )
        db.add(msg)

        # Status transition
        if user.role == UserRole.APPLICANT:
            query.status = QueryStatus.RESPONDED
        elif user.role in (UserRole.OFFICER, UserRole.ADMIN):
            # Officer sending follow-up remark keeps/re-opens query to OPEN
            query.status = QueryStatus.OPEN

        query.updated_at = ClockService.now()

        record_audit(
            db=db,
            action="query_message_sent",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="department_query",
            entity_id=query.id,
            new_value={
                "query_code": query.query_code,
                "status": query.status.value,
                "attachments_count": len(attachments),
            },
        )

        from app.notification.service import NotificationService
        if user.role == UserRole.APPLICANT:
            NotificationService.create_notification(
                db=db,
                user_id=query.issued_by_id,
                title=f"Query Response: {query.query_code}",
                message=f"Applicant submitted clarification for query '{query.subject}'.",
                event_type="QUERY_RESPONDED",
                severity="INFO",
                entity_type="query",
                entity_id=str(query.id),
                action_url="/officer/scrutiny",
                idempotency_key=f"notif-query-resp-{msg.id}",
            )
        else:
            NotificationService.create_notification(
                db=db,
                user_id=query.application.applicant_id,
                title=f"Follow-up: {query.query_code}",
                message=f"{user.full_name} posted a follow-up remark on query '{query.subject}'.",
                event_type="QUERY_FOLLOWUP",
                severity="INFO",
                entity_type="query",
                entity_id=str(query.id),
                action_url=f"/applicant/workflow/{query.application_id}?tab=queries",
                idempotency_key=f"notif-query-followup-{msg.id}",
            )

        db.commit()
        db.refresh(query)
        return query

    @classmethod
    def resolve_query(
        cls,
        db: Session,
        user: User,
        query_id: int,
        payload: ResolveQueryRequest,
    ) -> DepartmentQuery:
        """Officer resolves/satisfies a query."""
        if user.role not in (UserRole.OFFICER, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only regulatory officers or admins can resolve queries.",
            )

        query = cls.get_query(db, user, query_id)

        query.status = QueryStatus.RESOLVED
        query.resolved_at = ClockService.now()
        query.resolved_by_id = user.id
        query.resolution_note = payload.resolution_note.strip() if payload.resolution_note else "Query satisfied upon review of clarifications."
        query.updated_at = ClockService.now()

        record_audit(
            db=db,
            action="query_resolved",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="department_query",
            entity_id=query.id,
            new_value={
                "query_code": query.query_code,
                "status": QueryStatus.RESOLVED.value,
                "resolution_note": query.resolution_note,
            },
        )

        from app.notification.service import NotificationService
        NotificationService.create_notification(
            db=db,
            user_id=query.application.applicant_id,
            title=f"Query Resolved: {query.query_code}",
            message=f"{query.department} resolved query '{query.subject}'.",
            event_type="QUERY_RESOLVED",
            severity="SUCCESS",
            entity_type="query",
            entity_id=str(query.id),
            action_url=f"/applicant/workflow/{query.application_id}?tab=queries",
            idempotency_key=f"notif-query-res-{query.id}",
        )

        db.commit()
        db.refresh(query)
        return query

    @classmethod
    def close_query(
        cls,
        db: Session,
        user: User,
        query_id: int,
    ) -> DepartmentQuery:
        """Officer closes a query."""
        if user.role not in (UserRole.OFFICER, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only regulatory officers or admins can close queries.",
            )

        query = cls.get_query(db, user, query_id)
        query.status = QueryStatus.CLOSED
        query.updated_at = ClockService.now()

        record_audit(
            db=db,
            action="query_closed",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="department_query",
            entity_id=query.id,
            new_value={"query_code": query.query_code, "status": QueryStatus.CLOSED.value},
        )

        db.commit()
        db.refresh(query)
        return query

    @classmethod
    def format_query_response(
        cls,
        db: Session,
        query: DepartmentQuery,
    ) -> DepartmentQueryResponse:
        """Formats DepartmentQuery model into full response with resolved attachment details and names."""
        doc_ids = set()
        for msg in query.messages:
            if msg.attachment_document_ids:
                doc_ids.update(msg.attachment_document_ids)

        docs_map = {}
        if doc_ids:
            docs = db.query(Document).filter(Document.id.in_(list(doc_ids))).all()
            docs_map = {
                d.id: {
                    "id": d.id,
                    "document_name": d.document_name,
                    "original_filename": d.original_filename,
                    "file_size_bytes": d.file_size_bytes,
                    "mime_type": d.mime_type,
                    "status": d.status.value,
                }
                for d in docs
            }

        messages_response = [
            QueryMessageResponse(
                id=m.id,
                query_id=m.query_id,
                sender_id=m.sender_id,
                sender_name=m.sender.full_name if m.sender else None,
                sender_role=m.sender_role,
                message_text=m.message_text,
                attachment_document_ids=m.attachment_document_ids or [],
                attachments=[docs_map[did] for did in (m.attachment_document_ids or []) if did in docs_map],
                created_at=m.created_at,
            )
            for m in query.messages
        ]

        return DepartmentQueryResponse(
            id=query.id,
            application_id=query.application_id,
            application_title=query.application.title if query.application else None,
            business_id=query.business_id,
            project_id=query.project_id,
            approval_step_id=query.approval_step_id,
            query_code=query.query_code,
            subject=query.subject,
            query_details=query.query_details,
            department=query.department,
            issued_by_id=query.issued_by_id,
            issued_by_name=query.issued_by.full_name if query.issued_by else None,
            status=query.status.value,
            data_status=query.data_status,
            deadline_at=query.deadline_at,
            resolved_at=query.resolved_at,
            resolved_by_id=query.resolved_by_id,
            resolved_by_name=query.resolved_by.full_name if query.resolved_by else None,
            resolution_note=query.resolution_note,
            created_at=query.created_at,
            updated_at=query.updated_at,
            messages=messages_response,
        )

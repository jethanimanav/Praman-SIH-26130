from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CreateQueryRequest(BaseModel):
    application_id: int
    approval_step_id: Optional[int] = None
    subject: str = Field(..., min_length=3, max_length=255)
    query_details: str = Field(..., min_length=5)
    department: Optional[str] = "MIDC Planning Directorate"
    deadline_at: Optional[datetime] = Field(
        None,
        description="Statutory response deadline (marked VERIFICATION_REQUIRED in regulatory policy)",
    )
    attachment_document_ids: Optional[List[int]] = Field(
        default_factory=list,
        description="IDs of authorized uploaded documents relevant to this query",
    )


class SendQueryMessageRequest(BaseModel):
    message_text: str = Field(..., min_length=1)
    attachment_document_ids: Optional[List[int]] = Field(
        default_factory=list,
        description="IDs of authorized documents attached to this clarification message",
    )


class ResolveQueryRequest(BaseModel):
    resolution_note: Optional[str] = Field(
        None,
        description="Officer remarks or decision notes on query satisfaction",
    )


class QueryMessageResponse(BaseModel):
    id: int
    query_id: int
    sender_id: int
    sender_name: Optional[str] = None
    sender_role: str
    message_text: str
    attachment_document_ids: List[int]
    attachments: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DepartmentQueryResponse(BaseModel):
    id: int
    application_id: int
    application_title: Optional[str] = None
    business_id: int
    project_id: Optional[int] = None
    approval_step_id: Optional[int] = None
    query_code: str
    subject: str
    query_details: str
    department: str
    issued_by_id: int
    issued_by_name: Optional[str] = None
    status: str
    data_status: str
    deadline_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolved_by_id: Optional[int] = None
    resolved_by_name: Optional[str] = None
    resolution_note: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    messages: List[QueryMessageResponse] = []

    model_config = {"from_attributes": True}

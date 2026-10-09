from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class UpdateDraftRequest(BaseModel):
    title: Optional[str] = None
    form_data: Optional[Dict[str, Any]] = None
    expected_version: Optional[int] = Field(
        None,
        description="Optimistic concurrency control: current known version of the application",
    )
    change_summary: Optional[str] = Field(
        None,
        description="Summary of edits made in this draft revision",
    )


class ApplicationVersionResponse(BaseModel):
    id: int
    application_id: int
    version_number: int
    status: str
    title: str
    form_data: Optional[Dict[str, Any]] = None
    snapshot: Dict[str, Any]
    change_summary: Optional[str] = None
    source: str
    created_by_id: Optional[int] = None
    created_by_email: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RestoreVersionRequest(BaseModel):
    change_summary: Optional[str] = Field(
        None,
        description="Reason or notes for restoring this historical version",
    )

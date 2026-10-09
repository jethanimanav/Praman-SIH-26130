from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    event_type: str
    severity: str
    is_read: bool
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    action_url: Optional[str] = None
    data_status: str
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    unread_count: int
    total_count: int


class CreateNotificationRequest(BaseModel):
    user_id: int
    title: str
    message: str
    event_type: str
    severity: str = "INFO"
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    action_url: Optional[str] = None
    idempotency_key: Optional[str] = None

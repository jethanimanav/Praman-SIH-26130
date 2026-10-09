from typing import Annotated, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import AdminUser
from app.api.admin import AdminBottleneckItem, get_admin_bottlenecks
from app.analytics.schema import (
    AnalyticsOverviewResponse,
    DepartmentPerformanceItem,
    AnalyticsTrendsResponse,
)
from app.analytics.service import AnalyticsService

router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])


@router.get("/overview", response_model=AnalyticsOverviewResponse)
def get_analytics_overview(
    current_user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns consolidated executive operational metrics and deterministic insights.
    Access restricted to administrators. All metrics derived from real database records.
    """
    return AnalyticsService.get_overview(db)


@router.get("/departments", response_model=List[DepartmentPerformanceItem])
def get_department_analytics(
    current_user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns cross-department approval workload, overdue steps, and on-time adherence.
    Access restricted to administrators.
    """
    return AnalyticsService.get_departments(db)


@router.get("/bottlenecks", response_model=List[AdminBottleneckItem])
def get_bottleneck_analytics(
    current_user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns prioritized operational bottlenecks, emphasizing critical-path milestones.
    Access restricted to administrators.
    """
    return get_admin_bottlenecks(current_user=current_user, db=db)


@router.get("/trends", response_model=AnalyticsTrendsResponse)
def get_trends_analytics(
    current_user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns monthly application creation and escalation trends where timestamped history exists.
    Access restricted to administrators.
    """
    return AnalyticsService.get_trends(db)

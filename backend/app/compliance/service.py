from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.compliance import ComplianceFiling, ComplianceFilingStatus
from app.models.workflow import Application
from app.models.user import User, UserRole
from app.compliance.schema import (
    ComplianceCalendarResponse,
    ComplianceFilingItem,
    ComplianceMetricField,
    SubmitComplianceFilingRequest,
    VerifyComplianceFilingRequest,
)
from app.core.clock import ClockService
from app.core.audit import record_audit

COMPLIANCE_CONFIG_PATH = Path("data/compliance/scenario_c_compliance.yaml")


class ComplianceService:
    _cached_config: Optional[Dict[str, Any]] = None

    @classmethod
    def load_config(cls, path: Optional[Path] = None) -> Dict[str, Any]:
        target = path or COMPLIANCE_CONFIG_PATH
        if not target.is_file():
            alt_target = Path("backend") / target
            if alt_target.is_file():
                target = alt_target

        if not target.is_file():
            return {"compliance_requirements": []}

        with open(target, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    @classmethod
    def ensure_application_filings(
        cls, db: Session, application: Application, config_path: Optional[Path] = None
    ) -> List[ComplianceFiling]:
        existing = (
            db.query(ComplianceFiling)
            .filter(ComplianceFiling.application_id == application.id)
            .all()
        )
        if existing:
            return existing

        config = cls.load_config(config_path)
        requirements = config.get("compliance_requirements", [])
        now = ClockService.now()

        created_filings: List[ComplianceFiling] = []

        # Project 12-month calendar
        for req in requirements:
            cid = req.get("compliance_id")
            title = req.get("title", cid)
            dept = req.get("department", "State Department")
            freq = req.get("frequency", "ANNUAL")
            notice_days = int(req.get("lead_notice_days", 15))
            statutory_act = req.get("statutory_act")
            penalty_clause = req.get("penalty_clause_desc")

            if freq == "MONTHLY":
                # Generate 3 monthly cycles
                for i in range(1, 4):
                    due = now + timedelta(days=i * 30 - 20)  # e.g., +10d, +40d, +70d
                    period = (now + timedelta(days=i * 30)).strftime("%B %Y")
                    filing = ComplianceFiling(
                        application_id=application.id,
                        compliance_id=cid,
                        title=title,
                        department=dept,
                        frequency=freq,
                        period_label=period,
                        due_date=due,
                        lead_notice_days=notice_days,
                        statutory_act=statutory_act,
                        penalty_clause_desc=penalty_clause,
                        status=ComplianceFilingStatus.UPCOMING,
                        penalty_risk_active=False,
                    )
                    db.add(filing)
                    created_filings.append(filing)
            elif freq == "QUARTERLY":
                # Generate 2 quarters
                for q in range(1, 3):
                    due = now + timedelta(days=q * 90 - 45)  # e.g., +45d, +135d
                    quarter_num = ((now.month - 1) // 3 + q) % 4 + 1
                    period = f"Q{quarter_num} {now.year}"
                    filing = ComplianceFiling(
                        application_id=application.id,
                        compliance_id=cid,
                        title=title,
                        department=dept,
                        frequency=freq,
                        period_label=period,
                        due_date=due,
                        lead_notice_days=notice_days,
                        statutory_act=statutory_act,
                        penalty_clause_desc=penalty_clause,
                        status=ComplianceFilingStatus.UPCOMING,
                        penalty_risk_active=False,
                    )
                    db.add(filing)
                    created_filings.append(filing)
            elif freq == "HALF_YEARLY":
                due = now + timedelta(days=90)
                period = f"H1 (Apr-Sep) {now.year}"
                filing = ComplianceFiling(
                    application_id=application.id,
                    compliance_id=cid,
                    title=title,
                    department=dept,
                    frequency=freq,
                    period_label=period,
                    due_date=due,
                    lead_notice_days=notice_days,
                    statutory_act=statutory_act,
                    penalty_clause_desc=penalty_clause,
                    status=ComplianceFilingStatus.UPCOMING,
                    penalty_risk_active=False,
                )
                db.add(filing)
                created_filings.append(filing)
            elif freq == "ANNUAL":
                due = now + timedelta(days=180)
                period = f"Annual Return {now.year}"
                filing = ComplianceFiling(
                    application_id=application.id,
                    compliance_id=cid,
                    title=title,
                    department=dept,
                    frequency=freq,
                    period_label=period,
                    due_date=due,
                    lead_notice_days=notice_days,
                    statutory_act=statutory_act,
                    penalty_clause_desc=penalty_clause,
                    status=ComplianceFilingStatus.UPCOMING,
                    penalty_risk_active=False,
                )
                db.add(filing)
                created_filings.append(filing)
            elif freq == "BIENNIAL":
                due = now + timedelta(days=365)
                period = f"Biennial Cycle {now.year}-{now.year + 2}"
                filing = ComplianceFiling(
                    application_id=application.id,
                    compliance_id=cid,
                    title=title,
                    department=dept,
                    frequency=freq,
                    period_label=period,
                    due_date=due,
                    lead_notice_days=notice_days,
                    statutory_act=statutory_act,
                    penalty_clause_desc=penalty_clause,
                    status=ComplianceFilingStatus.UPCOMING,
                    penalty_risk_active=False,
                )
                db.add(filing)
                created_filings.append(filing)

        db.commit()
        return created_filings

    @classmethod
    def get_calendar_response(
        cls, db: Session, application_id: int
    ) -> ComplianceCalendarResponse:
        application = db.query(Application).filter(Application.id == application_id).first()
        if not application:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application {application_id} not found",
            )

        cls.ensure_application_filings(db, application)

        config = cls.load_config()
        req_map = {r.get("compliance_id"): r for r in config.get("compliance_requirements", [])}

        filings = (
            db.query(ComplianceFiling)
            .filter(ComplianceFiling.application_id == application_id)
            .order_by(ComplianceFiling.due_date.asc())
            .all()
        )

        now = ClockService.now()
        upcoming_count = 0
        due_soon_count = 0
        overdue_count = 0
        submitted_count = 0
        verified_count = 0

        items: List[ComplianceFilingItem] = []

        for f in filings:
            delta_seconds = (f.due_date - now).total_seconds()
            days_remaining = int(delta_seconds // 86400)

            # Update status if in pending stages
            if f.status in [
                ComplianceFilingStatus.UPCOMING,
                ComplianceFilingStatus.DUE_SOON,
                ComplianceFilingStatus.OVERDUE,
            ]:
                if delta_seconds < 0:
                    f.status = ComplianceFilingStatus.OVERDUE
                    f.penalty_risk_active = True
                elif days_remaining <= f.lead_notice_days:
                    f.status = ComplianceFilingStatus.DUE_SOON
                    f.penalty_risk_active = False
                else:
                    f.status = ComplianceFilingStatus.UPCOMING
                    f.penalty_risk_active = False

            if f.status == ComplianceFilingStatus.UPCOMING:
                upcoming_count += 1
            elif f.status == ComplianceFilingStatus.DUE_SOON:
                due_soon_count += 1
            elif f.status == ComplianceFilingStatus.OVERDUE:
                overdue_count += 1
            elif f.status == ComplianceFilingStatus.SUBMITTED:
                submitted_count += 1
            elif f.status == ComplianceFilingStatus.VERIFIED:
                verified_count += 1

            # Extract metric field definitions and form from config
            cfg = req_map.get(f.compliance_id, {})
            req_form = cfg.get("required_form")
            raw_metric_fields = cfg.get("metric_fields", [])
            metric_fields = [
                ComplianceMetricField(
                    name=mf.get("name"),
                    label=mf.get("label"),
                    field_type=mf.get("field_type", "text"),
                    required=mf.get("required", True),
                )
                for mf in raw_metric_fields
            ]

            items.append(
                ComplianceFilingItem(
                    id=f.id,
                    application_id=f.application_id,
                    compliance_id=f.compliance_id,
                    title=f.title,
                    department=f.department,
                    frequency=f.frequency,
                    period_label=f.period_label,
                    due_date=f.due_date.isoformat(),
                    lead_notice_days=f.lead_notice_days,
                    statutory_act=f.statutory_act,
                    penalty_clause_desc=f.penalty_clause_desc,
                    status=f.status,
                    penalty_risk_active=f.penalty_risk_active,
                    days_remaining=days_remaining,
                    submitted_at=f.submitted_at.isoformat() if f.submitted_at else None,
                    submitted_by_email=f.submitted_by.email if f.submitted_by else None,
                    filing_data=f.filing_data or {},
                    document_id=f.document_id,
                    remarks=f.remarks,
                    verified_at=f.verified_at.isoformat() if f.verified_at else None,
                    verified_by_email=f.verified_by.email if f.verified_by else None,
                    verification_notes=f.verification_notes,
                    required_form=req_form,
                    metric_fields=metric_fields,
                    data_status="DEMO",
                )
            )

        db.commit()

        business_name = application.business.name if application.business else f"Business #{application.business_id}"

        return ComplianceCalendarResponse(
            application_id=application_id,
            business_name=business_name,
            total_filings=len(items),
            upcoming_count=upcoming_count,
            due_soon_count=due_soon_count,
            overdue_count=overdue_count,
            submitted_count=submitted_count,
            verified_count=verified_count,
            filings=items,
            current_simulated_time=now.isoformat(),
            data_status="DEMO",
        )

    @classmethod
    def submit_filing(
        cls,
        db: Session,
        application_id: int,
        filing_id: int,
        user: User,
        payload: SubmitComplianceFilingRequest,
    ) -> ComplianceFilingItem:
        filing = (
            db.query(ComplianceFiling)
            .filter(
                ComplianceFiling.id == filing_id,
                ComplianceFiling.application_id == application_id,
            )
            .first()
        )
        if not filing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Compliance filing {filing_id} not found for application {application_id}",
            )

        application = filing.application
        if user.role == UserRole.APPLICANT and application.applicant_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not own this application",
            )

        if filing.status == ComplianceFilingStatus.VERIFIED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This compliance filing has already been verified and locked",
            )

        filing.filing_data = payload.filing_data or {}
        filing.document_id = payload.document_id
        filing.remarks = payload.remarks
        filing.status = ComplianceFilingStatus.SUBMITTED
        filing.submitted_at = ClockService.now()
        filing.submitted_by_id = user.id

        record_audit(
            db=db,
            action="COMPLIANCE_FILING_SUBMITTED",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="compliance_filing",
            entity_id=str(filing.id),
            extra={"application_id": application_id, "compliance_id": filing.compliance_id},
        )

        db.commit()
        db.refresh(filing)

        now = ClockService.now()
        days_remaining = int((filing.due_date - now).total_seconds() // 86400)

        return ComplianceFilingItem(
            id=filing.id,
            application_id=filing.application_id,
            compliance_id=filing.compliance_id,
            title=filing.title,
            department=filing.department,
            frequency=filing.frequency,
            period_label=filing.period_label,
            due_date=filing.due_date.isoformat(),
            lead_notice_days=filing.lead_notice_days,
            statutory_act=filing.statutory_act,
            penalty_clause_desc=filing.penalty_clause_desc,
            status=filing.status,
            penalty_risk_active=filing.penalty_risk_active,
            days_remaining=days_remaining,
            submitted_at=filing.submitted_at.isoformat() if filing.submitted_at else None,
            submitted_by_email=user.email,
            filing_data=filing.filing_data,
            document_id=filing.document_id,
            remarks=filing.remarks,
            data_status="DEMO",
        )

    @classmethod
    def verify_filing(
        cls,
        db: Session,
        filing_id: int,
        officer: User,
        payload: VerifyComplianceFilingRequest,
    ) -> ComplianceFilingItem:
        if officer.role not in [UserRole.OFFICER, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only regulatory officers or administrators can verify compliance filings",
            )

        filing = db.query(ComplianceFiling).filter(ComplianceFiling.id == filing_id).first()
        if not filing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Compliance filing {filing_id} not found",
            )

        if filing.status != ComplianceFilingStatus.SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Filing must be in SUBMITTED status to verify, currently {filing.status}",
            )

        decision_upper = payload.decision.strip().upper()
        if decision_upper == "VERIFIED":
            filing.status = ComplianceFilingStatus.VERIFIED
            filing.penalty_risk_active = False
        elif decision_upper == "REJECTED":
            if not payload.verification_notes or not payload.verification_notes.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Verification notes are strictly required when rejecting a compliance filing",
                )
            filing.status = ComplianceFilingStatus.REJECTED
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid decision '{payload.decision}'. Allowed decisions: VERIFIED, REJECTED",
            )

        filing.verified_at = ClockService.now()
        filing.verified_by_id = officer.id
        filing.verification_notes = payload.verification_notes

        record_audit(
            db=db,
            action=f"COMPLIANCE_FILING_{decision_upper}",
            user_id=officer.id,
            user_email=officer.email,
            user_role=officer.role.value,
            entity_type="compliance_filing",
            entity_id=str(filing.id),
            extra={
                "application_id": filing.application_id,
                "decision": decision_upper,
                "notes": payload.verification_notes,
            },
        )

        db.commit()
        db.refresh(filing)

        now = ClockService.now()
        days_remaining = int((filing.due_date - now).total_seconds() // 86400)

        return ComplianceFilingItem(
            id=filing.id,
            application_id=filing.application_id,
            compliance_id=filing.compliance_id,
            title=filing.title,
            department=filing.department,
            frequency=filing.frequency,
            period_label=filing.period_label,
            due_date=filing.due_date.isoformat(),
            lead_notice_days=filing.lead_notice_days,
            statutory_act=filing.statutory_act,
            penalty_clause_desc=filing.penalty_clause_desc,
            status=filing.status,
            penalty_risk_active=filing.penalty_risk_active,
            days_remaining=days_remaining,
            submitted_at=filing.submitted_at.isoformat() if filing.submitted_at else None,
            submitted_by_email=filing.submitted_by.email if filing.submitted_by else None,
            filing_data=filing.filing_data,
            document_id=filing.document_id,
            remarks=filing.remarks,
            verified_at=filing.verified_at.isoformat(),
            verified_by_email=officer.email,
            verification_notes=filing.verification_notes,
            data_status="DEMO",
        )

    @classmethod
    def get_officer_filings_queue(
        cls, db: Session, officer: User, status_filter: Optional[str] = None
    ) -> List[ComplianceFilingItem]:
        if officer.role not in [UserRole.OFFICER, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only regulatory officers or administrators can access the compliance queue",
            )

        query = db.query(ComplianceFiling)
        if status_filter:
            status_upper = status_filter.strip().upper()
            query = query.filter(ComplianceFiling.status == status_upper)
        else:
            # Default to SUBMITTED
            query = query.filter(ComplianceFiling.status == ComplianceFilingStatus.SUBMITTED)

        filings = query.order_by(ComplianceFiling.submitted_at.desc(), ComplianceFiling.due_date.asc()).all()

        now = ClockService.now()
        items: List[ComplianceFilingItem] = []

        for f in filings:
            days_remaining = int((f.due_date - now).total_seconds() // 86400)
            items.append(
                ComplianceFilingItem(
                    id=f.id,
                    application_id=f.application_id,
                    compliance_id=f.compliance_id,
                    title=f.title,
                    department=f.department,
                    frequency=f.frequency,
                    period_label=f.period_label,
                    due_date=f.due_date.isoformat(),
                    lead_notice_days=f.lead_notice_days,
                    statutory_act=f.statutory_act,
                    penalty_clause_desc=f.penalty_clause_desc,
                    status=f.status,
                    penalty_risk_active=f.penalty_risk_active,
                    days_remaining=days_remaining,
                    submitted_at=f.submitted_at.isoformat() if f.submitted_at else None,
                    submitted_by_email=f.submitted_by.email if f.submitted_by else None,
                    filing_data=f.filing_data or {},
                    document_id=f.document_id,
                    remarks=f.remarks,
                    verified_at=f.verified_at.isoformat() if f.verified_at else None,
                    verified_by_email=f.verified_by.email if f.verified_by else None,
                    verification_notes=f.verification_notes,
                    data_status="DEMO",
                )
            )

        return items

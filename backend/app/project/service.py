from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User, UserRole
from app.models.business import Business, RegulatoryProfile
from app.models.project import Project
from app.models.workflow import Application, ApplicationStatus, StepStatus
from app.models.document import Document, DocumentStatus
from app.models.inspection import JointInspection, InspectionStatus
from app.models.compliance import ComplianceFiling, ComplianceFilingStatus
from app.project.schema import (
    CompanyMasterInfo,
    ProjectApplicationSummary,
    ProjectComplianceSummary,
    ProjectCreateRequest,
    ProjectDocumentsSummary,
    ProjectInspectionsSummary,
    ProjectOverviewResponse,
    ProjectResponse,
    ProjectUpdateRequest,
)
from app.core.audit import record_audit


class ProjectService:

    @staticmethod
    def verify_business_ownership(db: Session, business_id: int, user: User) -> Business:
        business = db.query(Business).filter(Business.id == business_id).first()
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business #{business_id} not found",
            )
        if user.role == UserRole.APPLICANT and business.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: you do not own this business",
            )
        return business

    @staticmethod
    def verify_project_access(db: Session, project_id: int, user: User) -> Project:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project #{project_id} not found",
            )
        # Check tenant isolation: project's parent business must belong to user (for applicants)
        if user.role == UserRole.APPLICANT:
            if project.business.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you do not own this project",
                )
        return project

    @classmethod
    def ensure_default_project_for_business(cls, db: Session, business: Business) -> Project:
        """
        Ensures a business has at least one Project (for backwards compatibility with legacy M0-M10 records).
        Links existing orphaned applications to this default project.
        """
        existing = db.query(Project).filter(Project.business_id == business.id).first()
        if existing:
            return existing

        # Extract hints from regulatory profile if present
        profile = business.regulatory_profile
        p_data = profile.confirmed_data if profile and profile.is_confirmed else (profile.extracted_data if profile else {})
        loc = p_data.get("location", {}) if isinstance(p_data.get("location"), dict) else {}

        default_proj = Project(
            business_id=business.id,
            name=f"{business.name} - Main Facility",
            description=business.description,
            project_type="New Setup",
            status="ACTIVE",
            district=p_data.get("district") or "Pune",
            taluka=p_data.get("taluka"),
            industrial_zone=p_data.get("industrial_zone") or "Chakan MIDC Industrial Area",
            location_type=loc.get("zone_type") or "MIDC Industrial Estate",
            sector=p_data.get("sector") or "Manufacturing",
            activities=p_data.get("processes") or [],
            workforce_count=p_data.get("workers_count"),
            power_load_kw=p_data.get("power_connected_kw"),
            water_consumption_kld=p_data.get("water_consumption_kld"),
            effluent_discharge_kld=p_data.get("effluent_discharge_kld"),
            pollution_category="Orange",
            hazardous_waste=bool(p_data.get("hazardous_waste_generated")),
            air_emissions=bool(p_data.get("air_emissions")),
        )
        db.add(default_proj)
        db.flush()

        # Link any existing applications that have no project_id
        db.query(Application).filter(
            Application.business_id == business.id,
            Application.project_id.is_(None),
        ).update({"project_id": default_proj.id}, synchronize_session="fetch")

        # Link regulatory profile if present
        if profile and profile.project_id is None:
            profile.project_id = default_proj.id

        db.commit()
        db.refresh(default_proj)
        return default_proj

    @classmethod
    def create_project(cls, db: Session, user: User, payload: ProjectCreateRequest) -> ProjectResponse:
        business = cls.verify_business_ownership(db, payload.business_id, user)

        project = Project(
            business_id=business.id,
            name=payload.name,
            description=payload.description,
            project_type=payload.project_type or "New Setup",
            status="ACTIVE",
            district=payload.district,
            taluka=payload.taluka,
            industrial_zone=payload.industrial_zone,
            location_type=payload.location_type,
            site_address=payload.site_address,
            survey_plot_number=payload.survey_plot_number,
            total_area_sqm=payload.total_area_sqm,
            built_up_area_sqm=payload.built_up_area_sqm,
            sector=payload.sector or "Manufacturing",
            activities=payload.activities or [],
            workforce_count=payload.workforce_count,
            power_load_kw=payload.power_load_kw,
            water_consumption_kld=payload.water_consumption_kld,
            effluent_discharge_kld=payload.effluent_discharge_kld,
            pollution_category=payload.pollution_category,
            hazardous_waste=payload.hazardous_waste or False,
            air_emissions=payload.air_emissions or False,
        )
        db.add(project)
        db.commit()
        db.refresh(project)

        record_audit(
            db,
            "project.create",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="project",
            entity_id=str(project.id),
            new_value={"name": project.name, "business_id": business.id},
        )
        db.commit()

        return cls._to_project_response(project)

    @classmethod
    def list_projects(
        cls,
        db: Session,
        user: User,
        business_id: Optional[int] = None,
    ) -> List[ProjectResponse]:
        query = db.query(Project).join(Business, Project.business_id == Business.id)

        if user.role == UserRole.APPLICANT:
            query = query.filter(Business.user_id == user.id)

        if business_id is not None:
            query = query.filter(Project.business_id == business_id)

        projects = query.order_by(Project.created_at.desc()).all()

        # If user is an applicant with businesses but has 0 projects, check if we need to auto-ensure default projects
        if user.role == UserRole.APPLICANT and len(projects) == 0:
            user_bizs = db.query(Business).filter(Business.user_id == user.id).all()
            for b in user_bizs:
                cls.ensure_default_project_for_business(db, b)
            # re-query
            projects = query.order_by(Project.created_at.desc()).all()

        return [cls._to_project_response(p) for p in projects]

    @classmethod
    def get_project(cls, db: Session, user: User, project_id: int) -> ProjectResponse:
        project = cls.verify_project_access(db, project_id, user)
        return cls._to_project_response(project)

    @classmethod
    def update_project(cls, db: Session, user: User, project_id: int, payload: ProjectUpdateRequest) -> ProjectResponse:
        project = cls.verify_project_access(db, project_id, user)

        update_data = payload.model_dump(exclude_unset=True)
        for key, val in update_data.items():
            setattr(project, key, val)

        db.commit()
        db.refresh(project)

        record_audit(
            db,
            "project.update",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="project",
            entity_id=str(project.id),
            new_value=update_data,
        )
        db.commit()

        return cls._to_project_response(project)

    @classmethod
    def get_project_overview(cls, db: Session, user: User, project_id: int) -> ProjectOverviewResponse:
        project = cls.verify_project_access(db, project_id, user)
        business = project.business

        # 1. Company Master Info
        company_info = CompanyMasterInfo(
            id=business.id,
            name=business.name,
            registration_number=business.registration_number,
            entity_type=business.entity_type,
            pan_number=business.pan_number,
            gstin=business.gstin,
            contact_email=business.contact_email,
            contact_phone=business.contact_phone,
            registered_office_address=business.registered_office_address,
        )

        # 2. Project Applications
        # Find applications belonging explicitly to project, or belonging to parent business if no project_id is set
        apps = db.query(Application).filter(
            (Application.project_id == project.id) |
            ((Application.business_id == business.id) & (Application.project_id.is_(None)))
        ).all()

        app_summaries: List[ProjectApplicationSummary] = []
        app_ids = [a.id for a in apps]

        for app in apps:
            tot_steps = len(app.steps)
            appr_steps = sum(1 for s in app.steps if s.status == StepStatus.APPROVED)
            in_prog_steps = sum(1 for s in app.steps if s.status == StepStatus.IN_PROGRESS)

            app_summaries.append(
                ProjectApplicationSummary(
                    id=app.id,
                    title=app.title,
                    status=app.status.value,
                    total_timeline_days=app.total_timeline_days,
                    critical_path_steps=app.critical_path_steps or [],
                    total_steps=tot_steps,
                    approved_steps=appr_steps,
                    in_progress_steps=in_prog_steps,
                    created_at=app.created_at,
                )
            )

        # 3. Documents Summary
        docs = db.query(Document).filter(
            (Document.project_id == project.id) |
            (Document.application_id.in_(app_ids) if app_ids else False) |
            ((Document.business_id == business.id) & (Document.project_id.is_(None)))
        ).filter(Document.is_current.is_(True)).all()

        total_docs = len(docs)
        uploaded_cnt = sum(1 for d in docs if d.status == DocumentStatus.UPLOADED)
        accepted_cnt = sum(1 for d in docs if d.status == DocumentStatus.ACCEPTED)
        under_review_cnt = sum(1 for d in docs if d.status == DocumentStatus.UNDER_REVIEW)
        query_raised_cnt = sum(1 for d in docs if d.status == DocumentStatus.QUERY_RAISED)

        readiness = int((accepted_cnt / total_docs * 100)) if total_docs > 0 else 0

        doc_summary = ProjectDocumentsSummary(
            total_slots=total_docs,
            uploaded_count=uploaded_cnt,
            accepted_count=accepted_cnt,
            under_review_count=under_review_cnt,
            query_raised_count=query_raised_cnt,
            readiness_percentage=readiness,
        )

        # 4. Inspections Summary
        inspections = db.query(JointInspection).filter(
            (JointInspection.project_id == project.id) |
            (JointInspection.application_id.in_(app_ids) if app_ids else False) |
            ((JointInspection.business_id == business.id) & (JointInspection.project_id.is_(None)))
        ).all()

        insp_summary = ProjectInspectionsSummary(
            total=len(inspections),
            scheduled=sum(1 for i in inspections if i.status == InspectionStatus.SCHEDULED),
            completed=sum(1 for i in inspections if i.status == InspectionStatus.COMPLETED),
            rescheduled=sum(1 for i in inspections if i.status == InspectionStatus.RESCHEDULED),
        )

        # 5. Compliance Summary
        filings = db.query(ComplianceFiling).filter(
            ComplianceFiling.application_id.in_(app_ids) if app_ids else False
        ).all()

        comp_summary = ProjectComplianceSummary(
            total=len(filings),
            upcoming=sum(1 for f in filings if f.status == ComplianceFilingStatus.UPCOMING),
            due_soon=sum(1 for f in filings if f.status == ComplianceFilingStatus.DUE_SOON),
            overdue=sum(1 for f in filings if f.status == ComplianceFilingStatus.OVERDUE),
            submitted=sum(1 for f in filings if f.status == ComplianceFilingStatus.SUBMITTED),
            verified=sum(1 for f in filings if f.status == ComplianceFilingStatus.VERIFIED),
        )

        return ProjectOverviewResponse(
            project=cls._to_project_response(project),
            company=company_info,
            applications=app_summaries,
            documents_summary=doc_summary,
            inspections_summary=insp_summary,
            compliance_summary=comp_summary,
            data_status="DEMO",
        )

    @staticmethod
    def _to_project_response(project: Project) -> ProjectResponse:
        apps_count = len(project.applications) if project.applications else 0
        has_prof = project.regulatory_profile is not None
        return ProjectResponse(
            id=project.id,
            business_id=project.business_id,
            business_name=project.business.name if project.business else None,
            name=project.name,
            description=project.description,
            project_type=project.project_type or "New Setup",
            status=project.status or "ACTIVE",
            district=project.district,
            taluka=project.taluka,
            industrial_zone=project.industrial_zone,
            location_type=project.location_type,
            site_address=project.site_address,
            survey_plot_number=project.survey_plot_number,
            total_area_sqm=project.total_area_sqm,
            built_up_area_sqm=project.built_up_area_sqm,
            sector=project.sector,
            activities=project.activities or [],
            workforce_count=project.workforce_count,
            power_load_kw=project.power_load_kw,
            water_consumption_kld=project.water_consumption_kld,
            effluent_discharge_kld=project.effluent_discharge_kld,
            pollution_category=project.pollution_category,
            hazardous_waste=project.hazardous_waste or False,
            air_emissions=project.air_emissions or False,
            created_at=project.created_at,
            updated_at=project.updated_at,
            applications_count=apps_count,
            has_regulatory_profile=has_prof,
        )

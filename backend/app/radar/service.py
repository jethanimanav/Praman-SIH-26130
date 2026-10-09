from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.radar import (
    RegulatorySource,
    RegulatoryChangeRecord,
    ProjectImpactAssessment,
)
from app.models.project import Project
from app.models.user import User, UserRole
from app.radar.schema import (
    CreateRegulatorySourceRequest,
    CreateRegulatoryChangeRequest,
    ReviewImpactRequest,
    ProjectImpactAssessmentResponse,
    RadarImpactDashboardResponse,
)
from app.core.clock import ClockService
from app.core.audit import record_audit


class RadarService:
    """
    Deterministic Regulatory Change Impact Radar Service.
    Maps newly identified statutory amendments, gazettes, and circulars
    against enterprise project profiles, applications, and processes.
    """

    @classmethod
    def list_sources(cls, db: Session) -> List[RegulatorySource]:
        return db.query(RegulatorySource).order_by(RegulatorySource.id.asc()).all()

    @classmethod
    def create_source(cls, db: Session, req: CreateRegulatorySourceRequest) -> RegulatorySource:
        source = RegulatorySource(
            source_code=req.source_code,
            name=req.name,
            issuing_authority=req.issuing_authority,
            official_url=req.official_url,
            source_type=req.source_type,
            verification_status=req.verification_status,
            is_active=req.is_active,
            created_at=ClockService.now(),
        )
        db.add(source)
        db.commit()
        db.refresh(source)
        return source

    @classmethod
    def list_changes(cls, db: Session) -> List[RegulatoryChangeRecord]:
        return db.query(RegulatoryChangeRecord).order_by(RegulatoryChangeRecord.id.desc()).all()

    @classmethod
    def create_change(cls, db: Session, req: CreateRegulatoryChangeRequest) -> RegulatoryChangeRecord:
        record = RegulatoryChangeRecord(
            change_code=req.change_code,
            source_id=req.source_id,
            title=req.title,
            summary=req.summary,
            gazette_or_order_ref=req.gazette_or_order_ref,
            publication_date=req.publication_date,
            effective_date=req.effective_date,
            verification_status=req.verification_status,
            target_sector=req.target_sector or "all",
            affected_topics=req.affected_topics,
            matching_conditions=req.matching_conditions,
            impact_summary=req.impact_summary,
            recommended_action=req.recommended_action,
            created_at=ClockService.now(),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @classmethod
    def get_project_profile_data(cls, project: Project) -> Dict[str, Any]:
        """Collects combined project and confirmed profile attributes."""
        data: Dict[str, Any] = {
            "sector": project.sector.lower() if project.sector else "manufacturing",
            "district": project.district,
            "industrial_zone": project.industrial_zone,
            "power_load_kw": project.power_load_kw,
            "built_up_area_sqm": project.built_up_area_sqm,
            "hazardous_waste_generated": project.hazardous_waste,
            "air_emissions": project.air_emissions,
            "effluent_discharge_kld": project.effluent_discharge_kld,
        }
        if project.business and project.business.regulatory_profile:
            profile = project.business.regulatory_profile
            confirmed = profile.confirmed_data or {}
            for k, v in confirmed.items():
                if k not in data or data[k] is None:
                    data[k] = v
        return data

    @classmethod
    def evaluate_project_impacts(cls, db: Session, project: Project) -> RadarImpactDashboardResponse:
        changes = db.query(RegulatoryChangeRecord).all()
        profile_data = cls.get_project_profile_data(project)

        potentially_affected: List[ProjectImpactAssessmentResponse] = []
        needs_review: List[ProjectImpactAssessmentResponse] = []
        no_match: List[ProjectImpactAssessmentResponse] = []

        for chg in changes:
            # Check target sector
            target_sector = (chg.target_sector or "all").strip().lower()
            proj_sector = str(profile_data.get("sector", "manufacturing")).strip().lower()
            sector_match = (target_sector == "all" or target_sector == proj_sector)

            matched_conds: Dict[str, Any] = {}
            mismatched_conds: Dict[str, Any] = {}
            unknown_conds: List[str] = []

            for field_name, expected in chg.matching_conditions.items():
                actual = profile_data.get(field_name)
                if actual is None:
                    unknown_conds.append(field_name)
                elif isinstance(expected, bool):
                    if bool(actual) == expected:
                        matched_conds[field_name] = actual
                    else:
                        mismatched_conds[field_name] = actual
                elif isinstance(expected, (int, float)):
                    if float(actual) >= float(expected):
                        matched_conds[field_name] = actual
                    else:
                        mismatched_conds[field_name] = actual
                elif isinstance(expected, list):
                    if any(x in expected for x in (actual if isinstance(actual, list) else [actual])):
                        matched_conds[field_name] = actual
                    else:
                        mismatched_conds[field_name] = actual
                else:
                    if str(actual).strip().lower() == str(expected).strip().lower():
                        matched_conds[field_name] = actual
                    else:
                        mismatched_conds[field_name] = actual

            # Determine impact level
            if not sector_match or len(mismatched_conds) > 0:
                level = "NO_MATCH"
                if not sector_match:
                    explanation = f"Sector mismatch: Change targets sector '{target_sector}', but project sector is '{proj_sector}'."
                else:
                    explanation = f"Criteria not satisfied: {', '.join(f'{k}={v}' for k, v in mismatched_conds.items())} did not trigger applicability."
            elif len(unknown_conds) > 0:
                level = "NEEDS_REVIEW"
                explanation = (
                    f"Possible match based on sector '{proj_sector}'. However, unit parameter(s) "
                    f"[{', '.join(unknown_conds)}] are not yet recorded in the project workspace."
                )
            else:
                level = "POTENTIALLY_AFFECTED"
                explanation = (
                    f"Direct applicability detected. Project characteristics match regulatory criteria: "
                    f"{', '.join(f'{k}={v}' for k, v in matched_conds.items())}."
                )

            # Persist or update DB assessment record
            assessment = db.query(ProjectImpactAssessment).filter(
                ProjectImpactAssessment.project_id == project.id,
                ProjectImpactAssessment.change_id == chg.id,
            ).first()

            if not assessment:
                assessment = ProjectImpactAssessment(
                    project_id=project.id,
                    change_id=chg.id,
                    impact_level=level,
                    explanation=explanation,
                    matched_attributes=matched_conds,
                    review_status="PENDING_REVIEW",
                    created_at=ClockService.now(),
                )
                db.add(assessment)
                db.commit()
                db.refresh(assessment)
            else:
                assessment.impact_level = level
                assessment.explanation = explanation
                assessment.matched_attributes = matched_conds
                db.commit()
                db.refresh(assessment)

            authority = chg.source.issuing_authority if chg.source else "Statutory Regulatory Authority"
            item = ProjectImpactAssessmentResponse(
                id=assessment.id,
                project_id=project.id,
                change_id=chg.id,
                change_title=chg.title,
                change_code=chg.change_code,
                impact_level=level,
                explanation=explanation,
                matched_attributes=matched_conds,
                review_status=assessment.review_status,
                review_notes=assessment.review_notes,
                reviewed_at=assessment.reviewed_at,
                recommended_action=chg.recommended_action,
                issuing_authority=authority,
                verification_status=chg.verification_status,
            )

            if level == "POTENTIALLY_AFFECTED":
                potentially_affected.append(item)
            elif level == "NEEDS_REVIEW":
                needs_review.append(item)
            else:
                no_match.append(item)

        return RadarImpactDashboardResponse(
            project_id=project.id,
            project_name=project.name,
            total_changes_evaluated=len(changes),
            potentially_affected_count=len(potentially_affected),
            needs_review_count=len(needs_review),
            no_match_count=len(no_match),
            potentially_affected=potentially_affected,
            needs_review=needs_review,
            no_match=no_match,
            assessed_at=ClockService.now().isoformat(),
            data_status="DEMO",
        )

    @classmethod
    def review_impact(
        cls,
        db: Session,
        impact_id: int,
        user: User,
        req: ReviewImpactRequest,
    ) -> ProjectImpactAssessment:
        if req.decision not in ("CONFIRMED", "DISMISSED", "INVESTIGATING"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Decision must be one of: CONFIRMED, DISMISSED, INVESTIGATING",
            )
        if not req.review_notes or not req.review_notes.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Review notes are mandatory when recording officer radar determination.",
            )

        impact = db.query(ProjectImpactAssessment).filter(ProjectImpactAssessment.id == impact_id).first()
        if not impact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Impact assessment record not found",
            )

        old_status = impact.review_status
        impact.review_status = req.decision
        impact.review_notes = req.review_notes.strip()
        impact.reviewed_by_id = user.id
        impact.reviewed_at = ClockService.now()

        record_audit(
            db=db,
            action="radar_impact_review",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="project_impact_assessment",
            entity_id=impact.id,
            previous_value={"review_status": old_status},
            new_value={"review_status": req.decision, "notes": req.review_notes.strip()},
        )

        db.commit()
        db.refresh(impact)
        return impact

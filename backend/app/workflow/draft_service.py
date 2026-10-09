from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.workflow import Application, ApplicationStatus, ApplicationVersion
from app.models.user import User
from app.workflow.draft_schema import UpdateDraftRequest, RestoreVersionRequest
from app.core.audit import record_audit
from app.core.clock import ClockService


class DraftService:
    @classmethod
    def _create_snapshot(cls, application: Application) -> Dict[str, Any]:
        """Creates a sanitized immutable snapshot of the application state."""
        return {
            "id": application.id,
            "business_id": application.business_id,
            "project_id": application.project_id,
            "applicant_id": application.applicant_id,
            "title": application.title,
            "status": application.status.value,
            "version": application.version,
            "form_data": application.form_data or {},
            "total_timeline_days": application.total_timeline_days,
            "critical_path_steps": application.critical_path_steps or [],
            "steps": [
                {
                    "id": step.id,
                    "requirement_id": step.requirement_id,
                    "step_name": step.step_name,
                    "department": step.department,
                    "status": step.status.value,
                    "is_critical_path": step.is_critical_path,
                }
                for step in application.steps
            ],
            "timestamp": ClockService.now().isoformat(),
        }

    @classmethod
    def ensure_initial_version(cls, db: Session, application: Application, user: Optional[User] = None) -> None:
        """Ensures that version 1 snapshot exists for an application."""
        existing = (
            db.query(ApplicationVersion)
            .filter(
                ApplicationVersion.application_id == application.id,
                ApplicationVersion.version_number == application.version,
            )
            .first()
        )
        if not existing:
            snapshot = cls._create_snapshot(application)
            initial_ver = ApplicationVersion(
                application_id=application.id,
                version_number=application.version or 1,
                status=application.status.value,
                title=application.title,
                form_data=application.form_data or {},
                snapshot=snapshot,
                change_summary="Initial application creation",
                source="system",
                created_by_id=user.id if user else application.applicant_id,
                created_by_email=user.email if user else None,
                created_at=ClockService.now(),
            )
            db.add(initial_ver)
            db.flush()

    @classmethod
    def save_draft(
        cls,
        db: Session,
        application: Application,
        payload: UpdateDraftRequest,
        user: User,
    ) -> Application:
        """
        Saves application draft with optimistic concurrency control (OCC).
        Updates current data and records an immutable version snapshot atomically.
        """
        # 1. Allowed state check: Only DRAFT applications can be edited via draft endpoint
        if application.status != ApplicationStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot edit draft for application in '{application.status.value}' status. Edits permitted in DRAFT only.",
            )

        # 2. Optimistic Concurrency Control (OCC)
        if payload.expected_version is not None and payload.expected_version != application.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Concurrency conflict: Application is at version {application.version}, "
                    f"but submitted payload expected version {payload.expected_version}. "
                    "Another session has modified this draft. Please reload before saving."
                ),
            )

        # Ensure base snapshot exists for version 1 if this is the first revision
        if application.version == 1:
            cls.ensure_initial_version(db, application, user)

        # 3. Apply updates
        if payload.title is not None and payload.title.strip():
            application.title = payload.title.strip()
        if payload.form_data is not None:
            # Merge or replace draft form data
            application.form_data = payload.form_data

        application.version += 1
        application.updated_at = ClockService.now()

        # 4. Generate snapshot
        snapshot = cls._create_snapshot(application)

        # 5. Create immutable version record
        version_record = ApplicationVersion(
            application_id=application.id,
            version_number=application.version,
            status=application.status.value,
            title=application.title,
            form_data=application.form_data,
            snapshot=snapshot,
            change_summary=payload.change_summary or f"Draft saved (v{application.version})",
            source="draft_save",
            created_by_id=user.id,
            created_by_email=user.email,
            created_at=ClockService.now(),
        )
        db.add(version_record)

        # 6. Audit trail
        record_audit(
            db=db,
            action="application_draft_saved",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="application",
            entity_id=application.id,
            previous_value={"version": application.version - 1},
            new_value={"version": application.version, "summary": payload.change_summary},
        )

        db.commit()
        db.refresh(application)
        return application

    @classmethod
    def list_versions(
        cls,
        db: Session,
        application: Application,
    ) -> List[ApplicationVersion]:
        """Returns all historical version snapshots for an application."""
        # Ensure version 1 exists if none recorded yet
        cls.ensure_initial_version(db, application)
        db.commit()

        return (
            db.query(ApplicationVersion)
            .filter(ApplicationVersion.application_id == application.id)
            .order_by(ApplicationVersion.version_number.desc())
            .all()
        )

    @classmethod
    def get_version(
        cls,
        db: Session,
        application: Application,
        version_number: int,
    ) -> ApplicationVersion:
        """Retrieves a specific version snapshot."""
        ver = (
            db.query(ApplicationVersion)
            .filter(
                ApplicationVersion.application_id == application.id,
                ApplicationVersion.version_number == version_number,
            )
            .first()
        )
        if not ver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {version_number} not found for application {application.id}",
            )
        return ver

    @classmethod
    def restore_version(
        cls,
        db: Session,
        application: Application,
        version_number: int,
        user: User,
        change_summary: Optional[str] = None,
    ) -> Application:
        """
        Restores data from a prior version snapshot.
        Enforces immutability: Restores as a NEW monotonically increasing version; never overwrites history.
        """
        if application.status != ApplicationStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot restore version on application in '{application.status.value}' status. Restoration permitted in DRAFT only.",
            )

        target_ver = cls.get_version(db, application, version_number)

        # Restore payload
        if target_ver.form_data is not None:
            application.form_data = target_ver.form_data
        if target_ver.title:
            application.title = target_ver.title

        # Monotonically advance version
        application.version += 1
        application.updated_at = ClockService.now()

        # Create new version snapshot documenting the rollback
        summary = (
            f"Restored from version v{version_number}"
            + (f": {change_summary}" if change_summary else "")
        )
        snapshot = cls._create_snapshot(application)

        new_version_record = ApplicationVersion(
            application_id=application.id,
            version_number=application.version,
            status=application.status.value,
            title=application.title,
            form_data=application.form_data,
            snapshot=snapshot,
            change_summary=summary,
            source="version_restore",
            created_by_id=user.id,
            created_by_email=user.email,
            created_at=ClockService.now(),
        )
        db.add(new_version_record)

        record_audit(
            db=db,
            action="application_version_restored",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="application",
            entity_id=application.id,
            previous_value={"restored_from_version": version_number},
            new_value={"new_version": application.version, "summary": summary},
        )

        db.commit()
        db.refresh(application)
        return application

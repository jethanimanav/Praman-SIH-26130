"""
Workflow Service.

Orchestrates:
- Creating an Application and ApprovalSteps from confirmed business discovery requirements
- Construction of ApprovalDAG from selected requirements
- Cycle detection & critical path analysis
- Step state transitions with deterministic advance validation:
  - Cannot approve a step if its prerequisites are not approved
  - Automatically unblocks downstream steps whose prerequisites are all satisfied
  - Updates application overall status
  - Records immutable audit logs
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.business import Business, RegulatoryProfile
from app.models.user import User, UserRole
from app.models.workflow import (
    Application,
    ApprovalStep,
    ApplicationStatus,
    StepStatus,
)
from app.regulatory.schema import RequirementCategory, DataStatus
from app.regulatory.discovery import RegulatoryDiscoveryService
from app.regulatory.loader import RuleLoader
from app.workflow.dag import ApprovalDAG, CycleDetectedException
from app.core.audit import record_audit
from app.core.clock import ClockService
from pathlib import Path


RULES_DIR = Path("data/regulatory")


class WorkflowService:

    @classmethod
    def get_rules(cls):
        if RULES_DIR.is_dir():
            return RuleLoader.load_from_directory(RULES_DIR)
        return []

    @classmethod
    def build_dag_from_requirements(
        cls,
        requirements: List[Dict[str, Any]],
    ) -> ApprovalDAG:
        """Constructs an ApprovalDAG instance from a list of requirement dicts."""
        dag = ApprovalDAG()
        for req in requirements:
            req_id = req.get("requirement_id")
            if not req_id:
                continue
            dag.add_node(
                id=req_id,
                name=req.get("requirement_name") or req.get("step_name") or req_id,
                duration=req.get("estimated_timeline_days") or 0,
                department=req.get("department"),
                prerequisites=req.get("prerequisites") or [],
                data_status=req.get("data_status") or "DEMO",
                extra={
                    "category": req.get("category"),
                    "documents": req.get("documents", []),
                    "tags": req.get("tags", []),
                },
            )
        dag.build_edges(filter_existing_prereqs_only=True)
        return dag

    @classmethod
    def create_application_from_discovery(
        cls,
        db: Session,
        business: Business,
        user: User,
        title: Optional[str] = None,
        project_id: Optional[int] = None,
    ) -> Application:
        """
        Creates an Application and its ApprovalStep records based on the confirmed discovery.
        Filters for applicable requirements (REQUIRED or CONDITIONAL with positive assessment).
        """
        profile = db.query(RegulatoryProfile).filter(RegulatoryProfile.business_id == business.id).first()
        if not profile or not profile.is_confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business must have a confirmed regulatory profile before creating an application",
            )

        rules = cls.get_rules()
        discovery_res = RegulatoryDiscoveryService.discover_requirements(
            business_id=business.id,
            business_name=business.name,
            confirmed_profile=profile.confirmed_data or {},
            rules=rules,
        )

        # Filter only requirements that are active (Required or Conditional)
        applicable_items = [
            item for item in discovery_res.requirements
            if item.category in (RequirementCategory.REQUIRED, RequirementCategory.CONDITIONAL)
        ]

        if not applicable_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No applicable regulatory requirements identified for this profile",
            )

        # Build DAG
        req_dicts = [item.model_dump() for item in applicable_items]
        dag = cls.build_dag_from_requirements(req_dicts)

        try:
            dag.validate_dag()
        except CycleDetectedException as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Configuration error: cycle detected in regulatory requirements: {e}",
            )

        # Calculate critical path & parallel groups
        total_timeline, critical_path_ids = dag.calculate_critical_path()
        critical_set = set(critical_path_ids)
        topo_order = dag.topological_sort()

        # Create Application
        app_title = title or f"Regulatory Approval Workflow — {business.name}"

        # Idempotency / Double-Submit Guard:
        # Return existing active draft if one already exists for this business with the same title
        existing_draft = (
            db.query(Application)
            .filter(
                Application.business_id == business.id,
                Application.title == app_title,
                Application.status == ApplicationStatus.DRAFT,
            )
            .first()
        )
        if existing_draft:
            if project_id and not existing_draft.project_id:
                existing_draft.project_id = project_id
                db.commit()
            return existing_draft

        # Determine target project ID
        target_proj_id = project_id
        if target_proj_id is None and business.projects:
            target_proj_id = business.projects[0].id

        try:
            application = Application(
                business_id=business.id,
                project_id=target_proj_id,
                applicant_id=user.id,
                title=app_title,
                status=ApplicationStatus.DRAFT,
                total_timeline_days=total_timeline,
                critical_path_steps=critical_path_ids,
                created_at=ClockService.now(),
                updated_at=ClockService.now(),
            )
            db.add(application)
            db.flush()  # get application.id

            # Create ApprovalStep records in topological order
            # Map item data by requirement_id
            items_by_id = {item.requirement_id: item for item in applicable_items}

            for req_id in topo_order:
                item = items_by_id[req_id]
                node = dag.nodes[req_id]

                # Steps with NO prerequisites are immediately READY; others are BLOCKED
                initial_status = StepStatus.READY if len(node.prerequisites) == 0 else StepStatus.BLOCKED

                step = ApprovalStep(
                    application_id=application.id,
                    requirement_id=item.requirement_id,
                    step_name=item.requirement_name,
                    department=item.department,
                    estimated_timeline_days=item.estimated_timeline_days or 0,
                    status=initial_status,
                    data_status=item.data_status,
                    prerequisites=node.prerequisites,
                    is_critical_path=req_id in critical_set,
                    created_at=ClockService.now(),
                    updated_at=ClockService.now(),
                )
                db.add(step)

            record_audit(
                db=db,
                action="application_created",
                user_id=user.id,
                user_email=user.email,
                user_role=user.role.value,
                entity_type="application",
                entity_id=application.id,
                new_value={
                    "title": app_title,
                    "business_id": business.id,
                    "steps_count": len(applicable_items),
                    "total_timeline_days": total_timeline,
                },
            )

            from app.workflow.draft_service import DraftService
            DraftService.ensure_initial_version(db, application, user)

            db.commit()
            db.refresh(application)
            return application
        except Exception:
            db.rollback()
            raise

    @classmethod
    def submit_application(
        cls,
        db: Session,
        application: Application,
        user: User,
    ) -> Application:
        """Submits an application from DRAFT to SUBMITTED."""
        if application.status != ApplicationStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot submit application in status {application.status.value}",
            )

        # Check pre-submission technical readiness for blockers
        from app.readiness.service import ReadinessService
        readiness = ReadinessService.assess_application_readiness(db, application)
        if not readiness.can_submit:
            blocker_msgs = "; ".join(f"{b.title}" for b in readiness.items if b.is_blocking)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot submit application due to {readiness.blocker_count} validation blocker(s): {blocker_msgs}",
            )

        application.status = ApplicationStatus.SUBMITTED
        application.submitted_at = ClockService.now()
        application.updated_at = ClockService.now()

        record_audit(
            db=db,
            action="application_submitted",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="application",
            entity_id=application.id,
            previous_value={"status": ApplicationStatus.DRAFT.value},
            new_value={"status": ApplicationStatus.SUBMITTED.value},
        )

        from app.notification.service import NotificationService
        NotificationService.create_notification(
            db=db,
            user_id=application.applicant_id,
            title="Application Submitted",
            message=f"Application '{application.title}' has been successfully submitted for departmental scrutiny.",
            event_type="APPLICATION_SUBMITTED",
            severity="SUCCESS",
            entity_type="application",
            entity_id=str(application.id),
            action_url=f"/applicant/workflow/{application.id}",
            idempotency_key=f"app-submitted-{application.id}",
        )

        db.commit()
        db.refresh(application)
        return application

    @classmethod
    def transition_step_status(
        cls,
        db: Session,
        application: Application,
        step_id: int,
        target_status: StepStatus,
        user: User,
        notes: Optional[str] = None,
    ) -> ApprovalStep:
        """
        Transitions an ApprovalStep's status with milestone advance validation.
        Rules:
        - Cannot set to IN_PROGRESS if step is BLOCKED (prerequisites unmet).
        - Cannot set to APPROVED if prerequisites are not APPROVED.
        - When a step is APPROVED, automatically scans all downstream dependent steps;
          any whose prerequisites are ALL approved transition from BLOCKED to READY.
        - When all steps are APPROVED, application status advances to APPROVED.
        - If any step is REJECTED, application status becomes REJECTED.
        """
        step = db.query(ApprovalStep).filter(
            ApprovalStep.id == step_id,
            ApprovalStep.application_id == application.id,
        ).first()

        if not step:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Approval step not found",
            )

        if step.status == target_status:
            return step

        old_status = step.status

        # Query all steps for this application to check prerequisites
        all_steps = db.query(ApprovalStep).filter(ApprovalStep.application_id == application.id).all()
        step_status_map = {s.requirement_id: s.status for s in all_steps}

        # VALIDATION 1: Cannot start or approve if prerequisites are not all APPROVED
        if target_status in (StepStatus.IN_PROGRESS, StepStatus.APPROVED):
            unmet_prereqs = [
                prereq_id for prereq_id in step.prerequisites
                if step_status_map.get(prereq_id) != StepStatus.APPROVED
            ]
            if unmet_prereqs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Cannot advance step '{step.step_name}' to {target_status.value}. "
                        f"Unmet prerequisites: {', '.join(unmet_prereqs)}"
                    ),
                )

        # VALIDATION 2: If application is DRAFT, require submission first (unless officer/admin testing)
        if application.status == ApplicationStatus.DRAFT and target_status in (StepStatus.IN_PROGRESS, StepStatus.APPROVED):
            application.status = ApplicationStatus.IN_REVIEW
            application.submitted_at = ClockService.now()

        # Update step state
        step.status = target_status
        step.updated_at = ClockService.now()
        if notes:
            step.notes = notes

        if target_status == StepStatus.IN_PROGRESS and not step.started_at:
            step.started_at = ClockService.now()
            if application.status in (ApplicationStatus.SUBMITTED, ApplicationStatus.DRAFT):
                application.status = ApplicationStatus.IN_REVIEW

        elif target_status == StepStatus.APPROVED:
            step.completed_at = ClockService.now()

            # Cascade: Check dependent steps and unblock those whose prerequisites are now ALL approved
            step_status_map[step.requirement_id] = StepStatus.APPROVED

            for other_step in all_steps:
                if other_step.status == StepStatus.BLOCKED and step.requirement_id in other_step.prerequisites:
                    # Check if all other prerequisites are approved
                    all_met = all(
                        step_status_map.get(p) == StepStatus.APPROVED
                        for p in other_step.prerequisites
                    )
                    if all_met:
                        other_step.status = StepStatus.READY
                        other_step.updated_at = ClockService.now()

            # Check if ALL steps across the application are now APPROVED
            all_approved = all(
                (s.id == step.id and target_status == StepStatus.APPROVED) or (s.status == StepStatus.APPROVED)
                for s in all_steps
            )
            if all_approved:
                application.status = ApplicationStatus.APPROVED
                application.completed_at = ClockService.now()

        elif target_status == StepStatus.REJECTED:
            step.completed_at = ClockService.now()
            application.status = ApplicationStatus.REJECTED

        record_audit(
            db=db,
            action="approval_step_transition",
            user_id=user.id,
            user_email=user.email,
            user_role=user.role.value,
            entity_type="approval_step",
            entity_id=step.id,
            previous_value={"status": old_status.value},
            new_value={"status": target_status.value, "notes": notes},
        )

        db.commit()
        db.refresh(step)
        return step

    @classmethod
    def get_workflow_graph(cls, application: Application) -> Dict[str, Any]:
        """
        Generates the DAG and React Flow graph for an existing application.
        Reflects current step statuses and critical path.
        """
        steps = application.steps
        step_dicts = [
            {
                "requirement_id": s.requirement_id,
                "step_name": s.step_name,
                "department": s.department,
                "estimated_timeline_days": s.estimated_timeline_days,
                "prerequisites": s.prerequisites,
                "data_status": s.data_status.value,
            }
            for s in steps
        ]

        dag = cls.build_dag_from_requirements(step_dicts)
        critical_set = set(application.critical_path_steps or [])

        rf_export = dag.export_react_flow(critical_set)

        # Enrich node data with current DB status
        status_map = {s.requirement_id: s.status.value for s in steps}
        for rf_node in rf_export["nodes"]:
            req_id = rf_node["id"]
            rf_node["data"]["status"] = status_map.get(req_id, "BLOCKED")

        parallel_groups = dag.get_parallel_groups()

        return {
            "application_id": application.id,
            "application_title": application.title,
            "application_status": application.status.value,
            "total_timeline_days": application.total_timeline_days,
            "critical_path_steps": application.critical_path_steps,
            "parallel_stages": parallel_groups,
            "graph": rf_export,
        }

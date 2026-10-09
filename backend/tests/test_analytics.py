import pytest
from datetime import datetime, timedelta
from app.core.clock import ClockService
from app.models.user import User, UserRole
from app.models.business import Business
from app.models.workflow import Application, ApprovalStep, ApplicationStatus, StepStatus
from app.models.escalation import EscalationEvent
from app.models.document import Document, DocumentStatus
from app.models.inspection import JointInspection, InspectionStatus, InspectionReport, InspectionOutcome
from app.models.compliance import ComplianceFiling, ComplianceFilingStatus
from app.sla.schema import EscalationStatus
from app.analytics.service import AnalyticsService
from tests.conftest import get_token


class TestAnalyticsEngineAndService:
    def test_empty_database_analytics(self, db):
        """Empty database returns valid zero counts and None for averages/rates without errors."""
        ClockService.reset()
        overview = AnalyticsService.get_overview(db)
        
        assert overview.kpis.total_applications == 0
        assert overview.kpis.active_applications == 0
        assert overview.kpis.completed_applications == 0
        assert overview.kpis.rejected_applications == 0
        assert overview.kpis.mean_processing_days is None
        assert overview.kpis.median_processing_days is None
        assert overview.kpis.sla_breach_count == 0
        assert overview.kpis.critical_path_overdue_count == 0
        assert overview.kpis.sla_compliance_rate is None
        assert overview.kpis.total_escalations == 0
        assert overview.kpis.active_escalations == 0
        assert overview.kpis.resolved_escalations == 0
        assert overview.kpis.mean_escalation_resolution_hours is None
        assert overview.kpis.document_review_backlog == 0
        assert overview.kpis.inspection_backlog == 0
        assert overview.kpis.compliance_overdue_count == 0

        # One optimal insight should exist when there are zero bottlenecks
        assert len(overview.insights) == 1
        assert overview.insights[0].id == "INSIGHT-OPTIMAL-OPS"

        # Department performance should be empty
        depts = AnalyticsService.get_departments(db)
        assert len(depts) == 0

        # Trends should indicate insufficient data
        trends = AnalyticsService.get_trends(db)
        assert trends.insufficient_data is True
        assert len(trends.trends) == 0

    def test_application_kpis_and_processing_time_mean_median(self, db, applicant_user):
        """Accurate calculation of application counts, and mean/median processing days."""
        ClockService.reset()
        base_time = datetime(2026, 1, 1, 10, 0, 0)

        biz = Business(
            name="Alpha Mills",
            user_id=applicant_user.id,
        )
        db.add(biz)
        db.commit()

        # 3 Completed applications with 10d, 20d, and 30d durations
        app1 = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="App 1",
            status=ApplicationStatus.APPROVED,
            submitted_at=base_time,
            completed_at=base_time + timedelta(days=10),
        )
        app2 = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="App 2",
            status=ApplicationStatus.APPROVED,
            submitted_at=base_time,
            completed_at=base_time + timedelta(days=20),
        )
        app3 = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="App 3",
            status=ApplicationStatus.APPROVED,
            submitted_at=base_time,
            completed_at=base_time + timedelta(days=30),
        )
        # 1 In Review
        app4 = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="App 4",
            status=ApplicationStatus.IN_REVIEW,
            submitted_at=base_time,
        )
        # 1 Draft
        app5 = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="App 5",
            status=ApplicationStatus.DRAFT,
        )
        # 1 Rejected
        app6 = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="App 6",
            status=ApplicationStatus.REJECTED,
        )
        db.add_all([app1, app2, app3, app4, app5, app6])
        db.commit()

        overview = AnalyticsService.get_overview(db)
        assert overview.kpis.total_applications == 6
        assert overview.kpis.active_applications == 2  # IN_REVIEW, DRAFT
        assert overview.kpis.completed_applications == 3
        assert overview.kpis.rejected_applications == 1
        # Mean of 10, 20, 30 is 20.0; median is 20.0
        assert overview.kpis.mean_processing_days == 20.0
        assert overview.kpis.median_processing_days == 20.0

    def test_sla_health_distribution_and_compliance_rate(self, db, applicant_user):
        """Aggregates SLA statuses across steps and computes on-time compliance rate."""
        ClockService.reset()
        biz = Business(name="Beta Chem", user_id=applicant_user.id)
        db.add(biz)
        db.commit()

        app = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id, title="App Beta", status=ApplicationStatus.IN_REVIEW)
        db.add(app)
        db.commit()

        # Step 1: Completed ON TIME (SLA duration is 45 days in scenario_c_sla.yaml for REQ-ENV-CTE-001)
        step1 = ApprovalStep(
            application_id=app.id,
            step_name="CTE Approval",
            requirement_id="REQ-ENV-CTE-001",
            department="Maharashtra Pollution Control Board",
            status=StepStatus.APPROVED,
            started_at=datetime(2026, 1, 1),
            completed_at=datetime(2026, 1, 20),  # 19 days < 45 days
        )
        # Step 2: Completed LATE (SLA duration is 30 days for REQ-FACTORY-001)
        step2 = ApprovalStep(
            application_id=app.id,
            step_name="Factory Plan Approval",
            requirement_id="REQ-FACTORY-001",
            department="Directorate of Industrial Safety & Health (DISH)",
            status=StepStatus.APPROVED,
            started_at=datetime(2026, 1, 1),
            completed_at=datetime(2026, 2, 10),  # 40 days > 30 days
        )
        # Step 3: Blocked (Not started)
        step3 = ApprovalStep(
            application_id=app.id,
            step_name="Fire NOC",
            requirement_id="REQ-FIRE-001",
            department="Maharashtra Fire Services",
            status=StepStatus.BLOCKED,
        )
        db.add_all([step1, step2, step3])
        db.commit()

        overview = AnalyticsService.get_overview(db)
        assert overview.sla_health.completed == 2
        assert overview.sla_health.not_started == 1
        # 1 on-time out of 2 completed with SLA = 50.0%
        assert overview.kpis.sla_compliance_rate == 50.0

    def test_escalation_kpis_and_resolution_durations(self, db, applicant_user, officer_user):
        """Escalation metrics, active vs resolved counts, and mean/median resolution hours."""
        ClockService.reset()
        biz = Business(name="Gamma Labs", user_id=applicant_user.id)
        db.add(biz)
        db.commit()

        app = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id, title="App Gamma", status=ApplicationStatus.IN_REVIEW)
        db.add(app)
        db.commit()

        step = ApprovalStep(
            application_id=app.id,
            step_name="Power Feasibility",
            requirement_id="REQ-DISCOM-POW-001",
            status=StepStatus.IN_PROGRESS,
        )
        db.add(step)
        db.commit()

        # Escalation 1: Resolved in 4 hours
        e1 = EscalationEvent(
            application_id=app.id,
            approval_step_id=step.id,
            requirement_id=step.requirement_id,
            trigger_type="SLA_BREACH",
            level="LEVEL_1",
            recipient_role="officer",
            reason="Step exceeded turnaround limit",
            days_overdue=2.0,
            status=EscalationStatus.RESOLVED,
            triggered_at=datetime(2026, 1, 1, 8, 0),
            resolved_at=datetime(2026, 1, 1, 12, 0),
            resolved_by_id=officer_user.id,
            resolution_note="Clearance verified manually",
        )
        # Escalation 2: Resolved in 8 hours
        e2 = EscalationEvent(
            application_id=app.id,
            approval_step_id=step.id,
            requirement_id=step.requirement_id,
            trigger_type="SLA_BREACH",
            level="LEVEL_2",
            recipient_role="officer",
            reason="Step exceeded turnaround limit level 2",
            days_overdue=4.0,
            status=EscalationStatus.RESOLVED,
            triggered_at=datetime(2026, 1, 1, 8, 0),
            resolved_at=datetime(2026, 1, 1, 16, 0),
            resolved_by_id=officer_user.id,
            resolution_note="Special committee dispensation approved",
        )
        # Escalation 3: Triggered (Active)
        e3 = EscalationEvent(
            application_id=app.id,
            approval_step_id=step.id,
            requirement_id=step.requirement_id,
            trigger_type="SLA_BREACH",
            level="LEVEL_1",
            recipient_role="officer",
            reason="Step exceeded turnaround limit active",
            days_overdue=1.5,
            status=EscalationStatus.TRIGGERED,
            triggered_at=datetime(2026, 1, 2, 10, 0),
        )
        db.add_all([e1, e2, e3])
        db.commit()

        overview = AnalyticsService.get_overview(db)
        assert overview.kpis.total_escalations == 3
        assert overview.kpis.active_escalations == 1
        assert overview.kpis.resolved_escalations == 2
        # Mean of 4.0 and 8.0 is 6.0; median is 6.0
        assert overview.kpis.mean_escalation_resolution_hours == 6.0
        assert overview.kpis.median_escalation_resolution_hours == 6.0

    def test_document_and_inspection_and_compliance_aggregates(
        self, db, applicant_user, officer_user
    ):
        """Verifies document review backlog, inspection status counts, and compliance overdue counts."""
        ClockService.reset()
        biz = Business(name="Delta Heavy", user_id=applicant_user.id)
        db.add(biz)
        db.commit()

        app = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id, title="App Delta", status=ApplicationStatus.IN_REVIEW)
        db.add(app)
        db.commit()

        step = ApprovalStep(
            application_id=app.id,
            step_name="DISH Plan",
            requirement_id="REQ-DISH-PLAN-001",
            status=StepStatus.IN_PROGRESS,
        )
        db.add(step)
        db.commit()

        # Documents: 1 accepted, 1 uploaded (backlog), 1 under review (backlog)
        d1 = Document(
            business_id=biz.id,
            application_id=app.id,
            approval_step_id=step.id,
            requirement_id=step.requirement_id,
            document_name="Plant Layout",
            original_filename="layout.pdf",
            storage_path="vault/layout_v1.pdf",
            mime_type="application/pdf",
            file_size_bytes=1000,
            checksum_sha256="abc",
            version=1,
            is_current=True,
            status=DocumentStatus.ACCEPTED,
            uploaded_by_id=applicant_user.id,
            uploaded_at=datetime(2026, 1, 1, 10, 0),
            reviewed_at=datetime(2026, 1, 1, 14, 0),  # 4 hours
        )
        d2 = Document(
            business_id=biz.id,
            application_id=app.id,
            approval_step_id=step.id,
            requirement_id=step.requirement_id,
            document_name="Fire Certificate",
            original_filename="fire.pdf",
            storage_path="vault/fire_v1.pdf",
            mime_type="application/pdf",
            file_size_bytes=1000,
            checksum_sha256="def",
            version=1,
            is_current=True,
            status=DocumentStatus.UPLOADED,
            uploaded_by_id=applicant_user.id,
            uploaded_at=datetime(2026, 1, 1, 10, 0),
        )
        d3 = Document(
            business_id=biz.id,
            application_id=app.id,
            approval_step_id=step.id,
            requirement_id=step.requirement_id,
            document_name="Structural Stability",
            original_filename="stability.pdf",
            storage_path="vault/stability_v1.pdf",
            mime_type="application/pdf",
            file_size_bytes=1000,
            checksum_sha256="ghi",
            version=1,
            is_current=True,
            status=DocumentStatus.UNDER_REVIEW,
            uploaded_by_id=applicant_user.id,
            uploaded_at=datetime(2026, 1, 1, 10, 0),
        )
        db.add_all([d1, d2, d3])

        # Inspections: 1 scheduled (high risk), 1 completed (satisfactory)
        i1 = JointInspection(
            application_id=app.id,
            business_id=biz.id,
            scheduled_date=datetime(2026, 1, 10),
            time_slot="10:00 AM - 01:00 PM",
            status=InspectionStatus.SCHEDULED,
            risk_category="HIGH",
            lead_inspector_id=officer_user.id,
            participating_departments=["SPCB", "DISH"],
        )
        i2 = JointInspection(
            application_id=app.id,
            business_id=biz.id,
            scheduled_date=datetime(2026, 1, 5),
            time_slot="02:00 PM - 05:00 PM",
            status=InspectionStatus.COMPLETED,
            risk_category="HIGH",
            lead_inspector_id=officer_user.id,
            participating_departments=["Fire"],
        )
        db.add_all([i1, i2])
        db.commit()

        rep = InspectionReport(
            joint_inspection_id=i2.id,
            overall_outcome=InspectionOutcome.SATISFACTORY,
            submitted_by_id=officer_user.id,
            submitted_at=datetime(2026, 1, 5, 17, 0),
        )
        db.add(rep)

        # Compliance Filings: 1 overdue (past deadline), 1 submitted
        c1 = ComplianceFiling(
            application_id=app.id,
            compliance_id="COMP-ENV-LOG",
            title="Monthly Effluent Log",
            department="SPCB",
            frequency="MONTHLY",
            period_label="Jan 2026",
            due_date=ClockService.now() - timedelta(days=5),
            status=ComplianceFilingStatus.OVERDUE,
            penalty_clause_desc="INR 10,000 per month fine",
        )
        c2 = ComplianceFiling(
            application_id=app.id,
            compliance_id="COMP-GW-METER",
            title="Quarterly Water Reading",
            department="Ground Water",
            frequency="QUARTERLY",
            period_label="Q1 2026",
            due_date=ClockService.now() + timedelta(days=30),
            status=ComplianceFilingStatus.SUBMITTED,
        )
        db.add_all([c1, c2])
        db.commit()

        overview = AnalyticsService.get_overview(db)

        # Document assertions
        assert overview.document_health.total_uploaded == 3
        assert overview.document_health.accepted == 1
        assert overview.document_health.backlog == 2
        assert overview.document_health.average_review_hours == 4.0

        # Inspection assertions
        assert overview.inspection_health.total_inspections == 2
        assert overview.inspection_health.backlog == 1
        assert overview.inspection_health.satisfactory_count == 1
        assert overview.inspection_health.facilities_high_risk == 2

        # Compliance assertions
        assert overview.compliance_health.total_filings == 2
        assert overview.compliance_health.overdue == 1
        assert overview.compliance_health.submitted == 1
        assert overview.compliance_health.penalty_risk_active == 1
        assert overview.kpis.compliance_overdue_count == 1

    def test_department_performance_breakdown(self, db, applicant_user):
        """Verifies step grouping and on-time adherence rates per department."""
        ClockService.reset()
        biz = Business(name="Zeta Metals", user_id=applicant_user.id)
        db.add(biz)
        db.commit()

        app = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id, title="App Zeta", status=ApplicationStatus.IN_REVIEW)
        db.add(app)
        db.commit()

        # Department 1: SPCB (2 steps, 1 approved on time, 1 in progress)
        s1 = ApprovalStep(
            application_id=app.id,
            step_name="CTE",
            requirement_id="REQ-ENV-CTE-001",
            department="Maharashtra Pollution Control Board",
            status=StepStatus.APPROVED,
            started_at=datetime(2026, 1, 1),
            completed_at=datetime(2026, 1, 15),
        )
        s2 = ApprovalStep(
            application_id=app.id,
            step_name="CTO",
            requirement_id="REQ-ENV-CTE-001",
            department="Maharashtra Pollution Control Board",
            status=StepStatus.IN_PROGRESS,
            started_at=datetime(2026, 1, 1),
        )
        # Department 2: DISH (1 step, approved late)
        s3 = ApprovalStep(
            application_id=app.id,
            step_name="Plan Approval",
            requirement_id="REQ-FACTORY-001",
            department="Directorate of Industrial Safety & Health (DISH)",
            status=StepStatus.APPROVED,
            started_at=datetime(2026, 1, 1),
            completed_at=datetime(2026, 2, 20),
        )
        db.add_all([s1, s2, s3])
        db.commit()

        depts = AnalyticsService.get_departments(db)
        assert len(depts) == 2

        dish_perf = next(d for d in depts if "DISH" in d.department)
        spcb_perf = next(d for d in depts if "Pollution" in d.department)

        assert dish_perf.total_steps == 1
        assert dish_perf.completed_steps == 1
        assert dish_perf.on_time_rate == 0.0  # 0 on-time out of 1 completed

        assert spcb_perf.total_steps == 2
        assert spcb_perf.completed_steps == 1
        assert spcb_perf.in_progress_steps == 1
        assert spcb_perf.on_time_rate == 100.0  # 1 on-time out of 1 completed

    def test_deterministic_executive_insights_ranking(self, db, applicant_user):
        """Verifies deterministic insight generation and priority ordering."""
        ClockService.reset()
        biz = Business(name="Theta Corp", user_id=applicant_user.id)
        db.add(biz)
        db.commit()

        app = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="App Theta",
            status=ApplicationStatus.IN_REVIEW,
        )
        db.add(app)
        db.commit()

        # Step overdue on critical path (REQ-SITING-001 has duration 21 days)
        s1 = ApprovalStep(
            application_id=app.id,
            step_name="Critical Land Approval",
            requirement_id="REQ-SITING-001",
            is_critical_path=True,
            status=StepStatus.IN_PROGRESS,
            started_at=datetime(2026, 1, 1),  # Started way in past -> Overdue!
        )
        db.add(s1)
        db.commit()

        overview = AnalyticsService.get_overview(db)
        # Should contain INSIGHT-CRIT-PATH with CRITICAL priority
        crit_insight = next((i for i in overview.insights if i.id == "INSIGHT-CRIT-PATH"), None)
        assert crit_insight is not None
        assert crit_insight.priority == "CRITICAL"
        assert "overdue" in crit_insight.message.lower()

    def test_trends_aggregation(self, db, applicant_user):
        """Verifies monthly grouping of applications and escalations."""
        ClockService.reset()
        biz = Business(name="Iota Infra", user_id=applicant_user.id)
        db.add(biz)
        db.commit()

        app1 = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="App Oct",
            created_at=datetime(2026, 10, 1, 10, 0),
            status=ApplicationStatus.APPROVED,
            completed_at=datetime(2026, 10, 15, 12, 0),
        )
        app2 = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="App Nov",
            created_at=datetime(2026, 11, 1, 10, 0),
            status=ApplicationStatus.IN_REVIEW,
        )
        db.add_all([app1, app2])
        db.commit()

        trends = AnalyticsService.get_trends(db)
        assert trends.insufficient_data is False
        assert len(trends.trends) >= 2
        oct_trend = next(t for t in trends.trends if t.month == "2026-10")
        assert oct_trend.applications_created == 1
        assert oct_trend.applications_completed == 1


class TestAnalyticsAPIEndpoints:
    def test_admin_authorized_endpoints(self, client, db, admin_user):
        """Admin user can successfully query all analytics endpoints."""
        token = get_token(client, admin_user.email)
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Overview
        r1 = client.get("/api/admin/analytics/overview", headers=headers)
        assert r1.status_code == 200
        data1 = r1.json()
        assert "kpis" in data1
        assert "insights" in data1
        assert "sla_health" in data1
        assert data1["data_status"] == "DEMO"

        # 2. Departments
        r2 = client.get("/api/admin/analytics/departments", headers=headers)
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)

        # 3. Bottlenecks
        r3 = client.get("/api/admin/analytics/bottlenecks", headers=headers)
        assert r3.status_code == 200
        assert isinstance(r3.json(), list)

        # 4. Trends
        r4 = client.get("/api/admin/analytics/trends", headers=headers)
        assert r4.status_code == 200
        data4 = r4.json()
        assert "trends" in data4
        assert "insufficient_data" in data4

    def test_applicant_forbidden_from_admin_analytics(self, client, db, applicant_user):
        """Applicant cannot access any administrative analytics endpoints (403 Forbidden)."""
        token = get_token(client, applicant_user.email)
        headers = {"Authorization": f"Bearer {token}"}

        for path in [
            "/api/admin/analytics/overview",
            "/api/admin/analytics/departments",
            "/api/admin/analytics/bottlenecks",
            "/api/admin/analytics/trends",
        ]:
            r = client.get(path, headers=headers)
            assert r.status_code == 403, f"Expected 403 on {path}, got {r.status_code}"

    def test_officer_forbidden_from_admin_analytics(self, client, db, officer_user):
        """Officer without admin role cannot access admin analytics endpoints (403 Forbidden)."""
        token = get_token(client, officer_user.email)
        headers = {"Authorization": f"Bearer {token}"}

        for path in [
            "/api/admin/analytics/overview",
            "/api/admin/analytics/departments",
            "/api/admin/analytics/bottlenecks",
            "/api/admin/analytics/trends",
        ]:
            r = client.get(path, headers=headers)
            assert r.status_code == 403, f"Expected 403 on {path}, got {r.status_code}"

    def test_unauthenticated_request_rejected(self, client):
        """Unauthenticated requests receive 401 Unauthorized."""
        for path in [
            "/api/admin/analytics/overview",
            "/api/admin/analytics/departments",
            "/api/admin/analytics/bottlenecks",
            "/api/admin/analytics/trends",
        ]:
            r = client.get(path)
            assert r.status_code == 401, f"Expected 401 on {path}, got {r.status_code}"

    def test_repeated_analytics_calls_are_deterministic(self, client, admin_user):
        """Consecutive calls return identical deterministic outputs."""
        token = get_token(client, admin_user.email)
        headers = {"Authorization": f"Bearer {token}"}

        r1 = client.get("/api/admin/analytics/overview", headers=headers).json()
        r2 = client.get("/api/admin/analytics/overview", headers=headers).json()

        # Compare KPIs and insights (excluding microsecond timestamps in generated_at)
        assert r1["kpis"] == r2["kpis"]
        assert r1["insights"] == r2["insights"]
        assert r1["sla_health"] == r2["sla_health"]
        assert r1["document_health"] == r2["document_health"]
        assert r1["inspection_health"] == r2["inspection_health"]
        assert r1["compliance_health"] == r2["compliance_health"]

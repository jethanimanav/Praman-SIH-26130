import pytest
from datetime import datetime, timedelta
from app.models.workflow import ApprovalStep, StepStatus, Application, ApplicationStatus
from app.models.business import Business, RegulatoryProfile
from app.models.escalation import EscalationEvent
from app.sla.schema import SLAConfig, SLAStatus, EscalationStatus
from app.sla.engine import SLAEngine
from app.escalation.engine import EscalationEngine
from app.core.clock import ClockService
from tests.conftest import get_token


@pytest.fixture(autouse=True)
def reset_clock():
    ClockService.reset()
    yield
    ClockService.reset()


@pytest.fixture
def mock_step():
    now = datetime(2026, 10, 1, 10, 0, 0)
    step = ApprovalStep(
        id=101,
        application_id=1,
        requirement_id="REQ-SITING-001",
        step_name="Industrial Siting Clearance",
        department="Industrial Planning",
        estimated_timeline_days=20,
        status=StepStatus.IN_PROGRESS,
        started_at=now,
        completed_at=None,
        is_paused=False,
        paused_at=None,
        total_paused_seconds=0,
    )
    return step


@pytest.fixture
def mock_sla_config():
    return SLAConfig(
        sla_id="SLA-DEMO-001",
        requirement_id="REQ-SITING-001",
        duration_days=20,
        calendar_type="calendar_days",
        warning_threshold=0.8,  # Warning at 16 days (80%)
        escalation_threshold_days=3.0,  # Escalate at 3 days overdue (23 days)
        escalation_level="LEVEL_1",
        escalation_recipient_role="supervising_officer",
        data_status="DEMO",
    )


class TestSLAEngineCalculations:

    def test_sla_not_started_for_ready_or_blocked_step(self, mock_step, mock_sla_config):
        mock_step.status = StepStatus.READY
        mock_step.started_at = None
        current_time = datetime(2026, 10, 5, 10, 0, 0)

        res = SLAEngine.calculate_step_sla(mock_step, mock_sla_config, current_time)
        assert res.status == SLAStatus.NOT_STARTED
        assert res.elapsed_days == 0.0
        assert res.remaining_days == 20.0
        assert res.is_warning is False
        assert res.is_overdue is False

    def test_sla_on_track_calculation(self, mock_step, mock_sla_config):
        # Started Oct 1. Current time Oct 6 (5 days elapsed out of 20) -> ON_TRACK
        current_time = datetime(2026, 10, 6, 10, 0, 0)

        res = SLAEngine.calculate_step_sla(mock_step, mock_sla_config, current_time)
        assert res.status == SLAStatus.ON_TRACK
        assert res.elapsed_days == 5.0
        assert res.remaining_days == 15.0
        assert res.days_overdue == 0.0
        assert res.is_warning is False
        assert res.is_overdue is False
        assert res.deadline == datetime(2026, 10, 21, 10, 0, 0)

    def test_sla_warning_threshold_trigger(self, mock_step, mock_sla_config):
        # 80% of 20 days is 16 days. On Oct 17 (16 days elapsed) -> WARNING
        current_time = datetime(2026, 10, 17, 10, 0, 0)

        res = SLAEngine.calculate_step_sla(mock_step, mock_sla_config, current_time)
        assert res.status == SLAStatus.WARNING
        assert res.is_warning is True
        assert res.is_overdue is False
        assert res.elapsed_days == 16.0
        assert res.remaining_days == 4.0

    def test_sla_overdue_calculation(self, mock_step, mock_sla_config):
        # Deadline Oct 21. Current time Oct 23 -> 2 days OVERDUE
        current_time = datetime(2026, 10, 23, 10, 0, 0)

        res = SLAEngine.calculate_step_sla(mock_step, mock_sla_config, current_time)
        assert res.status == SLAStatus.OVERDUE
        assert res.is_warning is True
        assert res.is_overdue is True
        assert res.remaining_days == 0.0
        assert res.days_overdue == 2.0

    def test_sla_completed_stops_timer(self, mock_step, mock_sla_config):
        # Started Oct 1. Completed Oct 11 (10 days elapsed). Current time is Oct 30.
        mock_step.status = StepStatus.APPROVED
        mock_step.completed_at = datetime(2026, 10, 11, 10, 0, 0)
        current_time = datetime(2026, 10, 30, 10, 0, 0)

        res = SLAEngine.calculate_step_sla(mock_step, mock_sla_config, current_time)
        assert res.status == SLAStatus.COMPLETED
        assert res.elapsed_days == 10.0
        assert res.remaining_days == 0.0
        assert res.is_overdue is False
        assert res.completed_at == datetime(2026, 10, 11, 10, 0, 0)

    def test_missing_sla_produces_verification_required(self, mock_step):
        current_time = datetime(2026, 10, 5, 10, 0, 0)
        # Passing None for SLA config
        res = SLAEngine.calculate_step_sla(mock_step, None, current_time)
        assert res.status == SLAStatus.SLA_VERIFICATION_REQUIRED
        assert res.data_status == "VERIFICATION_REQUIRED"
        assert res.calendar_note == "SLA_CALENDAR_VERIFICATION_REQUIRED"

    def test_sla_pause_and_resume_extends_deadline(self, mock_step, mock_sla_config):
        # Started Oct 1. Step was paused for 5 days (432,000 seconds).
        mock_step.total_paused_seconds = 5 * 86400
        mock_step.is_paused = False

        # On Oct 19, normally without pause 18 days would be WARNING (warning threshold is 16 days).
        # But with 5 paused days, effective elapsed is only 13 days (< 16d warning)!
        # Thus current status remains ON_TRACK.
        current_time = datetime(2026, 10, 19, 10, 0, 0)

        res = SLAEngine.calculate_step_sla(mock_step, mock_sla_config, current_time)
        assert res.deadline == datetime(2026, 10, 26, 10, 0, 0)
        assert res.status == SLAStatus.ON_TRACK
        assert res.elapsed_days == 13.0  # 18 calendar days - 5 paused days = 13 effective days
        assert res.remaining_days == 7.0
        assert res.is_warning is False
        assert res.is_overdue is False

    def test_zero_duration_edge_case(self, mock_step):
        zero_config = SLAConfig(
            sla_id="SLA-ZERO",
            requirement_id="REQ-SITING-001",
            duration_days=0,
            warning_threshold=0.8,
            escalation_threshold_days=0.0,
            data_status="DEMO",
        )
        current_time = mock_step.started_at + timedelta(seconds=1)
        res = SLAEngine.calculate_step_sla(mock_step, zero_config, current_time)
        assert res.status == SLAStatus.OVERDUE
        assert res.is_overdue is True


class TestEscalationEngine:

    def test_escalation_triggers_at_threshold_and_idempotency(self, db):
        started = datetime(2026, 10, 1, 10, 0, 0)
        app = Application(
            business_id=1,
            applicant_id=1,
            title="Escalation App",
            status=ApplicationStatus.IN_REVIEW,
            created_at=started,
        )
        db.add(app)
        db.flush()

        step = ApprovalStep(
            application_id=app.id,
            requirement_id="REQ-SITING-001",
            step_name="Siting Step",
            status=StepStatus.IN_PROGRESS,
            started_at=started,
            estimated_timeline_days=20,
        )
        db.add(step)
        db.commit()
        db.refresh(app)

        cfg = SLAConfig(
            sla_id="SLA-DEMO-001",
            requirement_id="REQ-SITING-001",
            duration_days=20,
            escalation_threshold_days=3.0,
            escalation_level="LEVEL_1",
            escalation_recipient_role="supervising_officer",
            data_status="DEMO",
        )
        configs = {"REQ-SITING-001": cfg}

        # 1. At 21 days (1 day overdue, below 3-day threshold) -> NO escalation
        t1 = started + timedelta(days=21)
        events1 = EscalationEngine.evaluate_and_escalate(db, app, configs, t1)
        assert len(events1) == 0

        # 2. At 24 days (4 days overdue, exceeds 3-day threshold) -> ESCALATION TRIGGERED
        t2 = started + timedelta(days=24)
        events2 = EscalationEngine.evaluate_and_escalate(db, app, configs, t2)
        assert len(events2) == 1
        ev = events2[0]
        assert ev.level == "LEVEL_1"
        assert ev.recipient_role == "supervising_officer"
        assert ev.status == EscalationStatus.TRIGGERED
        assert ev.days_overdue >= 4.0

        # 3. IDEMPOTENCY CHECK: Call evaluate_and_escalate again -> NO duplicate event created!
        events3 = EscalationEngine.evaluate_and_escalate(db, app, configs, t2 + timedelta(hours=2))
        assert len(events3) == 1
        assert events3[0].id == ev.id
        # Check DB count
        total_events = db.query(EscalationEvent).filter(EscalationEvent.application_id == app.id).count()
        assert total_events == 1

    def test_missing_escalation_recipient_yields_configuration_required(self, db):
        started = datetime(2026, 10, 1, 10, 0, 0)
        app = Application(
            business_id=1,
            applicant_id=1,
            title="App Unconfigured Escalation",
            status=ApplicationStatus.IN_REVIEW,
            created_at=started,
        )
        db.add(app)
        db.flush()

        step = ApprovalStep(
            application_id=app.id,
            requirement_id="REQ-WATER-GW-001",
            step_name="Ground Water",
            status=StepStatus.IN_PROGRESS,
            started_at=started,
            estimated_timeline_days=10,
        )
        db.add(step)
        db.commit()

        # Config with recipient_role = None
        cfg = SLAConfig(
            sla_id="SLA-DEMO-007",
            requirement_id="REQ-WATER-GW-001",
            duration_days=10,
            escalation_threshold_days=1.0,
            escalation_level="LEVEL_1",
            escalation_recipient_role=None,
            data_status="DEMO",
        )
        configs = {"REQ-WATER-GW-001": cfg}

        t_overdue = started + timedelta(days=15)
        events = EscalationEngine.evaluate_and_escalate(db, app, configs, t_overdue)
        assert len(events) == 1
        assert events[0].recipient_role == "ESCALATION_CONFIGURATION_REQUIRED"


class TestSLAAPIEndpoints:

    def test_get_application_sla_and_clock_simulation(self, client, applicant_user, db):
        token = get_token(client, "test.applicant@test.rop")

        # Setup application with confirmed business
        biz = Business(user_id=applicant_user.id, name="Auto Hub")
        db.add(biz)
        db.commit()
        db.refresh(biz)

        base_time = datetime(2026, 10, 1, 10, 0, 0)
        ClockService.set_time(base_time)

        app = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="Auto Hub App",
            status=ApplicationStatus.IN_REVIEW,
            critical_path_steps=["REQ-SITING-001"],
            created_at=base_time,
        )
        db.add(app)
        db.flush()

        step1 = ApprovalStep(
            application_id=app.id,
            requirement_id="REQ-SITING-001",
            step_name="Siting",
            status=StepStatus.IN_PROGRESS,
            started_at=base_time,
            estimated_timeline_days=21,
            is_critical_path=True,
        )
        db.add(step1)
        db.commit()

        # 1. Initially ON_TRACK
        res = client.get(
            f"/api/workflow/applications/{app.id}/sla",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["overall_sla_status"] == "ON_TRACK"
        assert data["is_clock_simulated"] is True
        assert data["critical_path_sla_status"] == "ON_TRACK"

        # 2. Advance clock +18 days -> Siting SLA is 21 days, warning at 80% (16.8 days) -> WARNING
        ClockService.advance(days=18)
        res2 = client.get(
            f"/api/workflow/applications/{app.id}/sla",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["overall_sla_status"] == "WARNING"
        assert data2["critical_path_sla_status"] == "WARNING"

        # 3. Advance clock +10 more days (28 days total -> 7 days overdue, threshold is 3 days) -> OVERDUE & ESCALATED
        ClockService.advance(days=10)
        res3 = client.get(
            f"/api/workflow/applications/{app.id}/sla",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["overall_sla_status"] == "OVERDUE"
        assert data3["active_escalations_count"] == 1
        siting_res = next(s for s in data3["steps"] if s["requirement_id"] == "REQ-SITING-001")
        assert siting_res["sla"]["escalation_triggered"] is True
        assert siting_res["sla"]["escalation_recipient"] == "supervising_officer"

        # 4. Check escalations endpoint
        res_esc = client.get(
            f"/api/workflow/applications/{app.id}/escalations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_esc.status_code == 200
        escs = res_esc.json()
        assert len(escs) == 1
        assert escs[0]["level"] == "LEVEL_1"

    def test_step_pause_and_resume_endpoints(self, client, applicant_user, db):
        token = get_token(client, "test.applicant@test.rop")
        biz = Business(user_id=applicant_user.id, name="Pause Unit")
        db.add(biz)
        db.commit()

        start = datetime(2026, 10, 1, 10, 0, 0)
        ClockService.set_time(start)

        app = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="Pause App",
            status=ApplicationStatus.IN_REVIEW,
            created_at=start,
        )
        db.add(app)
        db.flush()

        step = ApprovalStep(
            application_id=app.id,
            requirement_id="REQ-SITING-001",
            step_name="Siting",
            status=StepStatus.IN_PROGRESS,
            started_at=start,
            estimated_timeline_days=21,
        )
        db.add(step)
        db.commit()

        # Pause step
        ClockService.advance(days=2)
        res_pause = client.post(
            f"/api/workflow/applications/{app.id}/steps/{step.id}/pause",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_pause.status_code == 200
        assert res_pause.json()["sla"]["status"] == "PAUSED"
        assert res_pause.json()["sla"]["is_paused"] is True

        # Advance while paused by 4 days
        ClockService.advance(days=4)

        # Resume step
        res_resume = client.post(
            f"/api/workflow/applications/{app.id}/steps/{step.id}/resume",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_resume.status_code == 200
        data = res_resume.json()["sla"]
        assert data["is_paused"] is False
        assert data["status"] == "ON_TRACK"
        assert data["paused_seconds"] >= 4 * 86400

    def test_ownership_security_sla_endpoints(self, client, applicant_user, officer_user, db):
        token = get_token(client, "test.applicant@test.rop")
        biz = Business(user_id=applicant_user.id, name="Secure Biz")
        db.add(biz)
        db.commit()

        app = Application(
            business_id=biz.id,
            applicant_id=applicant_user.id,
            title="Secure App",
            status=ApplicationStatus.IN_REVIEW,
        )
        db.add(app)
        db.commit()

        # Another applicant cannot access
        from app.models.user import User, UserRole
        from app.core.security import get_password_hash, create_access_token
        app2 = User(
            email="other.user@test.rop",
            full_name="Other User",
            hashed_password=get_password_hash("TestPass@123"),
            role=UserRole.APPLICANT,
            is_active=True,
        )
        db.add(app2)
        db.commit()

        other_token = create_access_token(data={"sub": "other.user@test.rop", "role": "applicant"})
        res = client.get(
            f"/api/workflow/applications/{app.id}/sla",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert res.status_code == 403
        assert "Unauthorized" in res.json()["detail"]

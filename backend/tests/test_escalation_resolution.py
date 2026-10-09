import pytest
from datetime import datetime, timedelta
from app.models.workflow import Application, ApprovalStep, StepStatus, ApplicationStatus
from app.models.business import Business, RegulatoryProfile
from app.models.escalation import EscalationEvent
from app.models.audit import AuditLog
from app.sla.schema import EscalationStatus, SLAStatus
from app.core.clock import ClockService
from tests.conftest import get_token


@pytest.fixture(autouse=True)
def reset_clock():
    ClockService.reset()
    yield
    ClockService.reset()


@pytest.fixture
def setup_escalation_data(db, applicant_user, officer_user, admin_user):
    """Sets up an application with an active overdue step and a triggered escalation."""
    business = Business(
        name="Auto Components Ltd",
        user_id=applicant_user.id,
    )
    db.add(business)
    db.flush()

    started = datetime(2026, 10, 1, 10, 0, 0)
    app = Application(
        business_id=business.id,
        applicant_id=applicant_user.id,
        title="Automotive Clearance Application",
        status=ApplicationStatus.IN_REVIEW,
        critical_path_steps=["REQ-SITING-001", "REQ-ENV-CTE-001"],
        created_at=started,
    )
    db.add(app)
    db.flush()

    step1 = ApprovalStep(
        application_id=app.id,
        requirement_id="REQ-SITING-001",
        step_name="Industrial Siting Clearance",
        department="Directorate of Industrial Planning (DEMO)",
        estimated_timeline_days=21,
        status=StepStatus.IN_PROGRESS,
        started_at=started,
        is_critical_path=True,
    )
    step2 = ApprovalStep(
        application_id=app.id,
        requirement_id="REQ-POWER-HT-001",
        step_name="HT Power Feasibility",
        department="State Electricity Utility (DEMO)",
        estimated_timeline_days=20,
        status=StepStatus.READY,
        is_critical_path=False,
    )
    db.add_all([step1, step2])
    db.flush()

    # Escalation on step1
    esc = EscalationEvent(
        application_id=app.id,
        approval_step_id=step1.id,
        requirement_id="REQ-SITING-001",
        sla_id="SLA-DEMO-001",
        trigger_type="OVERDUE_THRESHOLD_BREACH",
        level="LEVEL_1",
        recipient_role="supervising_officer",
        days_overdue=4.5,
        reason="Approval step exceeded configured SLA deadline by 4.5 days.",
        status=EscalationStatus.TRIGGERED,
        triggered_at=started + timedelta(days=25),
    )
    db.add(esc)
    db.commit()
    db.refresh(app)
    db.refresh(step1)
    db.refresh(esc)

    return {
        "app": app,
        "step1": step1,
        "step2": step2,
        "escalation": esc,
    }


class TestEscalationResolutionLifecycle:

    def test_officer_can_view_permitted_escalations(self, client, officer_user, setup_escalation_data):
        token = get_token(client, officer_user.email)
        res = client.get(
            "/api/officer/escalations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        esc = data[0]
        assert esc["id"] == setup_escalation_data["escalation"].id
        assert esc["requirement_id"] == "REQ-SITING-001"
        assert esc["status"] == "TRIGGERED"
        assert esc["is_critical_path"] is True
        assert esc["data_status"] == "DEMO"

    def test_applicant_cannot_access_officer_queue(self, client, applicant_user):
        token = get_token(client, applicant_user.email)
        res = client.get(
            "/api/officer/escalations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
        assert "Access denied" in res.json()["detail"]

    def test_applicant_cannot_acknowledge_escalation(self, client, applicant_user, setup_escalation_data):
        token = get_token(client, applicant_user.email)
        esc_id = setup_escalation_data["escalation"].id
        res = client.post(
            f"/api/officer/escalations/{esc_id}/acknowledge",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403

    def test_applicant_cannot_resolve_escalation(self, client, applicant_user, setup_escalation_data):
        token = get_token(client, applicant_user.email)
        esc_id = setup_escalation_data["escalation"].id
        res = client.post(
            f"/api/officer/escalations/{esc_id}/resolve",
            json={"resolution_note": "Trying to resolve without permission"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403

    def test_officer_can_acknowledge_escalation_and_records_audit(self, client, officer_user, setup_escalation_data, db):
        token = get_token(client, officer_user.email)
        esc_id = setup_escalation_data["escalation"].id

        res = client.post(
            f"/api/officer/escalations/{esc_id}/acknowledge",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ACKNOWLEDGED"
        assert data["acknowledged_by_email"] == officer_user.email
        assert data["acknowledged_at"] is not None

        # Verify DB entity
        db_esc = db.query(EscalationEvent).filter(EscalationEvent.id == esc_id).first()
        assert db_esc.status == EscalationStatus.ACKNOWLEDGED
        assert db_esc.acknowledged_by_id == officer_user.id
        assert db_esc.acknowledged_at is not None

        # Verify AuditLog
        audit = db.query(AuditLog).filter(
            AuditLog.action == "escalation.acknowledged",
            AuditLog.entity_id == str(esc_id),
        ).first()
        assert audit is not None
        assert audit.user_email == officer_user.email
        assert audit.user_role == "officer"
        assert audit.new_value["status"] == "ACKNOWLEDGED"

    def test_duplicate_acknowledgement_fails(self, client, officer_user, setup_escalation_data):
        token = get_token(client, officer_user.email)
        esc_id = setup_escalation_data["escalation"].id

        # First acknowledge succeeds
        res1 = client.post(
            f"/api/officer/escalations/{esc_id}/acknowledge",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res1.status_code == 200

        # Duplicate acknowledge fails
        res2 = client.post(
            f"/api/officer/escalations/{esc_id}/acknowledge",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res2.status_code == 400
        assert "already ACKNOWLEDGED" in res2.json()["detail"]

    def test_resolution_requires_meaningful_note(self, client, officer_user, setup_escalation_data):
        token = get_token(client, officer_user.email)
        esc_id = setup_escalation_data["escalation"].id

        # Empty string
        res = client.post(
            f"/api/officer/escalations/{esc_id}/resolve",
            json={"resolution_note": ""},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 422 or res.status_code == 400

        # Whitespace only
        res2 = client.post(
            f"/api/officer/escalations/{esc_id}/resolve",
            json={"resolution_note": "   "},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res2.status_code == 400
        assert "non-empty resolution note is required" in res2.json()["detail"]

    def test_officer_resolves_escalation_and_records_audit(self, client, officer_user, setup_escalation_data, db):
        token = get_token(client, officer_user.email)
        esc_id = setup_escalation_data["escalation"].id

        # Acknowledge first
        client.post(
            f"/api/officer/escalations/{esc_id}/acknowledge",
            headers={"Authorization": f"Bearer {token}"},
        )

        note = "Conducted site inspection; clearances verified with nodal supervisor."
        res = client.post(
            f"/api/officer/escalations/{esc_id}/resolve",
            json={"resolution_note": note},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "RESOLVED"
        assert data["resolved_by_email"] == officer_user.email
        assert data["resolved_at"] is not None
        assert data["resolution_note"] == note

        # Verify DB entity
        db_esc = db.query(EscalationEvent).filter(EscalationEvent.id == esc_id).first()
        assert db_esc.status == EscalationStatus.RESOLVED
        assert db_esc.resolved_by_id == officer_user.id
        assert db_esc.resolution_note == note

        # Verify AuditLog
        audit = db.query(AuditLog).filter(
            AuditLog.action == "escalation.resolved",
            AuditLog.entity_id == str(esc_id),
        ).first()
        assert audit is not None
        assert audit.user_email == officer_user.email
        assert audit.new_value["status"] == "RESOLVED"
        assert audit.new_value["resolution_note"] == note

    def test_cannot_re_resolve_or_acknowledge_resolved_escalation(self, client, officer_user, setup_escalation_data):
        token = get_token(client, officer_user.email)
        esc_id = setup_escalation_data["escalation"].id

        # Resolve
        client.post(
            f"/api/officer/escalations/{esc_id}/resolve",
            json={"resolution_note": "Initial resolution"},
            headers={"Authorization": f"Bearer {token}"},
        )

        # Cannot acknowledge after resolved
        res_ack = client.post(
            f"/api/officer/escalations/{esc_id}/acknowledge",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_ack.status_code == 400
        assert "already RESOLVED" in res_ack.json()["detail"]

        # Cannot resolve again
        res_res = client.post(
            f"/api/officer/escalations/{esc_id}/resolve",
            json={"resolution_note": "Second resolution attempt"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_res.status_code == 400
        assert "already RESOLVED" in res_res.json()["detail"]

    def test_officer_overview_metrics_from_actual_data(self, client, officer_user, setup_escalation_data):
        token = get_token(client, officer_user.email)
        res = client.get(
            "/api/officer/overview",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        ov = res.json()
        assert ov["open_escalations"] == 1
        assert ov["triggered_escalations"] == 1
        assert ov["acknowledged_escalations"] == 0
        assert ov["resolved_escalations"] == 0
        assert ov["in_progress_steps"] == 1
        assert ov["data_status"] == "DEMO"

    def test_filtering_officer_queue(self, client, officer_user, setup_escalation_data):
        token = get_token(client, officer_user.email)

        # Filter by status OPEN -> should include TRIGGERED
        res_open = client.get(
            "/api/officer/escalations?status=OPEN",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert len(res_open.json()) == 1

        # Filter by status RESOLVED -> should be empty
        res_res = client.get(
            "/api/officer/escalations?status=RESOLVED",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert len(res_res.json()) == 0

        # Filter by critical_path=true
        res_crit = client.get(
            "/api/officer/escalations?critical_path=true",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert len(res_crit.json()) == 1


class TestAdminOperationsAndAnalytics:

    def test_admin_can_view_operational_overview(self, client, admin_user, setup_escalation_data):
        token = get_token(client, admin_user.email)
        res = client.get(
            "/api/admin/overview",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_applications"] >= 1
        assert data["total_steps"] >= 2
        assert data["total_escalations"] >= 1
        assert data["active_escalations"] >= 1
        assert "sla_health" in data
        assert data["data_status"] == "DEMO"

    def test_admin_bottleneck_detection_from_real_data(self, client, admin_user, setup_escalation_data):
        token = get_token(client, admin_user.email)
        res = client.get(
            "/api/admin/bottlenecks",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        bottlenecks = res.json()
        assert len(bottlenecks) >= 1
        b0 = bottlenecks[0]
        assert b0["requirement_id"] == "REQ-SITING-001"
        assert b0["is_critical_path"] is True
        assert b0["escalation_status"] == "TRIGGERED"

    def test_empty_database_yields_zero_not_hallucinated_metrics(self, client, admin_user):
        token = get_token(client, admin_user.email)
        # Empty DB (except admin user)
        res = client.get(
            "/api/admin/overview",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total_applications"] == 0
        assert data["total_steps"] == 0
        assert data["total_escalations"] == 0
        assert data["active_escalations"] == 0
        assert data["critical_path_overdue_count"] == 0
        assert data["average_resolution_hours"] is None

    def test_officer_can_view_escalation_detail(self, client, officer_user, setup_escalation_data):
        token = get_token(client, officer_user.email)
        esc_id = setup_escalation_data["escalation"].id
        res = client.get(
            f"/api/officer/escalations/{esc_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == esc_id
        assert data["step_name"] == "Industrial Siting Clearance"
        assert data["is_critical_path"] is True

    def test_full_audit_trail_ordered_sequence(self, client, officer_user, setup_escalation_data, db):
        token = get_token(client, officer_user.email)
        esc_id = setup_escalation_data["escalation"].id

        # 1. Acknowledge
        client.post(
            f"/api/officer/escalations/{esc_id}/acknowledge",
            headers={"Authorization": f"Bearer {token}"},
        )
        # 2. Resolve
        client.post(
            f"/api/officer/escalations/{esc_id}/resolve",
            json={"resolution_note": "Inspection cleared and verified."},
            headers={"Authorization": f"Bearer {token}"},
        )

        logs = (
            db.query(AuditLog)
            .filter(AuditLog.entity_id == str(esc_id))
            .order_by(AuditLog.id.asc())
            .all()
        )
        actions = [log.action for log in logs]
        assert "escalation.acknowledged" in actions
        assert "escalation.resolved" in actions
        ack_index = actions.index("escalation.acknowledged")
        res_index = actions.index("escalation.resolved")
        assert ack_index < res_index

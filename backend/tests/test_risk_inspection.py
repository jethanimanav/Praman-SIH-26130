from datetime import datetime, timedelta
import pytest
from app.models.business import Business, RegulatoryProfile
from app.models.inspection import JointInspection, InspectionReport, InspectionStatus, InspectionOutcome
from app.models.user import User, UserRole
from app.models.workflow import Application
from app.core.security import get_password_hash
from app.workflow.service import WorkflowService
from app.risk.engine import RiskEngine
from app.risk.schema import RiskCategory, RiskColorCode
from tests.conftest import get_token


@pytest.fixture
def other_applicant_user(db):
    """Creates a second applicant user to verify tenant isolation."""
    user = User(
        email="other.applicant@test.rop",
        full_name="Other Applicant",
        hashed_password=get_password_hash("TestPass@123"),
        role=UserRole.APPLICANT,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def workflow_app(db, applicant_user):
    """Creates a business and workflow application with Scenario C rules."""
    biz = Business(
        user_id=applicant_user.id,
        name="Apex Precision Engineering",
        description="Auto components manufacturing",
    )
    db.add(biz)
    db.commit()
    db.refresh(biz)

    scenario_c_confirmed = {
        "sector": "manufacturing",
        "location": {"zone_type": "industrial"},
        "processes": ["electroplating", "metal_fabrication"],
        "effluent_generation": True,
        "air_emissions": True,
        "hazardous_waste_generated": True,
        "workers_count": 35,
        "power_connected_kw": 250.0,
        "built_up_area_sqm": 2500.0,
        "water_source": "borewell",
    }
    profile = RegulatoryProfile(
        business_id=biz.id,
        extracted_data=scenario_c_confirmed,
        confirmed_data=scenario_c_confirmed,
        is_confirmed=True,
    )
    db.add(profile)
    db.commit()

    application = WorkflowService.create_application_from_discovery(
        db=db,
        business=biz,
        user=applicant_user,
        title="Apex Scenario C Application",
    )
    return application


class TestRiskAssessmentEngine:

    def test_risk_engine_scenario_c_high_risk(self):
        """Full Scenario C profile triggers hazardous waste, effluent, high power, large area -> HIGH (RED)."""
        data = {
            "sector": "manufacturing",
            "hazardous_waste_generated": True,
            "effluent_generation": True,
            "air_emissions": True,
            "workers_count": 55,
            "power_connected_kw": 250.0,
            "built_up_area_sqm": 2500.0,
            "water_source": "borewell",
        }
        res = RiskEngine.evaluate_risk(data)
        assert res.risk_category == RiskCategory.HIGH
        assert res.color_code == RiskColorCode.RED
        assert res.composite_score >= 70
        assert res.joint_inspection_mandatory is True
        assert res.inspection_frequency_months == 12
        assert res.is_complete is True
        assert len(res.missing_critical_fields) == 0

        # Verify mandated departments
        assert "State Pollution Control Board (DEMO)" in res.mandated_departments
        assert "Directorate of Industrial Safety & Health (DEMO)" in res.mandated_departments
        assert "Fire & Emergency Services (DEMO)" in res.mandated_departments
        assert "State Electricity Distribution Corporation (DEMO)" in res.mandated_departments
        assert "Ground Water Authority (DEMO)" in res.mandated_departments

        # Verify inspection checklist
        assert any("Hazardous waste" in item for item in res.inspection_checklist)
        assert any("Effluent Treatment Plant" in item for item in res.inspection_checklist)
        assert any("Fire sprinkler" in item for item in res.inspection_checklist)

    def test_risk_engine_medium_risk(self):
        """Facility with moderate workers (15), moderate built-up (1200 sqm), no toxic waste -> MEDIUM (ORANGE)."""
        data = {
            "sector": "manufacturing",
            "hazardous_waste_generated": False,
            "effluent_generation": False,
            "air_emissions": True,  # 10 pts
            "workers_count": 15,    # 8 pts (moderate)
            "power_connected_kw": 120.0,  # 15 pts
            "built_up_area_sqm": 1200.0,  # 10 pts (moderate)
            "water_source": "municipal",
        }
        res = RiskEngine.evaluate_risk(data)
        # Score = 10 + 8 + 15 + 10 = 43 pts -> MEDIUM
        assert res.risk_category == RiskCategory.MEDIUM
        assert res.color_code == RiskColorCode.ORANGE
        assert 40 <= res.composite_score < 70
        assert res.joint_inspection_mandatory is True

    def test_risk_engine_low_risk(self):
        """Small non-polluting assembly unit -> LOW (GREEN), exempt from mandatory physical joint visit."""
        data = {
            "sector": "it_services",
            "hazardous_waste_generated": False,
            "effluent_generation": False,
            "air_emissions": False,
            "workers_count": 8,
            "power_connected_kw": 15.0,
            "built_up_area_sqm": 350.0,
            "water_source": "municipal",
        }
        res = RiskEngine.evaluate_risk(data)
        assert res.risk_category == RiskCategory.LOW
        assert res.color_code == RiskColorCode.GREEN
        assert res.composite_score < 40
        assert res.joint_inspection_mandatory is False

    def test_risk_engine_missing_critical_fields(self):
        """Empty profile flags is_complete=False and lists missing critical fields without guessing."""
        data = {}
        res = RiskEngine.evaluate_risk(data)
        assert res.is_complete is False
        assert "hazardous_waste_generated" in res.missing_critical_fields
        assert "built_up_area_sqm" in res.missing_critical_fields
        assert "workers_count" in res.missing_critical_fields
        assert "power_connected_kw" in res.missing_critical_fields

    def test_risk_engine_tiered_factor_deduplication(self):
        """Worker count >= 50 receives 15 pts and does NOT also award moderate_worker_count (8 pts)."""
        data = {
            "workers_count": 75,
            "power_connected_kw": 0,
            "built_up_area_sqm": 0,
            "hazardous_waste_generated": False,
        }
        res = RiskEngine.evaluate_risk(data)
        high_factor = next(f for f in res.factors if f.factor_key == "high_worker_count")
        mod_factor = next(f for f in res.factors if f.factor_key == "moderate_worker_count")
        assert high_factor.triggered is True
        assert high_factor.score_awarded == 15
        assert mod_factor.triggered is False
        assert mod_factor.score_awarded == 0


class TestJointInspectionSchedulingAPI:

    def test_get_application_risk_assessment_api(self, client, db, workflow_app, applicant_user):
        """Applicant can retrieve deterministic risk assessment for their application."""
        token = get_token(client, applicant_user.email)
        res = client.get(
            f"/api/workflow/applications/{workflow_app.id}/risk-assessment",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["risk_category"] == "HIGH"
        assert data["color_code"] == "RED"
        assert data["composite_score"] >= 70
        assert data["joint_inspection_mandatory"] is True
        assert len(data["mandated_departments"]) > 0

    def test_schedule_joint_inspection_api(self, client, db, workflow_app, applicant_user):
        """Applicant can schedule a synchronized joint inspection across all departments."""
        token = get_token(client, applicant_user.email)
        target_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "scheduled_date": target_date,
                "time_slot": "10:00 AM - 01:00 PM",
                "notes": "Site manager available on mobile: +91 9876543210",
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "SCHEDULED"
        assert data["application_id"] == workflow_app.id
        assert data["risk_category"] == "HIGH"
        assert len(data["participating_departments"]) >= 3
        assert len(data["checklist_items"]) > 0
        assert data["lead_inspector_name"] is not None

    def test_cannot_schedule_multiple_active_joint_inspections(self, client, db, workflow_app, applicant_user):
        """Attempting to schedule a second joint inspection while one is active returns 400."""
        token = get_token(client, applicant_user.email)
        target_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        # First schedule
        res1 = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "scheduled_date": target_date,
                "time_slot": "10:00 AM - 01:00 PM",
            },
        )
        assert res1.status_code == 201

        # Second schedule attempt
        res2 = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "scheduled_date": target_date,
                "time_slot": "02:00 PM - 05:00 PM",
            },
        )
        assert res2.status_code == 400
        assert "already scheduled" in res2.json()["detail"]

    def test_applicant_reschedule_inspection(self, client, db, workflow_app, applicant_user):
        """Applicant can reschedule a joint inspection with mandatory reason."""
        token = get_token(client, applicant_user.email)
        target_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token}"},
            json={"scheduled_date": target_date, "time_slot": "10:00 AM - 01:00 PM"},
        )
        insp_id = res.json()["id"]

        new_date = (datetime.utcnow() + timedelta(days=10)).isoformat()
        res_resched = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/{insp_id}/reschedule",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "scheduled_date": new_date,
                "time_slot": "02:00 PM - 05:00 PM",
                "reason": "Machinery installation commissioning delay by vendor",
            },
        )
        assert res_resched.status_code == 200
        data = res_resched.json()
        assert data["status"] == "RESCHEDULED"
        assert data["time_slot"] == "02:00 PM - 05:00 PM"
        assert "Machinery installation commissioning delay" in data["notes"]

    def test_reschedule_requires_non_empty_reason(self, client, db, workflow_app, applicant_user):
        """Rescheduling with empty/blank reason returns 400."""
        token = get_token(client, applicant_user.email)
        target_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        res = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token}"},
            json={"scheduled_date": target_date, "time_slot": "10:00 AM - 01:00 PM"},
        )
        insp_id = res.json()["id"]

        res_fail = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/{insp_id}/reschedule",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "scheduled_date": target_date,
                "time_slot": "02:00 PM - 05:00 PM",
                "reason": "   ",
            },
        )
        assert res_fail.status_code == 400
        assert "reason is required" in res_fail.json()["detail"].lower()

    def test_applicant_cannot_access_unowned_application_inspections(self, client, db, workflow_app, other_applicant_user):
        """Different applicant cannot access risk assessment or schedule inspection for unowned application."""
        token = get_token(client, other_applicant_user.email)
        res = client.get(
            f"/api/workflow/applications/{workflow_app.id}/risk-assessment",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
        assert "Access forbidden" in res.json()["detail"]


class TestOfficerInspectionOperations:

    def test_officer_can_view_inspections_queue(self, client, db, workflow_app, applicant_user, officer_user):
        """Officer can view upcoming joint inspections across all applications."""
        token_app = get_token(client, applicant_user.email)
        target_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token_app}"},
            json={"scheduled_date": target_date, "time_slot": "10:00 AM - 01:00 PM"},
        )

        token_off = get_token(client, officer_user.email)
        res = client.get(
            "/api/officer/inspections",
            headers={"Authorization": f"Bearer {token_off}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        assert data[0]["application_id"] == workflow_app.id

    def test_applicant_cannot_access_officer_inspections_queue(self, client, applicant_user):
        """Applicant cannot access officer inspection management queue (403 Forbidden)."""
        token = get_token(client, applicant_user.email)
        res = client.get(
            "/api/officer/inspections",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403

    def test_officer_submit_satisfactory_inspection_report(self, client, db, workflow_app, applicant_user, officer_user):
        """Officer submits SATISFACTORY joint inspection report, completing inspection and annotating steps."""
        token_app = get_token(client, applicant_user.email)
        target_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        res_sched = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token_app}"},
            json={"scheduled_date": target_date, "time_slot": "10:00 AM - 01:00 PM"},
        )
        insp_id = res_sched.json()["id"]

        token_off = get_token(client, officer_user.email)
        findings = {
            "State Pollution Control Board (DEMO)": {"status": "COMPLIANT", "remarks": "ETP installed and operational"},
            "Directorate of Industrial Safety & Health (DEMO)": {"status": "COMPLIANT", "remarks": "Machine guarding adequate"},
            "Fire & Emergency Services (DEMO)": {"status": "COMPLIANT", "remarks": "Sprinkler system tested satisfactorily"},
        }
        res_rep = client.post(
            f"/api/officer/inspections/{insp_id}/report",
            headers={"Authorization": f"Bearer {token_off}"},
            json={
                "overall_outcome": "SATISFACTORY",
                "department_findings": findings,
                "deficiencies": [],
                "corrective_actions": "Maintain daily log of ETP flow meter readings.",
                "reinspection_required": False,
            },
        )
        assert res_rep.status_code == 201
        report = res_rep.json()
        assert report["overall_outcome"] == "SATISFACTORY"
        assert report["submitted_by_name"] == officer_user.full_name

        # Verify inspection status updated to COMPLETED
        res_insp = client.get(
            f"/api/officer/inspections/{insp_id}",
            headers={"Authorization": f"Bearer {token_off}"},
        )
        assert res_insp.json()["status"] == "COMPLETED"
        assert res_insp.json()["report"] is not None

        # Verify steps annotated
        db.refresh(workflow_app)
        annotated_steps = [s for s in workflow_app.steps if "Joint Inspection #" in (s.notes or "")]
        assert len(annotated_steps) > 0

    def test_officer_submit_deficiencies_requires_notes(self, client, db, workflow_app, applicant_user, officer_user):
        """DEFICIENCIES_NOTED or NON_COMPLIANT outcome mandates deficiencies list or corrective actions."""
        token_app = get_token(client, applicant_user.email)
        target_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        res_sched = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token_app}"},
            json={"scheduled_date": target_date, "time_slot": "10:00 AM - 01:00 PM"},
        )
        insp_id = res_sched.json()["id"]

        token_off = get_token(client, officer_user.email)
        res_fail = client.post(
            f"/api/officer/inspections/{insp_id}/report",
            headers={"Authorization": f"Bearer {token_off}"},
            json={
                "overall_outcome": "DEFICIENCIES_NOTED",
                "department_findings": {},
                "deficiencies": [],
                "corrective_actions": "",
            },
        )
        assert res_fail.status_code == 400
        assert "mandatory when outcome is DEFICIENCIES_NOTED" in res_fail.json()["detail"]

    def test_officer_submit_non_compliant_report(self, client, db, workflow_app, applicant_user, officer_user):
        """Officer can submit NON_COMPLIANT report with deficiencies and required reinspection."""
        token_app = get_token(client, applicant_user.email)
        target_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        res_sched = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token_app}"},
            json={"scheduled_date": target_date, "time_slot": "10:00 AM - 01:00 PM"},
        )
        insp_id = res_sched.json()["id"]

        token_off = get_token(client, officer_user.email)
        res_rep = client.post(
            f"/api/officer/inspections/{insp_id}/report",
            headers={"Authorization": f"Bearer {token_off}"},
            json={
                "overall_outcome": "NON_COMPLIANT",
                "department_findings": {
                    "Fire & Emergency Services (DEMO)": {"status": "NON_COMPLIANT", "remarks": "Fire exit doors blocked"}
                },
                "deficiencies": ["Emergency escape door obstructed by scrap metal bins", "No designated muster point"],
                "corrective_actions": "Clear all exit corridors and designate outdoor emergency assembly area within 14 days.",
                "reinspection_required": True,
            },
        )
        assert res_rep.status_code == 201
        report = res_rep.json()
        assert report["overall_outcome"] == "NON_COMPLIANT"
        assert report["reinspection_required"] is True
        assert len(report["deficiencies"]) == 2

    def test_duplicate_inspection_report_fails(self, client, db, workflow_app, applicant_user, officer_user):
        """Submitting a second report on an inspection returns 400 Bad Request."""
        token_app = get_token(client, applicant_user.email)
        target_date = (datetime.utcnow() + timedelta(days=7)).isoformat()
        res_sched = client.post(
            f"/api/workflow/applications/{workflow_app.id}/inspections/schedule",
            headers={"Authorization": f"Bearer {token_app}"},
            json={"scheduled_date": target_date, "time_slot": "10:00 AM - 01:00 PM"},
        )
        insp_id = res_sched.json()["id"]

        token_off = get_token(client, officer_user.email)
        # First report
        client.post(
            f"/api/officer/inspections/{insp_id}/report",
            headers={"Authorization": f"Bearer {token_off}"},
            json={
                "overall_outcome": "SATISFACTORY",
                "corrective_actions": "Routine upkeep",
            },
        )

        # Duplicate report
        res_dup = client.post(
            f"/api/officer/inspections/{insp_id}/report",
            headers={"Authorization": f"Bearer {token_off}"},
            json={
                "overall_outcome": "SATISFACTORY",
                "corrective_actions": "Routine upkeep duplicate",
            },
        )
        assert res_dup.status_code == 400
        assert "already exists" in res_dup.json()["detail"]

    def test_applicant_cannot_submit_inspection_report(self, client, db, workflow_app, applicant_user):
        """Applicant cannot submit inspection report (403 Forbidden)."""
        token = get_token(client, applicant_user.email)
        res = client.post(
            "/api/officer/inspections/1/report",
            headers={"Authorization": f"Bearer {token}"},
            json={"overall_outcome": "SATISFACTORY"},
        )
        assert res.status_code == 403

    def test_nonexistent_application_and_inspection_errors(self, client, applicant_user, officer_user):
        """404 Not Found is returned for nonexistent entities."""
        token_app = get_token(client, applicant_user.email)
        res1 = client.get(
            "/api/workflow/applications/99999/risk-assessment",
            headers={"Authorization": f"Bearer {token_app}"},
        )
        assert res1.status_code == 404

        token_off = get_token(client, officer_user.email)
        res2 = client.get(
            "/api/officer/inspections/99999",
            headers={"Authorization": f"Bearer {token_off}"},
        )
        assert res2.status_code == 404

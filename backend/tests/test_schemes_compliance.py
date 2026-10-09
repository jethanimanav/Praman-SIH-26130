import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.business import Business, RegulatoryProfile
from app.models.workflow import Application, ApplicationStatus
from app.models.compliance import ComplianceFiling, ComplianceFilingStatus
from app.schemes.engine import SchemesEngine
from app.schemes.schema import SchemeEligibilityStatus
from app.core.clock import ClockService
from app.core.security import get_password_hash
from tests.conftest import get_token


@pytest.fixture
def other_applicant_user(db: Session) -> User:
    existing = db.query(User).filter(User.email == "other_applicant@demo.rop").first()
    if existing:
        return existing
    user = User(
        email="other_applicant@demo.rop",
        hashed_password=get_password_hash("TestPass@123"),
        role=UserRole.APPLICANT,
        full_name="Other Applicant",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user



@pytest.fixture
def scenario_c_business(db: Session, applicant_user: User) -> Business:
    biz = Business(
        user_id=applicant_user.id,
        name="AutoElectra Components Private Limited",
        description="Automotive component manufacturing and electroplating unit",
    )
    db.add(biz)
    db.commit()
    db.refresh(biz)

    profile_data = {
        "sector": "manufacturing",
        "sub_sector": "automotive_components",
        "location_zone_type": "industrial",
        "processes": ["electroplating", "metal_fabrication"],
        "effluent_generation": True,
        "air_emissions": True,
        "hazardous_waste_generated": True,
        "workers_count": 35,
        "power_connected_kw": 250.0,
        "built_up_area_sqm": 2500.0,
        "water_source": "borewell",
    }

    reg_profile = RegulatoryProfile(
        business_id=biz.id,
        extracted_data=profile_data,
        confirmed_data=profile_data,
        is_confirmed=True,
    )
    db.add(reg_profile)
    db.commit()
    return biz


@pytest.fixture
def compliance_application(db: Session, scenario_c_business: Business, applicant_user: User) -> Application:
    app = Application(
        business_id=scenario_c_business.id,
        applicant_id=applicant_user.id,
        title="Industrial Establishment & Operating Clearances - AutoElectra",
        status=ApplicationStatus.APPROVED,
        total_timeline_days=45,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app



# ==============================================================================
# 1. Schemes Engine Evaluation Unit Tests
# ==============================================================================

class TestSchemesEngine:
    def test_scenario_c_profile_schemes_evaluation(self, scenario_c_business: Business):
        profile = scenario_c_business.regulatory_profile.confirmed_data
        result = SchemesEngine.evaluate_schemes(
            business_id=scenario_c_business.id,
            business_name=scenario_c_business.name,
            profile_data=profile,
        )

        assert result.business_id == scenario_c_business.id
        assert result.total_schemes_evaluated >= 4
        assert result.eligible_count >= 3
        assert result.potentially_eligible_count >= 1
        assert result.total_potential_benefit_inr >= 7500000.0
        assert result.data_status == "DEMO"

        # Verify specific schemes
        schemes_by_id = {s.scheme_id: s for s in result.schemes}
        assert "SCHEME-CAP-SUBSIDY" in schemes_by_id
        assert schemes_by_id["SCHEME-CAP-SUBSIDY"].status == SchemeEligibilityStatus.ELIGIBLE
        assert schemes_by_id["SCHEME-CAP-SUBSIDY"].max_amount_inr == 5000000.0

        assert "SCHEME-GREEN-INCENTIVE" in schemes_by_id
        assert schemes_by_id["SCHEME-GREEN-INCENTIVE"].status == SchemeEligibilityStatus.ELIGIBLE
        assert schemes_by_id["SCHEME-GREEN-INCENTIVE"].max_amount_inr == 2500000.0

        assert "SCHEME-SOLAR-REBATE" in schemes_by_id
        assert schemes_by_id["SCHEME-SOLAR-REBATE"].status == SchemeEligibilityStatus.POTENTIALLY_ELIGIBLE
        assert "captive_solar_installed" in schemes_by_id["SCHEME-SOLAR-REBATE"].missing_fields_hint
        assert schemes_by_id["SCHEME-SOLAR-REBATE"].potential_action is not None

    def test_ineligible_schemes_evaluation(self):
        # Ineligible non-manufacturing profile
        hospitality_profile = {
            "sector": "hospitality",
            "location_zone_type": "commercial",
            "workers_count": 150,
            "hazardous_waste_generated": False,
            "effluent_generation": False,
        }
        result = SchemesEngine.evaluate_schemes(
            business_id=99,
            business_name="Grand Horizon Hotel",
            profile_data=hospitality_profile,
        )

        schemes_by_id = {s.scheme_id: s for s in result.schemes}
        assert schemes_by_id["SCHEME-CAP-SUBSIDY"].status == SchemeEligibilityStatus.NOT_ELIGIBLE
        assert len(schemes_by_id["SCHEME-CAP-SUBSIDY"].unmet_conditions) > 0
        assert schemes_by_id["SCHEME-GREEN-INCENTIVE"].status == SchemeEligibilityStatus.NOT_ELIGIBLE

    def test_api_get_business_schemes(self, client: TestClient, scenario_c_business: Business, applicant_user: User):
        token = get_token(client, applicant_user.email)
        resp = client.get(
            f"/api/business/{scenario_c_business.id}/schemes",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["business_id"] == scenario_c_business.id
        assert data["eligible_count"] >= 3
        assert len(data["schemes"]) >= 4

    def test_api_schemes_tenant_isolation(
        self, client: TestClient, scenario_c_business: Business, other_applicant_user: User
    ):
        token = get_token(client, other_applicant_user.email)
        resp = client.get(
            f"/api/business/{scenario_c_business.id}/schemes",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        assert "Access forbidden" in resp.json()["detail"]


# ==============================================================================
# 2. Compliance Calendar & Real-Time Status Tests
# ==============================================================================

class TestComplianceCalendar:
    def test_calendar_auto_generation_for_application(
        self, client: TestClient, compliance_application: Application, applicant_user: User
    ):
        ClockService.reset()
        token = get_token(client, applicant_user.email)
        resp = client.get(
            f"/api/workflow/applications/{compliance_application.id}/compliance-calendar",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["application_id"] == compliance_application.id
        assert data["total_filings"] >= 6
        assert len(data["filings"]) >= 6
        assert data["data_status"] == "DEMO"

        # Check various frequencies exist
        frequencies = {f["frequency"] for f in data["filings"]}
        assert "MONTHLY" in frequencies
        assert "QUARTERLY" in frequencies
        assert "ANNUAL" in frequencies

        # Check metric fields are populated
        monthly_filing = next(f for f in data["filings"] if f["frequency"] == "MONTHLY")
        assert len(monthly_filing["metric_fields"]) > 0
        assert monthly_filing["metric_fields"][0]["name"] == "treated_volume_kl"

    def test_dynamic_status_with_simulated_clock(
        self, client: TestClient, compliance_application: Application, applicant_user: User
    ):
        ClockService.reset()
        token = get_token(client, applicant_user.email)

        # Baseline: upcoming or due soon
        resp = client.get(
            f"/api/workflow/applications/{compliance_application.id}/compliance-calendar",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        initial_data = resp.json()
        first_filing = initial_data["filings"][0]

        # Advance clock by 35 days (past the first filing's due date)
        ClockService.advance(days=35)
        resp_after = client.get(
            f"/api/workflow/applications/{compliance_application.id}/compliance-calendar",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_after.status_code == 200
        updated_data = resp_after.json()
        assert updated_data["overdue_count"] >= 1

        updated_first = next(f for f in updated_data["filings"] if f["id"] == first_filing["id"])
        assert updated_first["status"] == "OVERDUE"
        assert updated_first["penalty_risk_active"] is True
        assert updated_first["days_remaining"] < 0

        ClockService.reset()

    def test_applicant_submit_compliance_filing(
        self, client: TestClient, compliance_application: Application, applicant_user: User
    ):
        ClockService.reset()
        token = get_token(client, applicant_user.email)

        # Get first filing
        resp = client.get(
            f"/api/workflow/applications/{compliance_application.id}/compliance-calendar",
            headers={"Authorization": f"Bearer {token}"},
        )
        filing_id = resp.json()["filings"][0]["id"]

        # Submit filing
        submit_payload = {
            "filing_data": {
                "treated_volume_kl": 125.5,
                "bod_mg_l": 18.2,
                "cod_mg_l": 85.0,
                "ph_level": 7.4,
            },
            "remarks": "October monthly ETP run completed with zero exceedances",
        }
        sub_resp = client.post(
            f"/api/workflow/applications/{compliance_application.id}/compliance-filings/{filing_id}/submit",
            json=submit_payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert sub_resp.status_code == 200
        res_data = sub_resp.json()
        assert res_data["status"] == "SUBMITTED"
        assert res_data["submitted_at"] is not None
        assert res_data["filing_data"]["treated_volume_kl"] == 125.5
        assert res_data["remarks"] == "October monthly ETP run completed with zero exceedances"

    def test_applicant_cannot_submit_filing_for_other_application(
        self, client: TestClient, compliance_application: Application, other_applicant_user: User
    ):
        token_other = get_token(client, other_applicant_user.email)
        sub_resp = client.post(
            f"/api/workflow/applications/{compliance_application.id}/compliance-filings/1/submit",
            json={"filing_data": {}},
            headers={"Authorization": f"Bearer {token_other}"},
        )
        assert sub_resp.status_code in [403, 404]


# ==============================================================================
# 3. Officer Scrutiny & Verification Tests
# ==============================================================================

class TestOfficerComplianceScrutiny:
    def test_officer_view_compliance_queue(
        self, client: TestClient, compliance_application: Application, applicant_user: User, officer_user: User
    ):
        token_app = get_token(client, applicant_user.email)
        token_off = get_token(client, officer_user.email)

        # Ensure calendar filings exist and submit one
        cal_resp = client.get(
            f"/api/workflow/applications/{compliance_application.id}/compliance-calendar",
            headers={"Authorization": f"Bearer {token_app}"},
        )
        filing_id = cal_resp.json()["filings"][0]["id"]

        client.post(
            f"/api/workflow/applications/{compliance_application.id}/compliance-filings/{filing_id}/submit",
            json={"filing_data": {"test_metric": 42}, "remarks": "Queue test submission"},
            headers={"Authorization": f"Bearer {token_app}"},
        )

        # Officer queries queue
        q_resp = client.get(
            "/api/officer/compliance-filings",
            headers={"Authorization": f"Bearer {token_off}"},
        )
        assert q_resp.status_code == 200
        queue_items = q_resp.json()
        assert len(queue_items) >= 1
        assert any(item["id"] == filing_id for item in queue_items)

    def test_applicant_cannot_access_officer_queue(self, client: TestClient, applicant_user: User):
        token = get_token(client, applicant_user.email)
        resp = client.get(
            "/api/officer/compliance-filings",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_officer_verify_filing_success(
        self, client: TestClient, compliance_application: Application, applicant_user: User, officer_user: User
    ):
        token_app = get_token(client, applicant_user.email)
        token_off = get_token(client, officer_user.email)

        cal_resp = client.get(
            f"/api/workflow/applications/{compliance_application.id}/compliance-calendar",
            headers={"Authorization": f"Bearer {token_app}"},
        )
        filing_id = cal_resp.json()["filings"][1]["id"]

        # Submit
        client.post(
            f"/api/workflow/applications/{compliance_application.id}/compliance-filings/{filing_id}/submit",
            json={"filing_data": {"volume": 100}},
            headers={"Authorization": f"Bearer {token_app}"},
        )

        # Officer verifies
        verify_payload = {
            "decision": "VERIFIED",
            "verification_notes": "All parameters conform to General Discharge Standards Schedule VI",
        }
        v_resp = client.post(
            f"/api/officer/compliance-filings/{filing_id}/verify",
            json=verify_payload,
            headers={"Authorization": f"Bearer {token_off}"},
        )
        assert v_resp.status_code == 200
        v_data = v_resp.json()
        assert v_data["status"] == "VERIFIED"
        assert v_data["verified_at"] is not None
        assert v_data["verified_by_email"] == officer_user.email
        assert v_data["verification_notes"] == "All parameters conform to General Discharge Standards Schedule VI"

        # Verify applicant cannot resubmit verified filing
        sub_again = client.post(
            f"/api/workflow/applications/{compliance_application.id}/compliance-filings/{filing_id}/submit",
            json={"filing_data": {"volume": 200}},
            headers={"Authorization": f"Bearer {token_app}"},
        )
        assert sub_again.status_code == 400
        assert "already been verified" in sub_again.json()["detail"]

    def test_officer_reject_filing_requires_mandatory_notes(
        self, client: TestClient, compliance_application: Application, applicant_user: User, officer_user: User
    ):
        token_app = get_token(client, applicant_user.email)
        token_off = get_token(client, officer_user.email)

        cal_resp = client.get(
            f"/api/workflow/applications/{compliance_application.id}/compliance-calendar",
            headers={"Authorization": f"Bearer {token_app}"},
        )
        filing_id = cal_resp.json()["filings"][2]["id"]

        client.post(
            f"/api/workflow/applications/{compliance_application.id}/compliance-filings/{filing_id}/submit",
            json={"filing_data": {"volume": 50}},
            headers={"Authorization": f"Bearer {token_app}"},
        )

        # Reject without notes -> should fail with 400
        bad_resp = client.post(
            f"/api/officer/compliance-filings/{filing_id}/verify",
            json={"decision": "REJECTED", "verification_notes": ""},
            headers={"Authorization": f"Bearer {token_off}"},
        )
        assert bad_resp.status_code == 400
        assert "strictly required" in bad_resp.json()["detail"]

        # Reject with valid notes -> should succeed
        ok_resp = client.post(
            f"/api/officer/compliance-filings/{filing_id}/verify",
            json={
                "decision": "REJECTED",
                "verification_notes": "BOD levels reported at 45 mg/L exceed statutory threshold of 30 mg/L",
            },
            headers={"Authorization": f"Bearer {token_off}"},
        )
        assert ok_resp.status_code == 200
        assert ok_resp.json()["status"] == "REJECTED"

    def test_officer_cannot_verify_unsubmitted_filing(
        self, client: TestClient, compliance_application: Application, applicant_user: User, officer_user: User
    ):
        token_app = get_token(client, applicant_user.email)
        token_off = get_token(client, officer_user.email)

        cal_resp = client.get(
            f"/api/workflow/applications/{compliance_application.id}/compliance-calendar",
            headers={"Authorization": f"Bearer {token_app}"},
        )
        # Filing 3 has not been submitted
        filing_id = cal_resp.json()["filings"][3]["id"]

        resp = client.post(
            f"/api/officer/compliance-filings/{filing_id}/verify",
            json={"decision": "VERIFIED"},
            headers={"Authorization": f"Bearer {token_off}"},
        )
        assert resp.status_code == 400
        assert "SUBMITTED status" in resp.json()["detail"]

    def test_officer_filter_compliance_queue_by_status(
        self, client: TestClient, compliance_application: Application, applicant_user: User, officer_user: User
    ):
        token_app = get_token(client, applicant_user.email)
        token_off = get_token(client, officer_user.email)

        cal_resp = client.get(
            f"/api/workflow/applications/{compliance_application.id}/compliance-calendar",
            headers={"Authorization": f"Bearer {token_app}"},
        )
        filing_id = cal_resp.json()["filings"][0]["id"]

        # Submit and verify
        client.post(
            f"/api/workflow/applications/{compliance_application.id}/compliance-filings/{filing_id}/submit",
            json={"filing_data": {"test": 1}},
            headers={"Authorization": f"Bearer {token_app}"},
        )
        client.post(
            f"/api/officer/compliance-filings/{filing_id}/verify",
            json={"decision": "VERIFIED", "verification_notes": "Valid return"},
            headers={"Authorization": f"Bearer {token_off}"},
        )

        # Filter by VERIFIED
        v_resp = client.get(
            "/api/officer/compliance-filings?status=VERIFIED",
            headers={"Authorization": f"Bearer {token_off}"},
        )
        assert v_resp.status_code == 200
        verified_items = v_resp.json()
        assert any(item["id"] == filing_id for item in verified_items)

    def test_calendar_nonexistent_application_404(self, client: TestClient, applicant_user: User):
        token = get_token(client, applicant_user.email)
        resp = client.get(
            "/api/workflow/applications/99999/compliance-calendar",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


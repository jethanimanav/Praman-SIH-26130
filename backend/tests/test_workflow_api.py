import pytest
from app.models.business import Business, RegulatoryProfile
from app.models.workflow import (
    Application,
    ApprovalStep,
    ApplicationStatus,
    StepStatus,
)
from app.workflow.service import WorkflowService
from tests.conftest import get_token


@pytest.fixture
def confirmed_business(client, applicant_user, db):
    biz = Business(
        user_id=applicant_user.id,
        name="Precision Auto Component Hub",
        description="Auto parts manufacturing",
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
    db.refresh(profile)
    return biz


class TestWorkflowAPI:
    """End-to-end tests for Application creation, DAG generation, and Step state transitions."""

    def test_create_application_unconfirmed_profile_fails(self, client, applicant_user, db):
        token = get_token(client, "test.applicant@test.rop")
        biz = Business(user_id=applicant_user.id, name="Unconfirmed Auto")
        db.add(biz)
        db.commit()

        # No profile or unconfirmed profile
        res = client.post(
            "/api/workflow/applications",
            json={"business_id": biz.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 400
        assert "confirmed regulatory profile" in res.json()["detail"]

    def test_create_application_success(self, client, applicant_user, confirmed_business):
        token = get_token(client, "test.applicant@test.rop")

        res = client.post(
            "/api/workflow/applications",
            json={"business_id": confirmed_business.id, "title": "Auto Mfg Workflow"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()

        assert data["title"] == "Auto Mfg Workflow"
        assert data["status"] == "DRAFT"
        assert data["business_id"] == confirmed_business.id
        assert data["applicant_id"] == applicant_user.id
        assert data["total_timeline_days"] > 0
        assert len(data["critical_path_steps"]) > 0
        assert len(data["steps"]) >= 6

        # Check initial step statuses:
        # Siting has 0 prerequisites -> READY
        siting_step = next(s for s in data["steps"] if s["requirement_id"] == "REQ-SITING-001")
        assert siting_step["status"] == "READY"
        assert siting_step["prerequisites"] == []

        # CTE has Siting prerequisite -> BLOCKED
        cte_step = next(s for s in data["steps"] if s["requirement_id"] == "REQ-ENV-CTE-001")
        assert cte_step["status"] == "BLOCKED"
        assert "REQ-SITING-001" in cte_step["prerequisites"]

    def test_unauthorized_application_access(self, client, applicant_user, confirmed_business, db):
        # Create application for applicant
        app = WorkflowService.create_application_from_discovery(
            db=db,
            business=confirmed_business,
            user=confirmed_business.user,
        )

        from app.models.user import User, UserRole
        from app.core.security import get_password_hash, create_access_token
        app2 = User(
            email="other.applicant@test.rop",
            full_name="Other Applicant",
            hashed_password=get_password_hash("TestPass@123"),
            role=UserRole.APPLICANT,
            is_active=True,
        )
        db.add(app2)
        db.commit()

        token2 = create_access_token(data={"sub": "other.applicant@test.rop", "role": "applicant"})
        res = client.get(
            f"/api/workflow/applications/{app.id}",
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert res.status_code == 403
        assert "Unauthorized" in res.json()["detail"]

    def test_submit_application(self, client, applicant_user, confirmed_business, db):
        token = get_token(client, "test.applicant@test.rop")
        app = WorkflowService.create_application_from_discovery(
            db=db,
            business=confirmed_business,
            user=applicant_user,
        )
        assert app.status == ApplicationStatus.DRAFT

        res = client.post(
            f"/api/workflow/applications/{app.id}/submit",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "SUBMITTED"
        assert res.json()["submitted_at"] is not None

    def test_applicant_cannot_approve_step(self, client, applicant_user, confirmed_business, db):
        token = get_token(client, "test.applicant@test.rop")
        app = WorkflowService.create_application_from_discovery(
            db=db,
            business=confirmed_business,
            user=applicant_user,
        )
        siting_step = next(s for s in app.steps if s.requirement_id == "REQ-SITING-001")

        # Applicant attempts to approve step -> 403 Forbidden
        res = client.post(
            f"/api/workflow/applications/{app.id}/steps/{siting_step.id}/transition",
            json={"target_status": "APPROVED"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
        assert "Only regulatory officers or admins" in res.json()["detail"]

    def test_milestone_advance_validation_unmet_prerequisites(self, client, officer_user, confirmed_business, db):
        token = get_token(client, "test.officer@test.rop")
        app = WorkflowService.create_application_from_discovery(
            db=db,
            business=confirmed_business,
            user=confirmed_business.user,
        )
        cte_step = next(s for s in app.steps if s.requirement_id == "REQ-ENV-CTE-001")
        assert cte_step.status == StepStatus.BLOCKED

        # Officer attempts to approve CTE step while Siting is not approved -> 400 Bad Request
        res = client.post(
            f"/api/workflow/applications/{app.id}/steps/{cte_step.id}/transition",
            json={"target_status": "APPROVED"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 400
        assert "Unmet prerequisites: REQ-SITING-001" in res.json()["detail"]

    def test_advance_step_unblocks_downstream_dependents(self, client, officer_user, confirmed_business, db):
        token = get_token(client, "test.officer@test.rop")
        app = WorkflowService.create_application_from_discovery(
            db=db,
            business=confirmed_business,
            user=confirmed_business.user,
        )
        siting_step = next(s for s in app.steps if s.requirement_id == "REQ-SITING-001")
        cte_step = next(s for s in app.steps if s.requirement_id == "REQ-ENV-CTE-001")
        factory_step = next(s for s in app.steps if s.requirement_id == "REQ-FACTORY-001")

        assert cte_step.status == StepStatus.BLOCKED
        assert factory_step.status == StepStatus.BLOCKED

        # Officer approves Siting step
        res = client.post(
            f"/api/workflow/applications/{app.id}/steps/{siting_step.id}/transition",
            json={"target_status": "APPROVED", "notes": "Zoning verified"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "APPROVED"

        # Downstream steps that only depended on Siting should now be READY
        db.refresh(cte_step)
        db.refresh(factory_step)
        assert cte_step.status == StepStatus.READY
        assert factory_step.status == StepStatus.READY

    def test_workflow_graph_api_endpoint(self, client, applicant_user, confirmed_business, db):
        token = get_token(client, "test.applicant@test.rop")
        app = WorkflowService.create_application_from_discovery(
            db=db,
            business=confirmed_business,
            user=applicant_user,
        )

        res = client.get(
            f"/api/workflow/applications/{app.id}/graph",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()

        assert data["application_id"] == app.id
        assert data["total_timeline_days"] == app.total_timeline_days
        assert len(data["parallel_stages"]) >= 3
        assert "nodes" in data["graph"]
        assert "edges" in data["graph"]
        assert len(data["graph"]["nodes"]) >= 6

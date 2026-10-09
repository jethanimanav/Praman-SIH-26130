import pytest
from pathlib import Path
from app.regulatory.loader import RuleLoader
from app.regulatory.schema import RequirementCategory, DataStatus
from app.regulatory.discovery import RegulatoryDiscoveryService
from app.models.business import Business, RegulatoryProfile
from tests.conftest import get_token


@pytest.fixture
def scenario_c_rules():
    rule_path = Path("e:/26130/backend/data/regulatory/scenario_c_rules.yaml")
    assert rule_path.is_file()
    return RuleLoader.load_from_file(rule_path)


# -----------------------------------------------------------------------------
# 1. Tests for Regulatory Discovery Service Logic
# -----------------------------------------------------------------------------

class TestRegulatoryDiscoveryService:
    def test_required_result_and_explainability(self, scenario_c_rules):
        profile = {
            "sector": "manufacturing",
            "location": {"zone_type": "industrial"},
            "processes": ["electroplating"],
            "effluent_generation": True,
            "air_emissions": True,
            "hazardous_waste_generated": True,
            "workers_count": 35,
            "power_connected_kw": 250,
            "built_up_area_sqm": 2500,
            "water_source": "borewell",
        }
        discovery = RegulatoryDiscoveryService.discover_requirements(
            business_id=1,
            business_name="Precision Auto",
            confirmed_profile=profile,
            rules=scenario_c_rules,
        )

        assert discovery.business_id == 1
        assert discovery.business_name == "Precision Auto"
        assert discovery.total_requirements == len(scenario_c_rules)
        assert discovery.summary_counts[RequirementCategory.REQUIRED.value] >= 6

        # Inspect REQ-SITING-001 explainability
        siting = next(r for r in discovery.requirements if r.requirement_id == "REQ-SITING-001")
        assert siting.category == RequirementCategory.REQUIRED
        assert siting.rule_id == "RULE-DEMO-001"
        assert siting.data_status == DataStatus.DEMO
        assert "sector" in siting.relevant_profile_fields
        assert siting.relevant_profile_fields["sector"] == "manufacturing"
        assert siting.relevant_profile_fields["location.zone_type"] == "industrial"
        assert "Review the identified requirement" in siting.next_action

    def test_not_applicable_result(self, scenario_c_rules):
        # Commercial office: power demand is small (30 kW) -> HT Power is Not Applicable
        profile = {
            "sector": "services",
            "power_connected_kw": 30.0,
            "effluent_generation": False,
            "air_emissions": False,
        }
        discovery = RegulatoryDiscoveryService.discover_requirements(
            business_id=2,
            business_name="Tech Office",
            confirmed_profile=profile,
            rules=scenario_c_rules,
        )
        ht_power = next(r for r in discovery.requirements if r.requirement_id == "REQ-POWER-HT-001")
        assert ht_power.category == RequirementCategory.NOT_APPLICABLE
        assert "No action required" in ht_power.next_action

    def test_verification_required_missing_info(self, scenario_c_rules):
        # Empty profile: water_source and hazardous_waste are unknown
        sparse_profile = {"sector": "manufacturing"}
        discovery = RegulatoryDiscoveryService.discover_requirements(
            business_id=3,
            business_name="Sparse Unit",
            confirmed_profile=sparse_profile,
            rules=scenario_c_rules,
        )

        # Ground water NOC requires water_source
        water_req = next(r for r in discovery.requirements if r.requirement_id == "REQ-WATER-GW-001")
        assert water_req.category == RequirementCategory.VERIFICATION_REQUIRED
        assert "water_source" in water_req.missing_information
        assert "Provide or verify the missing information" in water_req.next_action

        # Aggregate missing critical fields must include water_source
        assert "water_source" in discovery.missing_critical_fields

    def test_determinism_same_inputs_same_output(self, scenario_c_rules):
        profile = {
            "sector": "manufacturing",
            "location": {"zone_type": "industrial"},
            "power_connected_kw": 150.0,
        }
        run1 = RegulatoryDiscoveryService.discover_requirements(10, "Unit A", profile, scenario_c_rules)
        run2 = RegulatoryDiscoveryService.discover_requirements(10, "Unit A", profile, scenario_c_rules)

        assert run1.summary_counts == run2.summary_counts
        assert [r.category for r in run1.requirements] == [r.category for r in run2.requirements]
        assert [r.reason for r in run1.requirements] == [r.reason for r in run2.requirements]

    def test_no_hallucinated_requirements(self, scenario_c_rules):
        profile = {"sector": "manufacturing"}
        discovery = RegulatoryDiscoveryService.discover_requirements(1, "Unit", profile, scenario_c_rules)
        configured_req_ids = {r.requirement_id for r in scenario_c_rules}
        for item in discovery.requirements:
            assert item.requirement_id in configured_req_ids


# -----------------------------------------------------------------------------
# 2. Tests for API Endpoint: GET /api/business/{id}/regulatory-discovery
# -----------------------------------------------------------------------------

class TestRegulatoryDiscoveryAPI:
    def test_discovery_requires_authentication(self, client):
        res = client.get("/api/business/1/regulatory-discovery")
        assert res.status_code == 401

    def test_business_not_found(self, client, applicant_user):
        token = get_token(client, "test.applicant@test.rop")
        res = client.get(
            "/api/business/99999/regulatory-discovery",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 404
        assert "Business not found" in res.json()["detail"]

    def test_unauthorized_user_cannot_access_other_users_business(self, client, applicant_user, officer_user, db):
        # Create business owned by applicant_user
        biz = Business(
            user_id=applicant_user.id,
            name="Applicant's Factory",
            description="Testing authorization",
        )
        db.add(biz)
        db.commit()
        db.refresh(biz)

        # Officer tries to access applicant's business discovery
        officer_token = get_token(client, "test.officer@test.rop")
        res = client.get(
            f"/api/business/{biz.id}/regulatory-discovery",
            headers={"Authorization": f"Bearer {officer_token}"},
        )
        assert res.status_code == 403
        assert "Unauthorized business access" in res.json()["detail"]

    def test_unconfirmed_profile_rejected(self, client, applicant_user, db):
        token = get_token(client, "test.applicant@test.rop")

        # Create business with unconfirmed profile
        biz = Business(
            user_id=applicant_user.id,
            name="Unconfirmed Unit",
        )
        db.add(biz)
        db.commit()
        db.refresh(biz)

        profile = RegulatoryProfile(
            business_id=biz.id,
            extracted_data={"sector": "manufacturing"},
            confirmed_data={"sector": "manufacturing"},
            is_confirmed=False,  # NOT confirmed
        )
        db.add(profile)
        db.commit()

        res = client.get(
            f"/api/business/{biz.id}/regulatory-discovery",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 400
        assert "Profile confirmation required" in res.json()["detail"]

    def test_successful_confirmed_discovery_scenario_c(self, client, applicant_user, db):
        token = get_token(client, "test.applicant@test.rop")

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

        res = client.get(
            f"/api/business/{biz.id}/regulatory-discovery",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()

        assert data["business_id"] == biz.id
        assert data["business_name"] == "Precision Auto Component Hub"
        assert data["total_requirements"] >= 7
        assert data["summary_counts"]["Required"] >= 6
        assert len(data["requirements"]) == data["total_requirements"]

        # Verify items have category, reason, rule_id, data_status, next_action
        first_item = data["requirements"][0]
        assert "requirement_id" in first_item
        assert "requirement_name" in first_item
        assert "category" in first_item
        assert "reason" in first_item
        assert "rule_id" in first_item
        assert "data_status" in first_item
        assert "next_action" in first_item

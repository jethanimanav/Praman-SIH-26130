import pytest
from pathlib import Path
from pydantic import ValidationError

from app.ai.schema import (
    AdaptiveQuestion,
    AIIntakeResult,
    ExtractedProfile,
)
from app.ai.providers import (
    CachedProvider,
    GeminiProvider,
    RuleBasedFallbackProvider,
)
from app.ai.service import AIService
from app.regulatory.loader import RuleLoader
from app.regulatory.schema import RequirementCategory
from tests.conftest import get_token


@pytest.fixture
def scenario_c_rules():
    rule_path = Path("e:/26130/backend/data/regulatory/scenario_c_rules.yaml")
    assert rule_path.is_file()
    return RuleLoader.load_from_file(rule_path)


# -----------------------------------------------------------------------------
# 1. Tests for AI Providers (Cached, Fallback, Gemini Unavailable)
# -----------------------------------------------------------------------------

class TestAIProviders:
    def test_cached_provider_scenario_c(self):
        provider = CachedProvider()
        text = "We are setting up an automotive component manufacturing unit with electroplating and metal parts."
        result = provider.extract_profile(text)

        assert result.provider_name == "CachedProvider"
        assert not result.is_fallback
        assert result.extracted_profile.sector == "manufacturing"
        assert result.extracted_profile.location_zone_type == "industrial"
        assert "electroplating" in result.extracted_profile.processes
        assert result.extracted_profile.effluent_generation is True
        assert result.extracted_profile.hazardous_waste_generated is True
        assert result.extracted_profile.workers_count == 35
        assert result.extracted_profile.power_connected_kw == 250.0

        # Confidence checks
        assert result.field_confidence["sector"] >= 0.90
        assert result.field_confidence["processes"] >= 0.90
        assert result.provenance["sector"]["source"] == "cached_scenario_c"

    def test_rule_based_fallback_provider(self):
        provider = RuleBasedFallbackProvider()
        text = "Setting up a manufacturing plant in an industrial area with 40 workers and 120 kw power connection. Operating electroplating."
        result = provider.extract_profile(text)

        assert result.provider_name == "RuleBasedFallbackProvider"
        assert result.is_fallback is True
        assert result.extracted_profile.sector == "manufacturing"
        assert result.extracted_profile.location_zone_type == "industrial"
        assert result.extracted_profile.workers_count == 40
        assert result.extracted_profile.power_connected_kw == 120.0
        assert "electroplating" in result.extracted_profile.processes
        # Does not guess air emissions if unmentioned
        assert result.extracted_profile.air_emissions is None

    def test_gemini_provider_unavailable_falls_back(self):
        # Gemini without API key falls back to rule-based extractor
        provider = GeminiProvider(api_key=None)
        text = "A software tech consulting office in a commercial zone."
        result = provider.extract_profile(text)

        # Successfully falls back without throwing errors
        assert result.extracted_profile.sector == "services"
        assert result.extracted_profile.location_zone_type == "commercial"

    def test_empty_description_returns_empty_profile(self):
        service = AIService()
        result = service.process_intake_description("   ")
        assert result.extracted_profile.sector is None
        assert result.extracted_profile.processes == []
        assert result.is_fallback is True


# -----------------------------------------------------------------------------
# 2. Tests for Adaptive Questions (Derived from Rules, 3-7 Limit, Not Sure Handling)
# -----------------------------------------------------------------------------

class TestAdaptiveQuestions:
    def test_adaptive_questions_selected_from_rules(self, scenario_c_rules):
        # Sparse profile missing almost everything
        sparse_profile = {"sector": "manufacturing"}
        questions = AIService.select_adaptive_questions(sparse_profile, scenario_c_rules)

        # Must adhere to 3–7 target question limits
        assert 3 <= len(questions) <= 7

        # Questions must correspond to fields evaluated by Scenario C rules
        question_fields = [q.field for q in questions]
        for q in questions:
            assert len(q.rule_ids) >= 1
            assert q.question_text is not None
            # Must include "Not sure" / unknown preservation option
            has_unknown_opt = any(opt.value is None for opt in q.options)
            assert has_unknown_opt, f"Question {q.id} missing 'Not sure' option"

    def test_no_redundant_questions_for_known_fields(self, scenario_c_rules):
        # Full profile where everything is already known
        full_profile = {
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
        questions = AIService.select_adaptive_questions(full_profile, scenario_c_rules)
        # All relevant fields are known, so no adaptive questions needed
        assert len(questions) == 0


# -----------------------------------------------------------------------------
# 3. Tests for End-to-End Business Intake API Flow
# -----------------------------------------------------------------------------

class TestBusinessIntakeFlow:
    def test_full_intake_confirm_and_assess_flow(self, client, applicant_user):
        token = get_token(client, "test.applicant@test.rop")
        headers = {"Authorization": f"Bearer {token}"}

        # Step 1: Create Business
        res = client.post(
            "/api/business",
            json={"name": "Precision Auto Components Ltd", "description": "Automotive parts"},
            headers={**headers, "Content-Type": "application/json"},
        )
        assert res.status_code == 201
        biz_id = res.json()["id"]

        # Step 2: Submit Natural Language Description
        desc_text = "We are an automotive component manufacturing unit with electroplating and metal parts."
        res_desc = client.post(
            f"/api/business/{biz_id}/describe",
            json={"description": desc_text},
            headers={**headers, "Content-Type": "application/json"},
        )
        assert res_desc.status_code == 200
        intake_data = res_desc.json()
        assert intake_data["business_id"] == biz_id
        extraction = intake_data["extraction"]
        assert extraction["extracted_profile"]["sector"] == "manufacturing"

        # Step 3: Answer Adaptive Questions (simulating user answering or marking 'Not sure')
        answers = {
            "water_source": "borewell",
            "effluent_generation": True,
            "hazardous_waste_generated": None,  # User says "Not sure"
        }
        res_ans = client.post(
            f"/api/business/{biz_id}/answer-questions",
            json={"answers": answers},
            headers={**headers, "Content-Type": "application/json"},
        )
        assert res_ans.status_code == 200
        updated = res_ans.json()["updated_profile"]
        assert updated["water_source"] == "borewell"
        assert updated["effluent_generation"] is True

        # Step 4: User Confirmation and Handover to M1 Regulatory Engine
        # User confirms/corrects values
        confirmed_profile = dict(updated)
        confirmed_profile["power_connected_kw"] = 250.0
        confirmed_profile["workers_count"] = 35

        res_confirm = client.post(
            f"/api/business/{biz_id}/confirm",
            json={"profile_data": confirmed_profile},
            headers={**headers, "Content-Type": "application/json"},
        )
        assert res_confirm.status_code == 200
        eval_resp = res_confirm.json()
        assert eval_resp["is_confirmed"] is True
        assert eval_resp["total_requirements"] >= 7

        # Verify results returned by existing deterministic M1 engine
        results_by_id = {r["requirement_id"]: r for r in eval_resp["results"]}
        assert results_by_id["REQ-SITING-001"]["category"] == RequirementCategory.REQUIRED.value
        assert results_by_id["REQ-WATER-GW-001"]["category"] == RequirementCategory.REQUIRED.value
        # Hazardous waste was answered as None ('Not sure') -> MUST yield Verification Required, not guessed!
        assert results_by_id["REQ-HAZ-001"]["category"] == RequirementCategory.VERIFICATION_REQUIRED.value

    def test_user_can_correct_low_confidence_fields(self, client, applicant_user):
        token = get_token(client, "test.applicant@test.rop")
        headers = {"Authorization": f"Bearer {token}"}

        # Create business
        res = client.post(
            "/api/business",
            json={"name": "Correction Test Unit"},
            headers={**headers, "Content-Type": "application/json"},
        )
        biz_id = res.json()["id"]

        # User confirms a manually corrected profile
        corrected = {
            "sector": "manufacturing",
            "location": {"zone_type": "commercial"},  # Corrected to commercial zone
            "workers_count": 5,
            "power_connected_kw": 30.0,
        }
        res_confirm = client.post(
            f"/api/business/{biz_id}/confirm",
            json={"profile_data": corrected},
            headers={**headers, "Content-Type": "application/json"},
        )
        assert res_confirm.status_code == 200
        results = res_confirm.json()["results"]
        by_id = {r["requirement_id"]: r for r in results}

        # Commercial zone fails industrial zoning condition -> Conditional
        assert by_id["REQ-SITING-001"]["category"] == RequirementCategory.CONDITIONAL.value
        # Power < 100 kW -> Not Applicable
        assert by_id["REQ-POWER-HT-001"]["category"] == RequirementCategory.NOT_APPLICABLE.value

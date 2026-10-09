import pytest
from pathlib import Path
from pydantic import ValidationError

from app.regulatory.schema import (
    Condition,
    DataStatus,
    EvaluationOutcome,
    Operator,
    RegulatoryRule,
    RequirementCategory,
    SourceMetadata,
)
from app.regulatory.loader import RuleLoader, RuleLoadingError
from app.regulatory.engine import RuleEngine, EvaluationContext


# -----------------------------------------------------------------------------
# 1. Tests for Operators
# -----------------------------------------------------------------------------

class TestOperators:
    def test_eq_operator(self):
        engine = RuleEngine()
        cond = Condition(field="sector", operator=Operator.EQ, value="manufacturing")
        
        # Match
        assert engine.evaluate_condition(cond, EvaluationContext({"sector": "manufacturing"})) == EvaluationOutcome.TRUE
        # Mismatch
        assert engine.evaluate_condition(cond, EvaluationContext({"sector": "services"})) == EvaluationOutcome.FALSE
        # Unknown
        assert engine.evaluate_condition(cond, EvaluationContext({})) == EvaluationOutcome.UNKNOWN
        assert engine.evaluate_condition(cond, EvaluationContext({"sector": None})) == EvaluationOutcome.UNKNOWN

    def test_ne_operator(self):
        engine = RuleEngine()
        cond = Condition(field="status", operator=Operator.NE, value="exempt")
        
        assert engine.evaluate_condition(cond, EvaluationContext({"status": "active"})) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(cond, EvaluationContext({"status": "exempt"})) == EvaluationOutcome.FALSE
        assert engine.evaluate_condition(cond, EvaluationContext({})) == EvaluationOutcome.UNKNOWN

    def test_in_operator(self):
        engine = RuleEngine()
        cond = Condition(field="process", operator=Operator.IN, value=["welding", "electroplating"])
        
        assert engine.evaluate_condition(cond, EvaluationContext({"process": "welding"})) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(cond, EvaluationContext({"process": "packaging"})) == EvaluationOutcome.FALSE
        assert engine.evaluate_condition(cond, EvaluationContext({})) == EvaluationOutcome.UNKNOWN

    def test_not_in_operator(self):
        engine = RuleEngine()
        cond = Condition(field="zone", operator=Operator.NOT_IN, value=["residential", "forest"])
        
        assert engine.evaluate_condition(cond, EvaluationContext({"zone": "industrial"})) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(cond, EvaluationContext({"zone": "residential"})) == EvaluationOutcome.FALSE
        assert engine.evaluate_condition(cond, EvaluationContext({})) == EvaluationOutcome.UNKNOWN

    def test_numeric_comparisons(self):
        engine = RuleEngine()
        gt = Condition(field="power", operator=Operator.GT, value=50)
        gte = Condition(field="power", operator=Operator.GTE, value=50)
        lt = Condition(field="power", operator=Operator.LT, value=50)
        lte = Condition(field="power", operator=Operator.LTE, value=50)

        ctx_60 = EvaluationContext({"power": 60})
        ctx_50 = EvaluationContext({"power": 50})
        ctx_40 = EvaluationContext({"power": 40})
        ctx_none = EvaluationContext({})

        # GT
        assert engine.evaluate_condition(gt, ctx_60) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(gt, ctx_50) == EvaluationOutcome.FALSE
        assert engine.evaluate_condition(gt, ctx_40) == EvaluationOutcome.FALSE
        assert engine.evaluate_condition(gt, ctx_none) == EvaluationOutcome.UNKNOWN

        # GTE
        assert engine.evaluate_condition(gte, ctx_60) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(gte, ctx_50) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(gte, ctx_40) == EvaluationOutcome.FALSE

        # LT
        assert engine.evaluate_condition(lt, ctx_40) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(lt, ctx_50) == EvaluationOutcome.FALSE

        # LTE
        assert engine.evaluate_condition(lte, ctx_50) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(lte, ctx_60) == EvaluationOutcome.FALSE

    def test_exists_operator(self):
        engine = RuleEngine()
        cond_exists = Condition(field="effluent_plan", operator=Operator.EXISTS, value=True)
        cond_not_exists = Condition(field="effluent_plan", operator=Operator.EXISTS, value=False)

        assert engine.evaluate_condition(cond_exists, EvaluationContext({"effluent_plan": "uploaded"})) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(cond_exists, EvaluationContext({})) == EvaluationOutcome.FALSE
        assert engine.evaluate_condition(cond_exists, EvaluationContext({"effluent_plan": None})) == EvaluationOutcome.FALSE

        assert engine.evaluate_condition(cond_not_exists, EvaluationContext({})) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(cond_not_exists, EvaluationContext({"effluent_plan": "uploaded"})) == EvaluationOutcome.FALSE

    def test_nested_field_lookup(self):
        engine = RuleEngine()
        cond = Condition(field="location.zone.type", operator=Operator.EQ, value="industrial")

        ctx_valid = EvaluationContext({"location": {"zone": {"type": "industrial"}}})
        ctx_mismatch = EvaluationContext({"location": {"zone": {"type": "commercial"}}})
        ctx_missing = EvaluationContext({"location": {}})

        assert engine.evaluate_condition(cond, ctx_valid) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(cond, ctx_mismatch) == EvaluationOutcome.FALSE
        assert engine.evaluate_condition(cond, ctx_missing) == EvaluationOutcome.UNKNOWN


# -----------------------------------------------------------------------------
# 2. Tests for Combinators: all / any / not
# -----------------------------------------------------------------------------

class TestCombinators:
    def test_all_combinator(self):
        engine = RuleEngine()
        cond = Condition(
            all=[
                Condition(field="a", operator=Operator.EQ, value=1),
                Condition(field="b", operator=Operator.EQ, value=2),
            ]
        )

        # Both True -> True
        assert engine.evaluate_condition(cond, EvaluationContext({"a": 1, "b": 2})) == EvaluationOutcome.TRUE
        # One False -> False (even if the other is unknown)
        assert engine.evaluate_condition(cond, EvaluationContext({"a": 99})) == EvaluationOutcome.FALSE
        # One True, One Unknown -> Unknown
        assert engine.evaluate_condition(cond, EvaluationContext({"a": 1})) == EvaluationOutcome.UNKNOWN
        # Both Unknown -> Unknown
        assert engine.evaluate_condition(cond, EvaluationContext({})) == EvaluationOutcome.UNKNOWN

    def test_any_combinator(self):
        engine = RuleEngine()
        cond = Condition(
            any=[
                Condition(field="a", operator=Operator.EQ, value=1),
                Condition(field="b", operator=Operator.EQ, value=2),
            ]
        )

        # One True -> True (short circuit)
        assert engine.evaluate_condition(cond, EvaluationContext({"a": 1})) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(cond, EvaluationContext({"a": 1, "b": 99})) == EvaluationOutcome.TRUE
        # Both False -> False
        assert engine.evaluate_condition(cond, EvaluationContext({"a": 99, "b": 99})) == EvaluationOutcome.FALSE
        # One False, One Unknown -> Unknown
        assert engine.evaluate_condition(cond, EvaluationContext({"a": 99})) == EvaluationOutcome.UNKNOWN
        # Both Unknown -> Unknown
        assert engine.evaluate_condition(cond, EvaluationContext({})) == EvaluationOutcome.UNKNOWN

    def test_not_combinator(self):
        engine = RuleEngine()
        cond = Condition(
            not_=Condition(field="hazard", operator=Operator.EQ, value=True)
        )

        assert engine.evaluate_condition(cond, EvaluationContext({"hazard": True})) == EvaluationOutcome.FALSE
        assert engine.evaluate_condition(cond, EvaluationContext({"hazard": False})) == EvaluationOutcome.TRUE
        assert engine.evaluate_condition(cond, EvaluationContext({})) == EvaluationOutcome.UNKNOWN


# -----------------------------------------------------------------------------
# 3. Tests for Requirement Categories and Unknown Values
# -----------------------------------------------------------------------------

class TestCategoriesAndUnknowns:
    @pytest.fixture
    def sample_rule(self):
        return RegulatoryRule(
            id="RULE-TEST-001",
            requirement_id="REQ-TEST-001",
            requirement_name="Factory License Test",
            data_status=DataStatus.DEMO,
            condition=Condition(field="workers", operator=Operator.GTE, value=10),
            category_if_matched=RequirementCategory.REQUIRED,
            category_if_not_matched=RequirementCategory.NOT_APPLICABLE,
            explanation_matched="Employs >= 10 workers.",
            explanation_not_matched="Employs < 10 workers.",
            explanation_unknown="Worker headcount is not provided.",
        )

    def test_matched_results_in_required(self, sample_rule):
        engine = RuleEngine([sample_rule])
        results = engine.evaluate_all({"workers": 25})
        assert len(results) == 1
        res = results[0]
        assert res.category == RequirementCategory.REQUIRED
        assert res.reason == "Employs >= 10 workers."
        assert res.rule_id == "RULE-TEST-001"
        assert res.data_status == DataStatus.DEMO

    def test_not_matched_results_in_not_applicable(self, sample_rule):
        engine = RuleEngine([sample_rule])
        results = engine.evaluate_all({"workers": 5})
        assert len(results) == 1
        res = results[0]
        assert res.category == RequirementCategory.NOT_APPLICABLE
        assert res.reason == "Employs < 10 workers."

    def test_unknown_results_in_verification_required(self, sample_rule):
        engine = RuleEngine([sample_rule])
        results = engine.evaluate_all({})
        assert len(results) == 1
        res = results[0]
        assert res.category == RequirementCategory.VERIFICATION_REQUIRED
        assert res.reason == "Worker headcount is not provided."

    def test_conditional_category_configuration(self):
        rule = RegulatoryRule(
            id="RULE-COND-001",
            requirement_id="REQ-COND-001",
            requirement_name="Conditional Boiler Clearance",
            data_status=DataStatus.DEMO,
            condition=Condition(field="uses_steam", operator=Operator.EQ, value=True),
            category_if_matched=RequirementCategory.CONDITIONAL,
            explanation_matched="Steam generation requires boiler clearance depending on capacity.",
        )
        engine = RuleEngine([rule])
        results = engine.evaluate_all({"uses_steam": True})
        assert results[0].category == RequirementCategory.CONDITIONAL


# -----------------------------------------------------------------------------
# 4. Tests for Data Status and Verified Record Validation
# -----------------------------------------------------------------------------

class TestDataStatusValidation:
    def test_demo_record_default_valid(self):
        rule = RegulatoryRule(
            id="RULE-DEMO-VALID",
            requirement_id="REQ-001",
            requirement_name="Demo Rule",
            condition=Condition(field="x", operator=Operator.EQ, value=1),
            explanation_matched="Matched",
        )
        assert rule.data_status == DataStatus.DEMO

    def test_verified_record_succeeds_with_all_metadata(self):
        rule = RegulatoryRule(
            id="RULE-VERIFIED-VALID",
            requirement_id="REQ-VER-001",
            requirement_name="Verified Statutory Rule",
            data_status=DataStatus.VERIFIED,
            source_metadata=SourceMetadata(
                source_url="https://example.gov.in/act.pdf",
                source_date="2024-01-15",
                reviewed_by="Gov Legal Officer",
            ),
            condition=Condition(field="x", operator=Operator.EQ, value=1),
            explanation_matched="Matched",
        )
        assert rule.data_status == DataStatus.VERIFIED
        assert rule.source_metadata.reviewed_by == "Gov Legal Officer"

    def test_verified_record_fails_without_source_metadata(self):
        with pytest.raises(ValidationError) as exc:
            RegulatoryRule(
                id="RULE-VERIFIED-INVALID",
                requirement_id="REQ-VER-002",
                requirement_name="Invalid Verified Rule",
                data_status=DataStatus.VERIFIED,
                condition=Condition(field="x", operator=Operator.EQ, value=1),
                explanation_matched="Matched",
            )
        assert "lacks 'source_metadata'" in str(exc.value)

    def test_verified_record_fails_when_missing_required_fields(self):
        with pytest.raises(ValidationError) as exc:
            RegulatoryRule(
                id="RULE-VERIFIED-PARTIAL",
                requirement_id="REQ-VER-003",
                requirement_name="Partial Verified Rule",
                data_status=DataStatus.VERIFIED,
                source_metadata=SourceMetadata(
                    source_url="https://example.gov.in/act.pdf",
                    # source_date and reviewed_by omitted
                ),
                condition=Condition(field="x", operator=Operator.EQ, value=1),
                explanation_matched="Matched",
            )
        assert "missing required metadata fields" in str(exc.value)
        assert "source_date" in str(exc.value)
        assert "reviewed_by" in str(exc.value)


# -----------------------------------------------------------------------------
# 5. Tests for Rule Loader & YAML Parsing
# -----------------------------------------------------------------------------

class TestRuleLoader:
    def test_load_valid_yaml_string(self):
        yaml_content = """
        version: "1.0"
        rules:
          - id: "RULE-LOAD-001"
            requirement_id: "REQ-001"
            requirement_name: "Loader Test"
            condition:
              field: "a"
              operator: "eq"
              value: 10
            explanation_matched: "Matched A"
        """
        rules = RuleLoader.load_from_yaml_string(yaml_content)
        assert len(rules) == 1
        assert rules[0].id == "RULE-LOAD-001"

    def test_load_invalid_yaml_syntax(self):
        invalid_yaml = "rules: [unclosed list"
        with pytest.raises(RuleLoadingError) as exc:
            RuleLoader.load_from_yaml_string(invalid_yaml)
        assert "YAML parsing error" in str(exc.value)

    def test_load_schema_violation(self):
        invalid_schema = """
        version: "1.0"
        rules:
          - id: "RULE-BAD"
            # requirement_id and condition missing
            explanation_matched: "Bad"
        """
        with pytest.raises(RuleLoadingError) as exc:
            RuleLoader.load_from_yaml_string(invalid_schema)
        assert "Schema validation error" in str(exc.value)

    def test_duplicate_rule_id_in_directory(self, tmp_path: Path):
        f1 = tmp_path / "rule1.yaml"
        f2 = tmp_path / "rule2.yaml"
        content = """
        rules:
          - id: "DUP-RULE"
            requirement_id: "REQ-DUP"
            requirement_name: "Duplicate Rule"
            condition:
              field: "x"
              operator: "eq"
              value: 1
            explanation_matched: "Dup"
        """
        f1.write_text(content, encoding="utf-8")
        f2.write_text(content, encoding="utf-8")

        with pytest.raises(RuleLoadingError) as exc:
            RuleLoader.load_from_directory(tmp_path)
        assert "Duplicate rule ID 'DUP-RULE'" in str(exc.value)


# -----------------------------------------------------------------------------
# 6. End-to-End Test for Scenario C Rules
# -----------------------------------------------------------------------------

class TestScenarioCRules:
    @pytest.fixture
    def scenario_c_rules(self):
        rule_path = Path("e:/26130/backend/data/regulatory/scenario_c_rules.yaml")
        assert rule_path.is_file(), "Scenario C rules YAML file must exist"
        return RuleLoader.load_from_file(rule_path)

    def test_scenario_c_rules_loaded(self, scenario_c_rules):
        assert len(scenario_c_rules) >= 7
        for r in scenario_c_rules:
            assert r.data_status == DataStatus.DEMO

    def test_scenario_c_full_profile(self, scenario_c_rules):
        engine = RuleEngine(scenario_c_rules)

        # Business profile: Precision Auto Components (Scenario C)
        profile = {
            "sector": "manufacturing",
            "location": {"zone_type": "industrial"},
            "processes": ["electroplating", "metal_fabrication"],
            "effluent_generation": True,
            "air_emissions": True,
            "hazardous_waste_generated": True,
            "workers_count": 35,
            "power_connected_kw": 250,
            "built_up_area_sqm": 2500,
            "water_source": "borewell",
        }

        results = engine.evaluate_all(profile)
        categories = {res.requirement_id: res.category for res in results}

        # Expected requirements for complete scenario C:
        assert categories["REQ-SITING-001"] == RequirementCategory.REQUIRED
        assert categories["REQ-ENV-CTE-001"] == RequirementCategory.REQUIRED
        assert categories["REQ-HAZ-001"] == RequirementCategory.REQUIRED
        assert categories["REQ-FACTORY-001"] == RequirementCategory.REQUIRED
        assert categories["REQ-POWER-HT-001"] == RequirementCategory.REQUIRED
        assert categories["REQ-FIRE-001"] == RequirementCategory.REQUIRED
        assert categories["REQ-WATER-GW-001"] == RequirementCategory.REQUIRED

    def test_scenario_c_partial_and_unknown_profile(self, scenario_c_rules):
        engine = RuleEngine(scenario_c_rules)

        # Sparse profile missing key details
        partial_profile = {
            "sector": "manufacturing",
            "location": {"zone_type": "industrial"},
            # effluent_generation, air_emissions, processes are missing -> CTE should be Verification Required
            # water_source is missing -> Water GW should be Verification Required
            "workers_count": 5,  # < 10 workers -> Factory should be Conditional
            "power_connected_kw": 40,  # < 100 kW -> HT power Not Applicable
        }

        results = engine.evaluate_all(partial_profile)
        by_id = {res.requirement_id: res for res in results}

        # CTE should require verification because polluting factors are missing
        assert by_id["REQ-ENV-CTE-001"].category == RequirementCategory.VERIFICATION_REQUIRED

        # Ground water NOC requires verification because water source is missing
        assert by_id["REQ-WATER-GW-001"].category == RequirementCategory.VERIFICATION_REQUIRED

        # HT power is Not Applicable because power_connected_kw < 100 kW
        assert by_id["REQ-POWER-HT-001"].category == RequirementCategory.NOT_APPLICABLE

        # Factory plan approval is Conditional because < 10 workers
        assert by_id["REQ-FACTORY-001"].category == RequirementCategory.CONDITIONAL

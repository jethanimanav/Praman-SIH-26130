from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml
from datetime import datetime

from app.schemes.schema import (
    SchemeEligibilityStatus,
    SchemeEvaluationItem,
    SchemesAssessmentResult,
)
from app.core.clock import ClockService

SCHEMES_CONFIG_PATH = Path("data/schemes/scenario_c_schemes.yaml")


class SchemesEngine:
    _cached_config: Optional[Dict[str, Any]] = None

    @classmethod
    def load_config(cls, path: Optional[Path] = None) -> Dict[str, Any]:
        target = path or SCHEMES_CONFIG_PATH
        if not target.is_file():
            alt_target = Path("backend") / target
            if alt_target.is_file():
                target = alt_target

        if not target.is_file():
            return {"schemes": []}

        with open(target, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    @classmethod
    def get_nested_field(cls, data: Dict[str, Any], path: str) -> Any:
        keys = path.split(".")
        current = data
        for k in keys:
            if not isinstance(current, dict) or k not in current:
                return None
            current = current[k]
        return current

    @classmethod
    def _evaluate_op(cls, actual_val: Any, op: str, expected_val: Any) -> bool:
        if actual_val is None:
            return False

        if op == "eq":
            if isinstance(actual_val, str) and isinstance(expected_val, str):
                return actual_val.strip().lower() == expected_val.strip().lower()
            return actual_val == expected_val
        elif op == "ne":
            if isinstance(actual_val, str) and isinstance(expected_val, str):
                return actual_val.strip().lower() != expected_val.strip().lower()
            return actual_val != expected_val
        elif op == "in":
            if isinstance(expected_val, list):
                if isinstance(actual_val, list):
                    return any(x in expected_val for x in actual_val)
                elif isinstance(actual_val, str):
                    lower_list = [str(x).strip().lower() for x in expected_val]
                    return actual_val.strip().lower() in lower_list
                return actual_val in expected_val
            return False
        elif op == "not_in":
            if isinstance(expected_val, list):
                if isinstance(actual_val, str):
                    lower_list = [str(x).strip().lower() for x in expected_val]
                    return actual_val.strip().lower() not in lower_list
                return actual_val not in expected_val
            return True
        elif op == "gte":
            try:
                return float(actual_val) >= float(expected_val)
            except (ValueError, TypeError):
                return False
        elif op == "lte":
            try:
                return float(actual_val) <= float(expected_val)
            except (ValueError, TypeError):
                return False
        elif op == "gt":
            try:
                return float(actual_val) > float(expected_val)
            except (ValueError, TypeError):
                return False
        elif op == "lt":
            try:
                return float(actual_val) < float(expected_val)
            except (ValueError, TypeError):
                return False
        elif op == "exists":
            return bool(actual_val)

        return False

    @classmethod
    def evaluate_schemes(
        cls,
        business_id: int,
        business_name: str,
        profile_data: Dict[str, Any],
        config_path: Optional[Path] = None,
    ) -> SchemesAssessmentResult:
        config = cls.load_config(config_path)
        raw_schemes = config.get("schemes", [])

        evaluations: List[SchemeEvaluationItem] = []
        eligible_count = 0
        potentially_eligible_count = 0
        not_eligible_count = 0
        total_benefit_inr = 0.0

        for s in raw_schemes:
            scheme_id = s.get("scheme_id", "UNKNOWN")
            name = s.get("name", "Unnamed Scheme")
            dept = s.get("department", "Unknown Department")
            category = s.get("category", "GENERAL")
            desc = s.get("description", "")
            max_desc = s.get("max_benefit_description", "")
            max_amt = float(s.get("max_amount_inr", 0.0))
            disb_mech = s.get("disbursement_mechanism")
            app_mode = s.get("application_mode", "SINGLE_WINDOW_DIRECT")
            potential_act = s.get("potential_action")
            missing_hint = list(s.get("missing_fields_hint", []))
            docs = list(s.get("required_documents", []))
            data_status = s.get("data_status", "DEMO")

            conditions = s.get("eligibility_conditions", {})
            matched: List[str] = []
            unmet: List[str] = []
            missing: List[str] = []

            for field_name, cond in conditions.items():
                op = cond.get("op", "eq")
                expected = cond.get("value")
                actual = cls.get_nested_field(profile_data, field_name)

                if actual is None:
                    missing.append(field_name)
                    if field_name not in missing_hint:
                        missing_hint.append(field_name)
                else:
                    is_match = cls._evaluate_op(actual, op, expected)
                    cond_str = f"{field_name} {op} {expected}"
                    if is_match:
                        matched.append(cond_str)
                    else:
                        unmet.append(cond_str)

            # Determine eligibility status
            if len(unmet) > 0:
                status = SchemeEligibilityStatus.NOT_ELIGIBLE
                bucket = "NOT_MATCHED"
                not_eligible_count += 1
                suggested_steps = ["Unit operational parameters do not currently satisfy mandatory criteria."]
            elif len(missing) > 0:
                status = SchemeEligibilityStatus.POTENTIALLY_ELIGIBLE
                bucket = "NEEDS_MORE_INFO"
                potentially_eligible_count += 1
                suggested_steps = [f"Provide information for '{m}' in questionnaire" for m in missing]
                if potential_act:
                    suggested_steps.append(potential_act)
            else:
                status = SchemeEligibilityStatus.ELIGIBLE
                bucket = "POTENTIALLY_ELIGIBLE"
                eligible_count += 1
                total_benefit_inr += max_amt
                suggested_steps = [f"Upload required dossier: {d}" for d in docs[:2]] + [
                    "Submit formal incentive application through single-window clearance"
                ]

            from app.schemes.schema import CriteriaBreakdown
            cb = CriteriaBreakdown(
                matched=matched,
                failed=unmet,
                unknown=[f"{m} (value not recorded)" for m in missing],
            )

            evaluations.append(
                SchemeEvaluationItem(
                    scheme_id=scheme_id,
                    name=name,
                    department=dept,
                    category=category,
                    description=desc,
                    status=status,
                    eligibility_bucket=bucket,
                    max_benefit_description=max_desc,
                    max_amount_inr=max_amt,
                    disbursement_mechanism=disb_mech,
                    application_mode=app_mode,
                    matched_conditions=matched,
                    unmet_conditions=unmet,
                    unknown_conditions=missing,
                    criteria_breakdown=cb,
                    potential_action=potential_act,
                    missing_fields_hint=missing_hint,
                    required_documents=docs,
                    missing_evidence=docs,
                    suggested_next_steps=suggested_steps,
                    data_status=data_status,
                )
            )

        now_str = ClockService.now().isoformat()

        return SchemesAssessmentResult(
            business_id=business_id,
            business_name=business_name,
            total_schemes_evaluated=len(evaluations),
            eligible_count=eligible_count,
            potentially_eligible_count=potentially_eligible_count,
            not_eligible_count=not_eligible_count,
            total_potential_benefit_inr=total_benefit_inr,
            schemes=evaluations,
            assessed_at=now_str,
            data_status="DEMO",
        )

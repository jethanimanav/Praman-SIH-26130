import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml

from app.risk.schema import (
    RiskAssessmentResult,
    RiskCategory,
    RiskColorCode,
    RiskFactorDetail,
)

RISK_CONFIG_PATH = Path("data/risk/scenario_c_risk.yaml")


class RiskEngine:
    _cached_config: Optional[Dict[str, Any]] = None

    @classmethod
    def load_config(cls, path: Optional[Path] = None) -> Dict[str, Any]:
        target = path or RISK_CONFIG_PATH
        if not target.is_file():
            # Fallback path if working dir is backend
            alt_target = Path("backend") / target
            if alt_target.is_file():
                target = alt_target

        if not target.is_file():
            # Return safe default demo config
            return {
                "risk_categories": {
                    "HIGH": {
                        "category_name": "HIGH",
                        "color_code": "RED",
                        "min_score": 70,
                        "description": "High hazard operation",
                        "joint_inspection_mandatory": true,
                        "inspection_frequency_months": 12,
                        "inspection_protocol": "Mandatory pre-commissioning joint inspection",
                    },
                    "MEDIUM": {
                        "category_name": "MEDIUM",
                        "color_code": "ORANGE",
                        "min_score": 40,
                        "description": "Moderate hazard operation",
                        "joint_inspection_mandatory": true,
                        "inspection_frequency_months": 24,
                        "inspection_protocol": "Targeted joint inspection",
                    },
                    "LOW": {
                        "category_name": "LOW",
                        "color_code": "GREEN",
                        "min_score": 0,
                        "description": "Low hazard operation",
                        "joint_inspection_mandatory": false,
                        "inspection_frequency_months": 36,
                        "inspection_protocol": "Self-certification eligible",
                    },
                },
                "scoring_factors": {},
            }

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
    def evaluate_risk(
        cls,
        business_data: Dict[str, Any],
        config_path: Optional[Path] = None,
    ) -> RiskAssessmentResult:
        """
        Deterministically evaluates the composite risk score, risk classification,
        mandated joint inspection departments, and inspection checklist.
        """
        config = cls.load_config(config_path)
        categories_cfg = config.get("risk_categories", {})
        factors_cfg = config.get("scoring_factors", {})

        score = 0
        factor_details: List[RiskFactorDetail] = []
        mandated_departments: List[str] = []
        inspection_checklist: List[str] = []
        missing_critical_fields: List[str] = []

        # Check critical parameters
        critical_keys = [
            "hazardous_waste_generated",
            "built_up_area_sqm",
            "workers_count",
            "power_connected_kw",
        ]
        for ck in critical_keys:
            if cls.get_nested_field(business_data, ck) is None:
                missing_critical_fields.append(ck)

        # Handle tiered factors on the same field to avoid duplicate counting
        # Tiered groups:
        # workers_count: high_worker_count (>=50, 15) vs moderate_worker_count (>=10, 8)
        # built_up_area_sqm: large_built_up_area (>=2000, 15) vs moderate_built_up_area (>=1000, 10)
        workers_count = cls.get_nested_field(business_data, "workers_count")
        built_up_area = cls.get_nested_field(business_data, "built_up_area_sqm")

        evaluated_worker_tier = False
        evaluated_area_tier = False

        for factor_key, factor_info in factors_cfg.items():
            field_name = factor_info.get("field")
            weight = factor_info.get("weight", 0)
            op = factor_info.get("trigger_operator")
            target_val = factor_info.get("trigger_value")
            desc = factor_info.get("description", factor_key)
            dept = factor_info.get("department")
            item = factor_info.get("inspection_item")

            actual_val = cls.get_nested_field(business_data, field_name)

            triggered = False

            if field_name == "workers_count":
                if factor_key == "high_worker_count":
                    if actual_val is not None and isinstance(actual_val, (int, float)) and actual_val >= 50:
                        triggered = True
                        evaluated_worker_tier = True
                elif factor_key == "moderate_worker_count":
                    if not evaluated_worker_tier and actual_val is not None and isinstance(actual_val, (int, float)) and actual_val >= 10:
                        triggered = True
            elif field_name == "built_up_area_sqm":
                if factor_key == "large_built_up_area":
                    if actual_val is not None and isinstance(actual_val, (int, float)) and actual_val >= 2000:
                        triggered = True
                        evaluated_area_tier = True
                elif factor_key == "moderate_built_up_area":
                    if not evaluated_area_tier and actual_val is not None and isinstance(actual_val, (int, float)) and actual_val >= 1000:
                        triggered = True
            else:
                # Standard evaluation
                if actual_val is not None:
                    if op == "eq" and actual_val == target_val:
                        triggered = True
                    elif op == "gte" and isinstance(actual_val, (int, float)) and actual_val >= target_val:
                        triggered = True
                    elif op == "gt" and isinstance(actual_val, (int, float)) and actual_val > target_val:
                        triggered = True
                    elif op == "in" and isinstance(actual_val, (list, tuple)) and target_val in actual_val:
                        triggered = True

            awarded = weight if triggered else 0
            if triggered:
                score += awarded
                if dept and dept not in mandated_departments:
                    mandated_departments.append(dept)
                if item and item not in inspection_checklist:
                    inspection_checklist.append(item)

            factor_details.append(
                RiskFactorDetail(
                    factor_key=factor_key,
                    description=desc,
                    field=field_name,
                    actual_value=actual_val,
                    score_awarded=awarded,
                    max_weight=weight,
                    triggered=triggered,
                    department=dept,
                    inspection_item=item,
                    data_status="DEMO",
                )
            )

        composite_score = min(score, 100)

        # Classify based on score thresholds
        if composite_score >= categories_cfg.get("HIGH", {}).get("min_score", 70):
            cat_key = "HIGH"
            category = RiskCategory.HIGH
            color = RiskColorCode.RED
        elif composite_score >= categories_cfg.get("MEDIUM", {}).get("min_score", 40):
            cat_key = "MEDIUM"
            category = RiskCategory.MEDIUM
            color = RiskColorCode.ORANGE
        else:
            cat_key = "LOW"
            category = RiskCategory.LOW
            color = RiskColorCode.GREEN

        cat_cfg = categories_cfg.get(cat_key, {})

        return RiskAssessmentResult(
            composite_score=composite_score,
            risk_category=category,
            color_code=color,
            category_description=cat_cfg.get("description", f"{cat_key} risk"),
            joint_inspection_mandatory=cat_cfg.get("joint_inspection_mandatory", False),
            inspection_frequency_months=cat_cfg.get("inspection_frequency_months", 36),
            inspection_protocol=cat_cfg.get("inspection_protocol", "Standard protocol"),
            factors=factor_details,
            mandated_departments=mandated_departments,
            inspection_checklist=inspection_checklist,
            missing_critical_fields=missing_critical_fields,
            is_complete=len(missing_critical_fields) == 0,
            data_status="DEMO",
        )

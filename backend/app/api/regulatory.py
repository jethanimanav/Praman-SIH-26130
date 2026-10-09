from pathlib import Path
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.regulatory.schema import (
    DataStatus,
    EvaluationResult,
    RegulatoryRule,
    RequirementCategory,
    SourceMetadata,
)
from app.regulatory.loader import RuleLoader, RuleLoadingError
from app.regulatory.engine import RuleEngine

router = APIRouter(prefix="/api/regulatory", tags=["regulatory"])

# Default path to scenario rules
RULES_DIR = Path("data/regulatory")


def get_default_engine() -> RuleEngine:
    if RULES_DIR.is_dir():
        rules = RuleLoader.load_from_directory(RULES_DIR)
    else:
        rules = []
    return RuleEngine(rules)


class AssessRequest(BaseModel):
    profile: Dict[str, Any] = Field(..., description="Business profile attributes")


class AssessResponse(BaseModel):
    total_requirements: int
    summary: Dict[str, int]
    results: List[EvaluationResult]


@router.get("/rules", response_model=List[RegulatoryRule])
def list_rules():
    """Returns all loaded regulatory rules with their demo/verified status labels."""
    engine = get_default_engine()
    return engine.rules


@router.post("/assess", response_model=AssessResponse)
def assess_profile(payload: AssessRequest):
    """
    Deterministically assesses a business profile against loaded regulatory rules.
    Returns categorized requirements (Required, Conditional, Not Applicable, Verification Required).
    """
    engine = get_default_engine()
    results = engine.evaluate_all(payload.profile)

    summary: Dict[str, int] = {
        RequirementCategory.REQUIRED.value: 0,
        RequirementCategory.CONDITIONAL.value: 0,
        RequirementCategory.NOT_APPLICABLE.value: 0,
        RequirementCategory.VERIFICATION_REQUIRED.value: 0,
    }
    for r in results:
        summary[r.category.value] = summary.get(r.category.value, 0) + 1

    return AssessResponse(
        total_requirements=len(results),
        summary=summary,
        results=results,
    )

from datetime import datetime
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.business import Business, RegulatoryProfile
from app.models.user import User
from app.api.deps import get_current_active_user
from app.ai.service import AIService
from app.ai.schema import AdaptiveQuestion, AIIntakeResult, ExtractedProfile
from app.regulatory.loader import RuleLoader
from app.regulatory.engine import RuleEngine
from app.regulatory.schema import EvaluationResult
from app.regulatory.discovery import (
    RegulatoryDiscoveryResponse,
    RegulatoryDiscoveryService,
)
from app.core.audit import record_audit
from pathlib import Path

router = APIRouter(prefix="/api/business", tags=["business"])

RULES_DIR = Path("data/regulatory")


def get_rules():
    if RULES_DIR.is_dir():
        return RuleLoader.load_from_directory(RULES_DIR)
    return []


# --- Request & Response Models ---

class CreateBusinessRequest(BaseModel):
    name: str
    description: Optional[str] = None
    registration_number: Optional[str] = None
    entity_type: Optional[str] = None
    pan_number: Optional[str] = None
    gstin: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    registered_office_address: Optional[str] = None


class UpdateBusinessRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    registration_number: Optional[str] = None
    entity_type: Optional[str] = None
    pan_number: Optional[str] = None
    gstin: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    registered_office_address: Optional[str] = None


class BusinessResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    registration_number: Optional[str] = None
    entity_type: Optional[str] = None
    pan_number: Optional[str] = None
    gstin: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    registered_office_address: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DescribeBusinessRequest(BaseModel):
    description: str


class IntakeResponse(BaseModel):
    business_id: int
    extraction: AIIntakeResult
    adaptive_questions: List[AdaptiveQuestion]


class AnswerQuestionsRequest(BaseModel):
    answers: Dict[str, Any]  # Maps field name (e.g. 'effluent_generation') to answered value


class ConfirmProfileRequest(BaseModel):
    profile_data: Dict[str, Any]  # Applicant confirmed/corrected profile values


class ProfileEvaluationResponse(BaseModel):
    business_id: int
    is_confirmed: bool
    confirmed_data: Dict[str, Any]
    total_requirements: int
    results: List[EvaluationResult]


# --- Endpoints ---

@router.post("", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: CreateBusinessRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new business project under the applicant account."""
    business = Business(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        registration_number=payload.registration_number,
        entity_type=payload.entity_type,
        pan_number=payload.pan_number,
        gstin=payload.gstin,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        registered_office_address=payload.registered_office_address,
    )
    db.add(business)
    db.commit()
    db.refresh(business)

    record_audit(
        db,
        "business.create",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value,
        entity_type="business",
        entity_id=str(business.id),
        new_value={"name": business.name},
    )
    db.commit()
    return business


@router.get("", response_model=List[BusinessResponse])
def list_businesses(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """List businesses belonging to current user."""
    return db.query(Business).filter(Business.user_id == current_user.id).all()


@router.get("/{business_id}", response_model=BusinessResponse)
def get_business(
    business_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    business = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@router.put("/{business_id}", response_model=BusinessResponse)
def update_business(
    business_id: int,
    payload: UpdateBusinessRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Update reusable company profile details."""
    business = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(business, field, val)

    record_audit(
        db,
        "business.update",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value,
        entity_type="business",
        entity_id=str(business.id),
        new_value=update_data,
    )
    db.commit()
    db.refresh(business)
    return business


@router.post("/{business_id}/describe", response_model=IntakeResponse)
def describe_business(
    business_id: int,
    payload: DescribeBusinessRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Submits natural language description.
    AI extracts structured profile, stores provenance & confidence,
    and returns targeted adaptive questions based on missing high-impact fields.
    """
    business = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    business.description = payload.description
    db.commit()

    # Process via AIService
    ai_service = AIService()
    intake_result = ai_service.process_intake_description(payload.description)
    raw_dict = intake_result.extracted_profile.to_profile_dict()

    # Determine missing high-impact questions using M1 rules
    rules = get_rules()
    adaptive_questions = ai_service.select_adaptive_questions(raw_dict, rules)

    # Persist or update RegulatoryProfile
    profile = db.query(RegulatoryProfile).filter(RegulatoryProfile.business_id == business.id).first()
    if not profile:
        profile = RegulatoryProfile(
            business_id=business.id,
            extracted_data=raw_dict,
            field_confidence=intake_result.field_confidence,
            provenance=intake_result.provenance,
            confirmed_data=raw_dict,  # initial draft
            is_confirmed=False,
            pending_questions=[q.model_dump() for q in adaptive_questions],
        )
        db.add(profile)
    else:
        profile.extracted_data = raw_dict
        profile.field_confidence = intake_result.field_confidence
        profile.provenance = intake_result.provenance
        profile.confirmed_data = raw_dict
        profile.is_confirmed = False
        profile.pending_questions = [q.model_dump() for q in adaptive_questions]

    db.commit()

    record_audit(
        db,
        "business.ai_intake",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value,
        entity_type="business",
        entity_id=str(business.id),
        extra={"provider": intake_result.provider_name, "is_fallback": intake_result.is_fallback},
    )
    db.commit()

    return IntakeResponse(
        business_id=business.id,
        extraction=intake_result,
        adaptive_questions=adaptive_questions,
    )


@router.post("/{business_id}/answer-questions")
def answer_questions(
    business_id: int,
    payload: AnswerQuestionsRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Submits answers to adaptive questions.
    Updates the working regulatory profile data and tracks provenance.
    If value is null ('Not sure'), preserves it as unknown.
    """
    business = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    profile = db.query(RegulatoryProfile).filter(RegulatoryProfile.business_id == business.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Business has not undergone AI intake yet")

    current_confirmed = dict(profile.confirmed_data or {})
    current_prov = dict(profile.provenance or {})
    current_answers = dict(profile.question_answers or {})

    for field, val in payload.answers.items():
        current_answers[field] = val
        # If val is provided or explicitly None ('Not sure'), record it in the profile
        if "." in field:
            parts = field.split(".")
            d = current_confirmed
            for p in parts[:-1]:
                d = d.setdefault(p, {})
            d[parts[-1]] = val
        else:
            current_confirmed[field] = val

        current_prov[field] = {
            "source": "user_question_answer",
            "answered_at": datetime.utcnow().isoformat(),
            "explicitly_unknown": val is None,
        }

    profile.confirmed_data = current_confirmed
    profile.provenance = current_prov
    profile.question_answers = current_answers
    db.commit()

    return {
        "business_id": business.id,
        "updated_profile": current_confirmed,
        "message": "Answers recorded successfully.",
    }


@router.post("/{business_id}/confirm", response_model=ProfileEvaluationResponse)
def confirm_profile(
    business_id: int,
    payload: ConfirmProfileRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Applicant reviews and confirms or corrects the final profile.
    Saves confirmed profile and evaluates it against the deterministic M1 Regulatory Engine.
    """
    business = db.query(Business).filter(Business.id == business_id, Business.user_id == current_user.id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    profile = db.query(RegulatoryProfile).filter(RegulatoryProfile.business_id == business.id).first()
    if not profile:
        profile = RegulatoryProfile(
            business_id=business.id,
            extracted_data=payload.profile_data,
            confirmed_data=payload.profile_data,
            is_confirmed=True,
        )
        db.add(profile)
    else:
        profile.confirmed_data = payload.profile_data
        profile.is_confirmed = True

    db.commit()

    record_audit(
        db,
        "business.profile_confirmed",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role.value,
        entity_type="business",
        entity_id=str(business.id),
        new_value=payload.profile_data,
    )
    db.commit()

    # Pass confirmed profile to deterministic M1 Regulatory Engine
    rules = get_rules()
    engine = RuleEngine(rules)
    eval_results = engine.evaluate_all(payload.profile_data)

    return ProfileEvaluationResponse(
        business_id=business.id,
        is_confirmed=True,
        confirmed_data=payload.profile_data,
        total_requirements=len(eval_results),
        results=eval_results,
    )


@router.get("/{business_id}/regulatory-discovery", response_model=RegulatoryDiscoveryResponse)
def get_regulatory_discovery(
    business_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Returns normalized, explainable regulatory discovery and checklist for a confirmed profile.
    Requires business ownership and profile confirmation.
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found",
        )

    if business.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized business access",
        )

    profile = db.query(RegulatoryProfile).filter(RegulatoryProfile.business_id == business.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Regulatory profile not found",
        )

    if not profile.is_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile confirmation required before regulatory discovery can be generated",
        )

    rules = get_rules()
    return RegulatoryDiscoveryService.discover_requirements(
        business_id=business.id,
        business_name=business.name,
        confirmed_profile=profile.confirmed_data or {},
        rules=rules,
    )


from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FieldExtraction(BaseModel):
    value: Optional[Any] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    provenance_source: str = "ai_extraction"
    notes: Optional[str] = None


class ExtractedProfile(BaseModel):
    """Normalized structured profile fields extracted from natural language."""
    sector: Optional[str] = None
    sub_sector: Optional[str] = None
    location_zone_type: Optional[str] = None
    processes: List[str] = Field(default_factory=list)
    effluent_generation: Optional[bool] = None
    air_emissions: Optional[bool] = None
    hazardous_waste_generated: Optional[bool] = None
    workers_count: Optional[int] = None
    power_connected_kw: Optional[float] = None
    built_up_area_sqm: Optional[float] = None
    water_source: Optional[str] = None

    # Any additional arbitrary fields parsed
    additional_attributes: Dict[str, Any] = Field(default_factory=dict)

    def to_profile_dict(self) -> Dict[str, Any]:
        """Flattens and formats into the dictionary structure expected by M1 RuleEngine."""
        res: Dict[str, Any] = dict(self.additional_attributes)
        if self.sector is not None:
            res["sector"] = self.sector
        if self.sub_sector is not None:
            res["sub_sector"] = self.sub_sector
        if self.location_zone_type is not None:
            res.setdefault("location", {})
            if isinstance(res["location"], dict):
                res["location"]["zone_type"] = self.location_zone_type
        if self.processes:
            res["processes"] = self.processes
        if self.effluent_generation is not None:
            res["effluent_generation"] = self.effluent_generation
        if self.air_emissions is not None:
            res["air_emissions"] = self.air_emissions
        if self.hazardous_waste_generated is not None:
            res["hazardous_waste_generated"] = self.hazardous_waste_generated
        if self.workers_count is not None:
            res["workers_count"] = self.workers_count
        if self.power_connected_kw is not None:
            res["power_connected_kw"] = self.power_connected_kw
        if self.built_up_area_sqm is not None:
            res["built_up_area_sqm"] = self.built_up_area_sqm
        if self.water_source is not None:
            res["water_source"] = self.water_source
        return res


class AIIntakeResult(BaseModel):
    provider_name: str
    extracted_profile: ExtractedProfile
    field_confidence: Dict[str, float]
    provenance: Dict[str, Dict[str, Any]]
    raw_response: Optional[str] = None
    is_fallback: bool = False
    notes: Optional[str] = None


class AdaptiveQuestionOption(BaseModel):
    label: str
    value: Any


class AdaptiveQuestion(BaseModel):
    id: str
    field: str
    question_text: str
    explanation: str
    rule_ids: List[str] = Field(default_factory=list)
    question_type: str = "single_select"  # single_select, boolean, number, text
    options: List[AdaptiveQuestionOption] = Field(default_factory=list)

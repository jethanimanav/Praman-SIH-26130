from abc import ABC, abstractmethod
import json
import re
from typing import Any, Dict, Optional
from app.ai.schema import AIIntakeResult, ExtractedProfile


class BaseAIProvider(ABC):
    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @abstractmethod
    def extract_profile(self, text: str) -> AIIntakeResult:
        """Extract structured profile from natural language text."""
        pass


class CachedProvider(BaseAIProvider):
    """
    Default deterministic offline provider.
    Returns pre-recorded high-confidence responses for known scenarios (Scenario C)
    and falls back cleanly for unknown text.
    """

    @property
    def provider_name(self) -> str:
        return "CachedProvider"

    def extract_profile(self, text: str) -> AIIntakeResult:
        lower = text.lower()

        # Check for Scenario C indicators: automotive / metal / electroplating / manufacturing
        if any(w in lower for w in ["auto", "automotive", "electroplating", "component", "metal parts"]):
            # Scenario C pre-recorded profile
            profile = ExtractedProfile(
                sector="manufacturing",
                sub_sector="automotive_components",
                location_zone_type="industrial",
                processes=["electroplating", "metal_fabrication"],
                effluent_generation=True,
                air_emissions=True,
                hazardous_waste_generated=True,
                workers_count=35,
                power_connected_kw=250.0,
                built_up_area_sqm=2500.0,
                water_source="borewell",
            )
            field_conf = {
                "sector": 0.98,
                "sub_sector": 0.95,
                "location_zone_type": 0.90,
                "processes": 0.95,
                "effluent_generation": 0.92,
                "air_emissions": 0.88,
                "hazardous_waste_generated": 0.90,
                "workers_count": 0.85,
                "power_connected_kw": 0.85,
                "built_up_area_sqm": 0.80,
                "water_source": 0.80,
            }
            provenance = {
                k: {"source": "cached_scenario_c", "provider": self.provider_name}
                for k in field_conf
            }
            return AIIntakeResult(
                provider_name=self.provider_name,
                extracted_profile=profile,
                field_confidence=field_conf,
                provenance=provenance,
                raw_response="[Scenario C Pre-recorded Offline Intake]",
                is_fallback=False,
            )

        # Non-Scenario-C text: delegate to RuleBasedFallbackProvider logic
        fallback = RuleBasedFallbackProvider()
        res = fallback.extract_profile(text)
        res.provider_name = self.provider_name
        return res


class RuleBasedFallbackProvider(BaseAIProvider):
    """
    Deterministic rule/heuristic-based extractor.
    Operates offline with ₹0 cost, no LLM required.
    Does not invent unknown facts.
    """

    @property
    def provider_name(self) -> str:
        return "RuleBasedFallbackProvider"

    def extract_profile(self, text: str) -> AIIntakeResult:
        lower = text.lower()
        profile = ExtractedProfile()
        field_conf: Dict[str, float] = {}
        provenance: Dict[str, Dict[str, Any]] = {}

        def record(field: str, val: Any, conf: float, reason: str):
            setattr(profile, field, val)
            field_conf[field] = conf
            provenance[field] = {
                "source": "heuristic_regex",
                "provider": self.provider_name,
                "matched_pattern": reason,
            }

        # Sector
        if any(w in lower for w in ["manufactur", "fabricat", "product", "factory", "industrial unit"]):
            record("sector", "manufacturing", 0.85, "keyword_manufacturing")
        elif any(w in lower for w in ["software", "it services", "tech consulting"]):
            record("sector", "services", 0.85, "keyword_services")

        # Location zone
        if "industrial area" in lower or "industrial zone" in lower or "midc" in lower or "industrial park" in lower:
            record("location_zone_type", "industrial", 0.85, "keyword_industrial_zone")
        elif "commercial" in lower:
            record("location_zone_type", "commercial", 0.75, "keyword_commercial")

        # Processes
        found_processes = []
        if "electroplat" in lower:
            found_processes.append("electroplating")
        if "fabricat" in lower or "machining" in lower or "welding" in lower:
            found_processes.append("metal_fabrication")
        if "heat treatment" in lower:
            found_processes.append("heat_treatment")
        if "foundry" in lower or "casting" in lower:
            found_processes.append("foundry")
        if found_processes:
            record("processes", found_processes, 0.90, "processes_list")

        # Effluent / Water pollution
        if any(w in lower for w in ["effluent", "wastewater", "liquid discharge", "chemical wash"]):
            record("effluent_generation", True, 0.85, "effluent_keywords")

        # Air emissions
        if any(w in lower for w in ["chimney", "stack", "boiler emissions", "furnace", "air emission"]):
            record("air_emissions", True, 0.85, "emissions_keywords")

        # Hazardous waste
        if any(w in lower for w in ["hazardous waste", "toxic sludge", "spent acid", "chemical waste"]):
            record("hazardous_waste_generated", True, 0.85, "hazardous_keywords")
        elif "electroplating" in found_processes:
            # High correlation, but mark lower confidence
            record("hazardous_waste_generated", True, 0.70, "inferred_from_electroplating")

        # Workers count via regex (e.g. "25 workers", "employing 50 people")
        worker_match = re.search(r"(\d+)\s*(?:workers|employees|staff|people|persons)", lower)
        if worker_match:
            record("workers_count", int(worker_match.group(1)), 0.90, "regex_workers")

        # Power via regex (e.g. "150 kw", "200 kva", "75 hp")
        power_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:kw|kilowatt)", lower)
        if power_match:
            record("power_connected_kw", float(power_match.group(1)), 0.90, "regex_power_kw")

        # Built up area (e.g. "1200 sqm", "1500 sq meters", "5000 sq ft")
        area_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:sqm|sq\.m|sq meters)", lower)
        if area_match:
            record("built_up_area_sqm", float(area_match.group(1)), 0.90, "regex_area_sqm")

        # Water source
        if "borewell" in lower or "groundwater" in lower or "ground water" in lower:
            record("water_source", "borewell", 0.85, "keyword_borewell")
        elif "municipal" in lower or "midc water" in lower or "piped supply" in lower:
            record("water_source", "municipal_pipeline", 0.85, "keyword_municipal")

        return AIIntakeResult(
            provider_name=self.provider_name,
            extracted_profile=profile,
            field_confidence=field_conf,
            provenance=provenance,
            raw_response="[Heuristic Rule-Based Profile Extraction]",
            is_fallback=True,
        )


class GeminiProvider(BaseAIProvider):
    """
    Google Gemini LLM provider.
    Only active if GEMINI_API_KEY is configured.
    Falls back cleanly to RuleBasedFallbackProvider on any error or missing key.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model_name = model_name

    @property
    def provider_name(self) -> str:
        return "GeminiProvider"

    def extract_profile(self, text: str) -> AIIntakeResult:
        if not self.api_key:
            # Fall back directly
            fallback = RuleBasedFallbackProvider()
            res = fallback.extract_profile(text)
            res.notes = "Gemini API key not configured; used rule-based fallback."
            return res

        try:
            import google.generativeai as genai  # type: ignore
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model_name)

            prompt = (
                "You are an AI assistant for industrial regulatory intake. "
                "Extract structured facts from the business description into JSON. "
                "CRITICAL: DO NOT invent facts. If an attribute is unknown or not mentioned, return null. "
                "Output JSON format matching this schema:\n"
                "{\n"
                '  "sector": string or null,\n'
                '  "sub_sector": string or null,\n'
                '  "location_zone_type": "industrial" | "commercial" | "residential" | null,\n'
                '  "processes": list of strings,\n'
                '  "effluent_generation": boolean or null,\n'
                '  "air_emissions": boolean or null,\n'
                '  "hazardous_waste_generated": boolean or null,\n'
                '  "workers_count": integer or null,\n'
                '  "power_connected_kw": float or null,\n'
                '  "built_up_area_sqm": float or null,\n'
                '  "water_source": string or null\n'
                "}\n\n"
                f"Business Description:\n{text}\n\nJSON:"
            )

            response = model.generate_content(prompt)
            raw_text = response.text

            # Clean code fences if present
            cleaned = re.sub(r"```json\s*", "", raw_text)
            cleaned = re.sub(r"```\s*", "", cleaned).strip()

            parsed = json.loads(cleaned)
            profile = ExtractedProfile(**parsed)

            # Assign moderate-high confidence to non-null fields
            field_conf = {}
            provenance = {}
            for k, v in profile.model_dump().items():
                if v is not None and v != [] and v != {}:
                    field_conf[k] = 0.90
                    provenance[k] = {
                        "source": "gemini_generation",
                        "provider": self.provider_name,
                        "model": self.model_name,
                    }

            return AIIntakeResult(
                provider_name=self.provider_name,
                extracted_profile=profile,
                field_confidence=field_conf,
                provenance=provenance,
                raw_response=raw_text,
                is_fallback=False,
            )
        except Exception:
            # Fall back to RuleBasedFallbackProvider on any error
            fallback = RuleBasedFallbackProvider()
            res = fallback.extract_profile(text)
            return res

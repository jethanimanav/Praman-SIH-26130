from typing import Any, Dict, List, Optional, Set
from app.ai.schema import AdaptiveQuestion, AdaptiveQuestionOption, AIIntakeResult, ExtractedProfile
from app.ai.providers import BaseAIProvider, CachedProvider, GeminiProvider, RuleBasedFallbackProvider
from app.regulatory.schema import Condition, RegulatoryRule
from app.config import get_settings

settings = get_settings()


class AIService:
    """
    Orchestrates business intake extraction, confidence scoring,
    and rule-driven adaptive question selection.
    """

    def __init__(self, provider: Optional[BaseAIProvider] = None):
        if provider:
            self.provider = provider
        elif settings.gemini_enabled:
            self.provider = GeminiProvider(
                api_key=settings.gemini_api_key,
                model_name=settings.gemini_model,
            )
        else:
            # Default offline provider for demonstration and zero-cost local execution
            self.provider = CachedProvider()

    def process_intake_description(self, description: str) -> AIIntakeResult:
        """Extracts structured profile from natural language description."""
        if not description or not description.strip():
            # Return empty profile if description is blank
            return AIIntakeResult(
                provider_name=self.provider.provider_name,
                extracted_profile=ExtractedProfile(),
                field_confidence={},
                provenance={},
                raw_response="",
                is_fallback=True,
            )
        return self.provider.extract_profile(description)

    @classmethod
    def find_fields_in_condition(cls, condition: Condition) -> Set[str]:
        """Extracts all field paths referenced by a rule condition."""
        fields = set()
        if condition.field:
            fields.add(condition.field)
        if condition.all:
            for c in condition.all:
                fields.update(cls.find_fields_in_condition(c))
        if condition.any:
            for c in condition.any:
                fields.update(cls.find_fields_in_condition(c))
        if condition.not_:
            fields.update(cls.find_fields_in_condition(condition.not_))
        return fields

    @classmethod
    def select_adaptive_questions(
        cls,
        current_profile: Dict[str, Any],
        rules: List[RegulatoryRule],
        min_questions: int = 3,
        max_questions: int = 7,
    ) -> List[AdaptiveQuestion]:
        """
        Dynamically analyzes loaded regulatory rules to discover which missing profile fields
        directly influence regulatory outcomes.
        Returns 3–7 high-impact adaptive questions.
        """
        # Map each field path to the list of rule IDs that evaluate it
        field_to_rules: Dict[str, List[str]] = {}
        for rule in rules:
            rule_fields = cls.find_fields_in_condition(rule.condition)
            for f in rule_fields:
                field_to_rules.setdefault(f, []).append(rule.id)

        # Helper to check if field exists in profile
        def is_field_present(field_path: str) -> bool:
            parts = field_path.split(".")
            curr = current_profile
            for p in parts:
                if not isinstance(curr, dict) or p not in curr:
                    return False
                curr = curr[p]
            return curr is not None and curr != "" and curr != []

        # Filter to only fields that are missing in the current profile
        missing_fields = [f for f in field_to_rules if not is_field_present(f)]

        # Sort missing fields by impact (number of rules affected descending)
        missing_fields.sort(key=lambda f: len(field_to_rules[f]), reverse=True)

        # Question template library for known industrial attributes
        QUESTION_TEMPLATES: Dict[str, Dict[str, Any]] = {
            "effluent_generation": {
                "question": "Does your facility generate trade effluent or process wastewater requiring discharge/treatment?",
                "type": "boolean",
                "options": [
                    {"label": "Yes, generates effluent", "value": True},
                    {"label": "No, dry process only", "value": False},
                    {"label": "Not sure (requires verification)", "value": None},
                ],
            },
            "air_emissions": {
                "question": "Will your plant operate fuel boilers, furnaces, DG sets, or processes emitting chimney emissions?",
                "type": "boolean",
                "options": [
                    {"label": "Yes, operating chimneys/stacks", "value": True},
                    {"label": "No air emission sources", "value": False},
                    {"label": "Not sure (requires verification)", "value": None},
                ],
            },
            "hazardous_waste_generated": {
                "question": "Does your production generate hazardous or toxic wastes (e.g. chemical sludge, spent acids, e-waste)?",
                "type": "boolean",
                "options": [
                    {"label": "Yes, produces hazardous waste", "value": True},
                    {"label": "No hazardous waste generated", "value": False},
                    {"label": "Not sure (requires verification)", "value": None},
                ],
            },
            "water_source": {
                "question": "What will be the primary water source for industrial operations?",
                "type": "single_select",
                "options": [
                    {"label": "Groundwater / Borewell", "value": "borewell"},
                    {"label": "Industrial Park / Municipal Pipeline", "value": "municipal_pipeline"},
                    {"label": "Private Water Tankers", "value": "tanker"},
                    {"label": "Not sure (requires verification)", "value": None},
                ],
            },
            "power_connected_kw": {
                "question": "What is the estimated total electrical connected load for machinery?",
                "type": "single_select",
                "options": [
                    {"label": "Under 50 kW", "value": 40.0},
                    {"label": "50 kW to 99 kW", "value": 75.0},
                    {"label": "100 kW or higher (High Tension HT)", "value": 150.0},
                    {"label": "Not sure (requires verification)", "value": None},
                ],
            },
            "workers_count": {
                "question": "How many workers/employees will be working on the factory floor simultaneously?",
                "type": "single_select",
                "options": [
                    {"label": "Fewer than 10 workers", "value": 8},
                    {"label": "10 to 49 workers", "value": 25},
                    {"label": "50 or more workers", "value": 60},
                    {"label": "Not sure (requires verification)", "value": None},
                ],
            },
            "built_up_area_sqm": {
                "question": "What is the total planned built-up floor area of the factory premises?",
                "type": "single_select",
                "options": [
                    {"label": "Under 1,000 sqm", "value": 800.0},
                    {"label": "1,000 sqm or greater", "value": 1500.0},
                    {"label": "Not sure (requires verification)", "value": None},
                ],
            },
            "location.zone_type": {
                "question": "What is the designated zoning classification of your unit's land parcel?",
                "type": "single_select",
                "options": [
                    {"label": "Approved Industrial Zone (e.g. MIDC / Industrial Park)", "value": "industrial"},
                    {"label": "Commercial Zone", "value": "commercial"},
                    {"label": "Agricultural / Non-Urban Zone", "value": "agricultural"},
                    {"label": "Not sure (requires verification)", "value": None},
                ],
            },
            "processes": {
                "question": "Which of these key manufacturing processes are planned for your unit?",
                "type": "single_select",
                "options": [
                    {"label": "Electroplating and Surface Finishing", "value": ["electroplating"]},
                    {"label": "Machining and Mechanical Fabrication", "value": ["metal_fabrication"]},
                    {"label": "Heat Treatment and Annealing", "value": ["heat_treatment"]},
                    {"label": "Foundry / Metal Casting", "value": ["foundry"]},
                    {"label": "Not sure / Other", "value": None},
                ],
            },
        }

        questions: List[AdaptiveQuestion] = []
        for f in missing_fields:
            if len(questions) >= max_questions:
                break

            template = QUESTION_TEMPLATES.get(f)
            if template:
                q_text = template["question"]
                q_type = template["type"]
                options = [AdaptiveQuestionOption(**opt) for opt in template["options"]]
            else:
                # Dynamic fallback question derived from field path
                clean_name = f.replace(".", " ").replace("_", " ").title()
                q_text = f"Please specify the value for '{clean_name}' for regulatory evaluation."
                q_type = "text"
                options = [
                    AdaptiveQuestionOption(label="Not sure (requires verification)", value=None)
                ]

            affected_rules = field_to_rules[f]
            questions.append(
                AdaptiveQuestion(
                    id=f"Q_{f.replace('.', '_')}",
                    field=f,
                    question_text=q_text,
                    explanation=f"Required by regulatory rule(s): {', '.join(affected_rules)}",
                    rule_ids=affected_rules,
                    question_type=q_type,
                    options=options,
                )
            )

        # Enforce minimum questions if possible
        return questions[:max_questions]

from pathlib import Path
from typing import Dict, List, Optional
import yaml
from app.sla.schema import SLAConfig, SLAFileSchema


class SLALoader:
    """Loads and validates SLA configuration YAML files."""

    @classmethod
    def load_from_file(cls, path: Path) -> List[SLAConfig]:
        with open(path, "r", encoding="utf-8") as f:
            raw_data = yaml.safe_load(f)

        parsed = SLAFileSchema.model_validate(raw_data)
        return parsed.slas

    @classmethod
    def load_from_directory(cls, dir_path: Path) -> Dict[str, SLAConfig]:
        """
        Loads all SLA yaml files in directory.
        Returns a mapping of requirement_id -> SLAConfig.
        """
        sla_map: Dict[str, SLAConfig] = {}
        if not dir_path.exists():
            return sla_map

        for yaml_path in sorted(dir_path.glob("*sla*.yaml")):
            slas = cls.load_from_file(yaml_path)
            for sla in slas:
                sla_map[sla.requirement_id] = sla

        return sla_map

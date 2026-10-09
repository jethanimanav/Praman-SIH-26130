import os
from pathlib import Path
from typing import List, Union
import yaml
from pydantic import ValidationError

from app.regulatory.schema import RegulatoryRule, RuleFileSchema


class RuleLoadingError(Exception):
    """Exception raised when loading or validating regulatory rules fails."""
    pass


class RuleLoader:
    """Loads and validates regulatory rule YAML files."""

    @classmethod
    def load_from_yaml_string(cls, yaml_content: str, source_label: str = "<string>") -> List[RegulatoryRule]:
        try:
            data = yaml.safe_load(yaml_content)
        except yaml.YAMLError as e:
            raise RuleLoadingError(f"YAML parsing error in {source_label}: {e}") from e

        if not isinstance(data, dict):
            raise RuleLoadingError(f"Root of rule YAML in {source_label} must be a mapping/dict, got {type(data).__name__}")

        try:
            parsed = RuleFileSchema.model_validate(data)
            return parsed.rules
        except ValidationError as e:
            raise RuleLoadingError(f"Schema validation error in {source_label}:\n{e}") from e

    @classmethod
    def load_from_file(cls, file_path: Union[str, Path]) -> List[RegulatoryRule]:
        path = Path(file_path)
        if not path.is_file():
            raise RuleLoadingError(f"Rule file does not exist: {file_path}")

        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
        except OSError as e:
            raise RuleLoadingError(f"Failed to read file {file_path}: {e}") from e

        return cls.load_from_yaml_string(content, source_label=str(file_path))

    @classmethod
    def load_from_directory(cls, dir_path: Union[str, Path]) -> List[RegulatoryRule]:
        directory = Path(dir_path)
        if not directory.is_dir():
            raise RuleLoadingError(f"Rule directory does not exist: {dir_path}")

        rules: List[RegulatoryRule] = []
        rule_ids = set()

        for ext in ("*.yaml", "*.yml"):
            for file_path in sorted(directory.rglob(ext)):
                file_rules = cls.load_from_file(file_path)
                for r in file_rules:
                    if r.id in rule_ids:
                        raise RuleLoadingError(
                            f"Duplicate rule ID '{r.id}' detected while loading {file_path}"
                        )
                    rule_ids.add(r.id)
                    rules.append(r)

        return rules

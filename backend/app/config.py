from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    secret_key: str = "dev-secret-key-change-in-production-minimum-32-chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    database_url: str = "sqlite:///./rop.db"
    environment: str = "development"
    debug: bool = True

    # Gemini (optional)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"

    # Demo
    demo_user_password: str = "Demo@12345"

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_api_key)


@lru_cache()
def get_settings() -> Settings:
    return Settings()

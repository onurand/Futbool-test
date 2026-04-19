"""Application settings. All values read from the environment (or a local .env).

Secrets never live in the repo. A starter .env is written to .env.example with
placeholders; copy to .env and fill in locally.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_env: str = "development"
    app_base_url: str = "http://localhost:8000"
    web_base_url: str = "http://localhost:3000"
    jwt_secret: str = "change-me"

    # Claude
    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-4-7"

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/futbool"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # Providers
    sportmonks_api_key: str = Field(default="")
    the_odds_api_key: str = Field(default="")
    football_data_org_key: str = Field(default="")

    # Feature flags
    use_mock_providers: bool = True  # flip to False once real API keys are live.

    @property
    def is_prod(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()

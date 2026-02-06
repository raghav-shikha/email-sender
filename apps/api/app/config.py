from __future__ import annotations

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    next_public_supabase_url: str = ""
    next_public_supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Shared secrets
    oauth_state_secret: str = ""

    # API
    cron_secret: str = ""
    token_encryption_key_b64: str = ""
    web_base_url: str = "http://localhost:3000"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    # Push (VAPID)
    vapid_subject: str = ""
    vapid_public_key: str = ""
    vapid_private_key: str = ""

    # LLM
    llm_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = ""
    gemini_api_key: str = ""
    gemini_model: str = ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

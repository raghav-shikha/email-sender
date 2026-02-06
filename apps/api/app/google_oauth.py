from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from .config import get_settings


GMAIL_SCOPES = [
    # Read messages
    "https://www.googleapis.com/auth/gmail.readonly",
    # Send replies (manual approval gate enforced by product/UI)
    "https://www.googleapis.com/auth/gmail.send",
]


def build_google_oauth_url(*, state: str) -> str:
    settings = get_settings()
    if not settings.google_client_id:
        raise RuntimeError("Missing GOOGLE_CLIENT_ID")
    if not settings.google_redirect_uri:
        raise RuntimeError("Missing GOOGLE_REDIRECT_URI")

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "scope": " ".join(GMAIL_SCOPES),
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)


@dataclass
class GoogleTokenResponse:
    access_token: str
    refresh_token: str | None
    scope: str | None
    token_type: str | None
    expires_in: int | None


async def exchange_code_for_tokens(*, code: str) -> GoogleTokenResponse:
    settings = get_settings()
    if not settings.google_client_id:
        raise RuntimeError("Missing GOOGLE_CLIENT_ID")
    if not settings.google_client_secret:
        raise RuntimeError("Missing GOOGLE_CLIENT_SECRET")
    if not settings.google_redirect_uri:
        raise RuntimeError("Missing GOOGLE_REDIRECT_URI")

    data = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data=data)
    resp.raise_for_status()
    j = resp.json()
    return GoogleTokenResponse(
        access_token=j.get("access_token", ""),
        refresh_token=j.get("refresh_token"),
        scope=j.get("scope"),
        token_type=j.get("token_type"),
        expires_in=j.get("expires_in"),
    )


async def refresh_access_token(*, refresh_token: str) -> str:
    settings = get_settings()
    if not settings.google_client_id:
        raise RuntimeError("Missing GOOGLE_CLIENT_ID")
    if not settings.google_client_secret:
        raise RuntimeError("Missing GOOGLE_CLIENT_SECRET")

    data = {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data=data)
    resp.raise_for_status()
    j = resp.json()
    token = j.get("access_token")
    if not token:
        raise RuntimeError("Failed to refresh access token")
    return token


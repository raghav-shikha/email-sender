from __future__ import annotations

import httpx
from jose import jwt
from jose.exceptions import JWTError

from .config import get_settings


async def require_user_id_from_authorization_header(authorization: str | None) -> str:
    if not authorization:
        raise PermissionError("Missing Authorization header")
    if not authorization.lower().startswith("bearer "):
        raise PermissionError("Invalid Authorization header")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise PermissionError("Invalid Authorization header")

    settings = get_settings()
    if not settings.next_public_supabase_url or not settings.next_public_supabase_anon_key:
        raise RuntimeError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")

    url = settings.next_public_supabase_url.rstrip("/") + "/auth/v1/user"
    headers = {
        "apikey": settings.next_public_supabase_anon_key,
        "authorization": f"Bearer {token}",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=headers)
    if resp.status_code != 200:
        raise PermissionError("Invalid token")

    j = resp.json()
    user_id = j.get("id")
    if not isinstance(user_id, str) or not user_id:
        raise PermissionError("Invalid token")
    return user_id


def require_user_id_from_oauth_state(state: str) -> str:
    settings = get_settings()
    if not settings.oauth_state_secret:
        raise RuntimeError("Missing OAUTH_STATE_SECRET")

    try:
        payload = jwt.decode(state, settings.oauth_state_secret, algorithms=["HS256"])
    except JWTError as e:
        raise PermissionError("Invalid OAuth state") from e

    # We encode user id in "sub" on the web side.
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise PermissionError("Invalid OAuth state")
    return sub


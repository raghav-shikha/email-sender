from __future__ import annotations

from typing import Any, Literal

import httpx

from .config import get_settings


class SupabaseRestError(RuntimeError):
    pass


class SupabaseRest:
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.next_public_supabase_url:
            raise RuntimeError("Missing NEXT_PUBLIC_SUPABASE_URL")
        if not settings.supabase_service_role_key:
            raise RuntimeError("Missing SUPABASE_SERVICE_ROLE_KEY")
        self._base = settings.next_public_supabase_url.rstrip("/") + "/rest/v1"
        self._service_role_key = settings.supabase_service_role_key

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._service_role_key,
            "authorization": f"Bearer {self._service_role_key}",
            "content-type": "application/json",
        }

    async def select(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: dict[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {"select": columns}
        if filters:
            params.update(filters)
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self._base}/{table}", params=params, headers=self._headers())
        if resp.status_code >= 400:
            raise SupabaseRestError(f"Supabase select failed: {resp.status_code} {resp.text}")
        return resp.json()

    async def insert(
        self,
        table: str,
        rows: dict[str, Any] | list[dict[str, Any]],
        *,
        upsert: bool = False,
        ignore_duplicates: bool = False,
        on_conflict: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {}
        if on_conflict:
            params["on_conflict"] = on_conflict
        prefer = ["return=representation"]
        if upsert:
            prefer.append("resolution=ignore-duplicates" if ignore_duplicates else "resolution=merge-duplicates")
        headers = self._headers()
        headers["Prefer"] = ",".join(prefer)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self._base}/{table}", params=params, headers=headers, json=rows)
        if resp.status_code >= 400:
            raise SupabaseRestError(f"Supabase insert failed: {resp.status_code} {resp.text}")
        return resp.json()

    async def update(
        self,
        table: str,
        patch: dict[str, Any],
        *,
        filters: dict[str, str],
    ) -> list[dict[str, Any]]:
        headers = self._headers()
        headers["Prefer"] = "return=representation"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.patch(f"{self._base}/{table}", params=filters, headers=headers, json=patch)
        if resp.status_code >= 400:
            raise SupabaseRestError(f"Supabase update failed: {resp.status_code} {resp.text}")
        return resp.json()

    async def delete(
        self,
        table: str,
        *,
        filters: dict[str, str],
    ) -> list[dict[str, Any]]:
        headers = self._headers()
        headers["Prefer"] = "return=representation"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.delete(f"{self._base}/{table}", params=filters, headers=headers)
        if resp.status_code >= 400:
            raise SupabaseRestError(f"Supabase delete failed: {resp.status_code} {resp.text}")
        return resp.json()

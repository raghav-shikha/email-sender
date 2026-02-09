from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx
from bs4 import BeautifulSoup


GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"


def _auth_headers(access_token: str) -> dict[str, str]:
    return {"authorization": f"Bearer {access_token}"}


@dataclass
class GmailProfile:
    email_address: str


async def get_profile(*, access_token: str) -> GmailProfile:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{GMAIL_API_BASE}/users/me/profile", headers=_auth_headers(access_token))
    resp.raise_for_status()
    j = resp.json()
    email_address = j.get("emailAddress")
    if not email_address:
        raise RuntimeError("Gmail profile missing emailAddress")
    return GmailProfile(email_address=email_address)


async def list_messages_page(
    *,
    access_token: str,
    query: str,
    max_results: int = 50,
    page_token: str | None = None,
) -> tuple[list[dict[str, str]], str | None]:
    params: dict[str, str] = {
        "q": query,
        "maxResults": str(max_results),
    }
    if page_token:
        params["pageToken"] = page_token

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{GMAIL_API_BASE}/users/me/messages",
            headers=_auth_headers(access_token),
            params=params,
        )
    resp.raise_for_status()
    j = resp.json()
    messages = j.get("messages", []) or []
    next_token = j.get("nextPageToken")
    return messages, next_token


async def list_message_ids(*, access_token: str, after_epoch_seconds: int, max_results: int = 50) -> list[dict[str, str]]:
    # Backward-compatible helper (single page).
    msgs, _ = await list_messages_page(access_token=access_token, query=f"after:{after_epoch_seconds}", max_results=max_results)
    return msgs


async def get_message_full(*, access_token: str, message_id: str) -> dict[str, Any]:
    params = {"format": "full"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{GMAIL_API_BASE}/users/me/messages/{message_id}",
            headers=_auth_headers(access_token),
            params=params,
        )
    resp.raise_for_status()
    return resp.json()


def _decode_b64url(data: str) -> bytes:
    # Gmail uses base64url without padding.
    padded = data + "=" * ((4 - (len(data) % 4)) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _extract_headers(msg: dict[str, Any]) -> dict[str, str]:
    payload = msg.get("payload") or {}
    headers = payload.get("headers") or []
    out: dict[str, str] = {}
    for h in headers:
        name = h.get("name")
        value = h.get("value")
        if isinstance(name, str) and isinstance(value, str):
            out[name.lower()] = value
    return out


def _walk_parts(part: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = [part]
    for child in part.get("parts") or []:
        if isinstance(child, dict):
            out.extend(_walk_parts(child))
    return out


def extract_body_text(msg: dict[str, Any]) -> str:
    payload = msg.get("payload") or {}
    all_parts = _walk_parts(payload) if isinstance(payload, dict) else []

    text_plain: list[str] = []
    text_html: list[str] = []

    for p in all_parts:
        mime = (p.get("mimeType") or "").lower()
        body = p.get("body") or {}
        data = body.get("data")
        if not data or not isinstance(data, str):
            continue
        try:
            decoded = _decode_b64url(data).decode("utf-8", errors="replace")
        except Exception:
            continue
        if mime == "text/plain":
            text_plain.append(decoded)
        elif mime == "text/html":
            text_html.append(decoded)

    if text_plain:
        return "\n".join(text_plain).strip()
    if text_html:
        soup = BeautifulSoup("\n".join(text_html), "html.parser")
        return soup.get_text("\n").strip()
    return ""


def parse_received_at(msg: dict[str, Any]) -> datetime | None:
    # Prefer internalDate (ms since epoch)
    internal = msg.get("internalDate")
    if isinstance(internal, str) and internal.isdigit():
        ms = int(internal)
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return None


def parse_from_email(from_header: str | None) -> str | None:
    if not from_header:
        return None
    # Rough extraction of email inside <...>
    m = re.search(r"<([^>]+)>", from_header)
    if m:
        return m.group(1).strip()
    return from_header.strip()


def build_raw_reply(
    *,
    to_email: str,
    subject: str,
    message_id: str | None,
    references: str | None,
    body_text: str,
) -> str:
    # Keep it simple: plain text email. Gmail will set From.
    subj = subject.strip()
    if not subj.lower().startswith("re:"):
        subj = f"Re: {subj}"

    lines = [
        f"To: {to_email}",
        f"Subject: {subj}",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
    ]
    if message_id:
        lines.append(f"In-Reply-To: {message_id}")
    if references:
        lines.append(f"References: {references}")
    elif message_id:
        lines.append(f"References: {message_id}")

    lines.append("")  # blank line between headers and body
    lines.append(body_text.rstrip() + "\n")
    return "\r\n".join(lines)


async def send_message(
    *,
    access_token: str,
    thread_id: str | None,
    raw_rfc822: str,
) -> dict[str, Any]:
    raw_b64 = base64.urlsafe_b64encode(raw_rfc822.encode("utf-8")).decode("ascii").rstrip("=")
    body: dict[str, Any] = {"raw": raw_b64}
    if thread_id:
        body["threadId"] = thread_id

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{GMAIL_API_BASE}/users/me/messages/send",
            headers={**_auth_headers(access_token), "content-type": "application/json"},
            json=body,
        )
    resp.raise_for_status()
    return resp.json()


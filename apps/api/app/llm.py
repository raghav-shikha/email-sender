from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import httpx
from jsonschema import Draft7Validator

from .config import get_settings


SchemaName = Literal["classification", "summary", "draft", "revise"]


class LLMError(RuntimeError):
    pass


@dataclass(frozen=True)
class ContextPack:
    brand_name: str | None = None
    brand_blurb: str | None = None
    products_info_json: Any | None = None
    policies_json: Any | None = None
    tone: str | None = None
    signature: str | None = None
    keywords_array: list[str] | None = None


@lru_cache(maxsize=1)
def _schema_dir() -> Path:
    """
    Prefer the monorepo shared schemas. Fall back to an app-local schemas dir
    if the API is deployed standalone.
    """
    here = Path(__file__).resolve()
    repo_root = here.parents[3] if len(here.parents) >= 4 else Path.cwd()
    candidates = [
        repo_root / "packages" / "shared" / "schemas",
        repo_root / "packages/shared/schemas",
        here.parent / "schemas",
    ]
    for p in candidates:
        if p.exists() and p.is_dir():
            return p
    raise RuntimeError("Could not locate JSON schemas directory (packages/shared/schemas)")


@lru_cache(maxsize=8)
def _load_schema(name: SchemaName) -> dict[str, Any]:
    filename_by_name = {
        "classification": "classification.schema.json",
        "summary": "summary.schema.json",
        "draft": "draft.schema.json",
        "revise": "revise.schema.json",
    }
    filename = filename_by_name[name]
    path = _schema_dir() / filename
    if not path.exists():
        raise RuntimeError(f"Missing schema file: {path}")
    return json.loads(path.read_text("utf-8"))


@lru_cache(maxsize=8)
def _validator(name: SchemaName) -> Draft7Validator:
    return Draft7Validator(_load_schema(name))


def _truncate(s: str | None, max_chars: int) -> str:
    if not s:
        return ""
    s = s.strip()
    if len(s) <= max_chars:
        return s
    return s[: max_chars - 1].rstrip() + "…"


def _json_dumps_compact(obj: Any, *, max_chars: int) -> str:
    try:
        s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    except Exception:
        s = str(obj)
    return _truncate(s, max_chars)


def _extract_json(text: str) -> Any:
    raw = text.strip()
    if not raw:
        raise ValueError("Empty LLM response")

    # Strip common markdown fences.
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)

    # Fast path.
    try:
        return json.loads(raw)
    except Exception:
        pass

    # Fallback: extract the first JSON object or array.
    m = re.search(r"(\{.*\}|\[.*\])", raw, flags=re.DOTALL)
    if not m:
        raise ValueError("Could not locate JSON in LLM response")
    return json.loads(m.group(1))


def _format_context(ctx: ContextPack) -> str:
    return json.dumps(
        {
            "brand_name": ctx.brand_name,
            "brand_blurb": ctx.brand_blurb,
            "tone": ctx.tone,
            "signature": ctx.signature,
            "keywords_array": ctx.keywords_array or [],
            # Keep these compact; can be large.
            "products_info_json": ctx.products_info_json,
            "policies_json": ctx.policies_json,
        },
        ensure_ascii=False,
        indent=2,
    )


async def _llm_text(*, system: str, user: str, temperature: float = 0.2) -> str:
    settings = get_settings()
    provider = (settings.llm_provider or "openai").strip().lower()

    if provider == "openai":
        if not settings.openai_api_key:
            raise LLMError("Missing OPENAI_API_KEY")
        model = settings.openai_model or "gpt-4o-mini"
        headers = {
            "authorization": f"Bearer {settings.openai_api_key}",
            "content-type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        if resp.status_code >= 400:
            raise LLMError(f"OpenAI error: {resp.status_code} {resp.text}")
        j = resp.json()
        return (j.get("choices") or [{}])[0].get("message", {}).get("content") or ""

    if provider == "gemini":
        if not settings.gemini_api_key:
            raise LLMError("Missing GEMINI_API_KEY")
        model = settings.gemini_model or "gemini-1.5-flash"
        # Keep it simple and portable: bake system instructions into the user prompt.
        prompt = system.strip() + "\n\n" + user.strip()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        params = {"key": settings.gemini_api_key}
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                # Hint strongly that we want raw JSON.
                "responseMimeType": "application/json",
            },
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, params=params, json=payload)
        if resp.status_code >= 400:
            raise LLMError(f"Gemini error: {resp.status_code} {resp.text}")
        j = resp.json()
        candidates = j.get("candidates") or []
        if not candidates:
            raise LLMError("Gemini returned no candidates")
        parts = (candidates[0].get("content") or {}).get("parts") or []
        texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
        return "".join(texts).strip()

    raise LLMError(f"Unsupported LLM_PROVIDER: {provider}")


async def _llm_json(*, name: SchemaName, system: str, user: str, temperature: float = 0.2) -> dict[str, Any]:
    schema = _load_schema(name)
    validator = _validator(name)

    base_user = (
        user.strip()
        + "\n\nReturn ONLY valid JSON matching this schema (no markdown fences, no extra keys):\n"
        + json.dumps(schema, ensure_ascii=False)
    )

    last_err: Exception | None = None
    for attempt in range(2):
        prompt = base_user
        if attempt == 1 and last_err is not None:
            prompt = (
                base_user
                + "\n\nYour previous output was invalid. Fix it. Error:\n"
                + _truncate(str(last_err), 600)
            )

        text = await _llm_text(system=system, user=prompt, temperature=temperature)
        try:
            data = _extract_json(text)
            if not isinstance(data, dict):
                raise ValueError("Expected JSON object")
            errors = sorted(validator.iter_errors(data), key=lambda e: e.path)
            if errors:
                raise ValueError("; ".join(e.message for e in errors[:3]))
            return data
        except Exception as e:
            last_err = e
            continue

    raise LLMError(f"Invalid JSON output for {name}: {last_err}")


def _system_prompt() -> str:
    return "\n".join(
        [
            "You are Inbox Copilot. You help a small business triage emails and draft replies.",
            "Follow the user's context pack (brand, policies, tone, signature).",
            "Be concise and factual. Never claim you performed actions you did not perform.",
            "Never include secrets or API keys. If information is missing, ask a clarifying question in the draft.",
        ]
    )


async def classify_email(
    *,
    ctx: ContextPack,
    from_email: str | None,
    subject: str | None,
    snippet: str | None,
    body_text: str | None,
) -> dict[str, Any]:
    user = "\n".join(
        [
            "Classify whether this email is business-relevant for the user's brand.",
            "Treat newsletters, automated notifications, and irrelevant promos as not relevant unless they match the context keywords.",
            "",
            "Context pack (JSON):",
            _format_context(ctx),
            "",
            "Email:",
            f"from: {_truncate(from_email, 200)}",
            f"subject: {_truncate(subject, 300)}",
            f"snippet: {_truncate(snippet, 500)}",
            "body:",
            _truncate(body_text, 8000),
        ]
    )
    return await _llm_json(name="classification", system=_system_prompt(), user=user, temperature=0.0)


async def summarize_email(
    *,
    ctx: ContextPack,
    from_email: str | None,
    subject: str | None,
    body_text: str | None,
) -> dict[str, Any]:
    user = "\n".join(
        [
            "Summarize the email for the user.",
            "Output short bullets. Focus on what the sender wants and what the user should do next.",
            "",
            "Context pack (JSON):",
            _format_context(ctx),
            "",
            "Email:",
            f"from: {_truncate(from_email, 200)}",
            f"subject: {_truncate(subject, 300)}",
            "body:",
            _truncate(body_text, 12000),
        ]
    )
    return await _llm_json(name="summary", system=_system_prompt(), user=user, temperature=0.2)


async def draft_reply(
    *,
    ctx: ContextPack,
    from_email: str | None,
    subject: str | None,
    body_text: str | None,
    summary_json: dict[str, Any],
) -> dict[str, Any]:
    tone = (ctx.tone or "").strip() or "concise, warm, professional"
    signature = (ctx.signature or "").strip()
    user = "\n".join(
        [
            "Draft a reply email in plain text.",
            f"Tone: {tone}",
            "If details are missing, include 1-3 concise clarifying questions.",
            "Do not include any subject line or email headers, only the email body.",
            "If a signature is provided, include it at the end verbatim.",
            "",
            "Context pack (compact):",
            _json_dumps_compact(
                {
                    "brand_name": ctx.brand_name,
                    "brand_blurb": ctx.brand_blurb,
                    "policies_json": ctx.policies_json,
                },
                max_chars=4000,
            ),
            "",
            "Email:",
            f"from: {_truncate(from_email, 200)}",
            f"subject: {_truncate(subject, 300)}",
            "body:",
            _truncate(body_text, 12000),
            "",
            "Computed summary (JSON):",
            _json_dumps_compact(summary_json, max_chars=2500),
            "",
            "Signature:",
            signature or "(none)",
        ]
    )
    return await _llm_json(name="draft", system=_system_prompt(), user=user, temperature=0.4)


async def revise_draft(
    *,
    ctx: ContextPack,
    current_draft_text: str,
    instruction: str,
) -> dict[str, Any]:
    tone = (ctx.tone or "").strip() or "concise, warm, professional"
    signature = (ctx.signature or "").strip()
    user = "\n".join(
        [
            "Revise the draft according to the instruction.",
            f"Tone: {tone}",
            "Keep the reply accurate and aligned with the brand context/policies.",
            "Return the full revised draft as plain text.",
            "",
            "Context pack (compact):",
            _json_dumps_compact(
                {
                    "brand_name": ctx.brand_name,
                    "brand_blurb": ctx.brand_blurb,
                    "policies_json": ctx.policies_json,
                },
                max_chars=4000,
            ),
            "",
            "Instruction:",
            _truncate(instruction, 1200),
            "",
            "Current draft:",
            current_draft_text.strip(),
            "",
            "Signature (if present, keep at end):",
            signature or "(none)",
        ]
    )
    return await _llm_json(name="revise", system=_system_prompt(), user=user, temperature=0.3)


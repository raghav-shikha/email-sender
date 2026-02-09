from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .auth import require_user_id_from_authorization_header, require_user_id_from_oauth_state
from .config import get_settings
from .crypto_utils import decrypt_text, encrypt_text
from .gmail_client import (
    build_raw_reply,
    extract_body_text,
    get_message_full,
    get_profile,
    list_message_ids,
    parse_from_email,
    parse_received_at,
    send_message,
    _extract_headers,
)
from .google_oauth import GMAIL_SCOPES, build_google_oauth_url, exchange_code_for_tokens, refresh_access_token
from .llm import ContextPack, LLMError, revise_draft as llm_revise_draft
from .models import ReviseRequest, ReviseResponse, SendReplyRequest, SendReplyResponse
from .processing import process_ingested_for_account
from .supabase_rest import SupabaseRest, SupabaseRestError


app = FastAPI(title="Inbox Copilot API")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_base_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_supabase() -> SupabaseRest:
    return SupabaseRest()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/oauth/google/start")
async def oauth_google_start(state: str) -> RedirectResponse:
    # Validate the state early (binds to a real user id).
    try:
        _ = require_user_id_from_oauth_state(state)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    url = build_google_oauth_url(state=state)
    return RedirectResponse(url=url, status_code=302)


@app.get("/oauth/google/callback")
async def oauth_google_callback(code: str, state: str, supabase: SupabaseRest = Depends(get_supabase)) -> RedirectResponse:
    settings = get_settings()
    try:
        user_id = require_user_id_from_oauth_state(state)
    except PermissionError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        token_res = await exchange_code_for_tokens(code=code)
        if not token_res.refresh_token:
            raise HTTPException(
                status_code=400,
                detail="Google did not return a refresh_token. Try disconnecting and reconnecting with prompt=consent.",
            )
        profile = await get_profile(access_token=token_res.access_token)
        refresh_token_encrypted = encrypt_text(token_res.refresh_token)

        scopes = []
        if token_res.scope:
            scopes = token_res.scope.split(" ")
        else:
            scopes = GMAIL_SCOPES

        await supabase.insert(
            "gmail_accounts",
            {
                "user_id": user_id,
                "google_email": profile.email_address,
                "refresh_token_encrypted": refresh_token_encrypted,
                "scopes": scopes,
                "status": "active",
                "error_message": None,
            },
            upsert=True,
            on_conflict="user_id,google_email",
        )
    except SupabaseRestError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    # Redirect back to web settings
    dest = settings.web_base_url.rstrip("/") + "/setup?gmail=connected"
    return RedirectResponse(url=dest, status_code=302)


@app.post("/cron/poll-gmail")
async def cron_poll_gmail(
    request: Request,
    x_cron_secret: str | None = Header(default=None, alias="X-CRON-SECRET"),
    supabase: SupabaseRest = Depends(get_supabase),
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.cron_secret:
        raise HTTPException(status_code=500, detail="Server missing CRON_SECRET")
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Load active accounts
    try:
        accounts = await supabase.select(
            "gmail_accounts",
            columns="id,user_id,google_email,refresh_token_encrypted,last_polled_at,status",
            filters={"status": "eq.active"},
            limit=200,
        )
    except SupabaseRestError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    now = datetime.now(tz=timezone.utc)
    total_new = 0
    per_account: list[dict[str, Any]] = []

    for acc in accounts:
        gmail_account_id = acc["id"]
        user_id = acc["user_id"]

        started_at = datetime.now(tz=timezone.utc)
        inserted = 0
        processed_counts: dict[str, Any] = {}
        errors: list[str] = []

        try:
            refresh_token = decrypt_text(acc["refresh_token_encrypted"])
            access_token = await refresh_access_token(refresh_token=refresh_token)

            last_polled_at = acc.get("last_polled_at")
            if last_polled_at:
                try:
                    after_dt = datetime.fromisoformat(last_polled_at.replace("Z", "+00:00"))
                except Exception:
                    after_dt = now - timedelta(hours=1)
            else:
                after_dt = now - timedelta(hours=1)

            msg_ids = await list_message_ids(access_token=access_token, after_epoch_seconds=int(after_dt.timestamp()))
            for msg in msg_ids or []:
                message_id = msg.get("id")
                if not message_id:
                    continue

                full = await get_message_full(access_token=access_token, message_id=message_id)
                headers = _extract_headers(full)
                from_email = parse_from_email(headers.get("from"))
                subject = headers.get("subject")
                snippet = full.get("snippet")
                received_at_dt = parse_received_at(full)
                body_text = extract_body_text(full)

                row = {
                    "user_id": user_id,
                    "gmail_account_id": gmail_account_id,
                    "gmail_message_id": full.get("id"),
                    "thread_id": full.get("threadId"),
                    "from_email": from_email,
                    "subject": subject,
                    "snippet": snippet,
                    "body_text": body_text,
                    "received_at": (received_at_dt or now).isoformat(),
                    "status": "ingested",
                }

                try:
                    res = await supabase.insert(
                        "email_items",
                        row,
                        upsert=True,
                        ignore_duplicates=True,
                        on_conflict="gmail_account_id,gmail_message_id",
                    )
                    inserted += len(res) if isinstance(res, list) else 0
                except SupabaseRestError as e:
                    # likely unique conflict or schema issue; record and continue
                    errors.append(str(e))

            # Process any newly ingested items (AI + push). Best-effort.
            try:
                proc = await process_ingested_for_account(
                    supabase=supabase,
                    user_id=user_id,
                    gmail_account_id=gmail_account_id,
                    max_items=25,
                )
                processed_counts = proc.get("counts") or {}
                errors.extend(proc.get("errors") or [])
            except Exception as e:
                errors.append(f"processing error: {e}")

            await supabase.update(
                "gmail_accounts",
                {"last_polled_at": now.isoformat(), "error_message": None},
                filters={"id": f"eq.{gmail_account_id}"},
            )
        except Exception as e:
            errors.append(str(e))
            try:
                await supabase.update(
                    "gmail_accounts",
                    {"status": "active", "error_message": str(e)},
                    filters={"id": f"eq.{gmail_account_id}"},
                )
            except Exception:
                pass

        finished_at = datetime.now(tz=timezone.utc)
        try:
            await supabase.insert(
                "processing_runs",
                {
                    "user_id": user_id,
                    "gmail_account_id": gmail_account_id,
                    "started_at": started_at.isoformat(),
                    "finished_at": finished_at.isoformat(),
                    "counts": {"inserted": inserted, **(processed_counts or {})},
                    "log_json": {"errors": errors},
                },
            )
        except Exception:
            pass

        total_new += inserted
        per_account.append(
            {
                "gmail_account_id": gmail_account_id,
                "user_id": user_id,
                "new": inserted,
                "processed": processed_counts.get("processed", 0) if processed_counts else 0,
                "relevant": processed_counts.get("relevant", 0) if processed_counts else 0,
                "pushed": processed_counts.get("pushed", 0) if processed_counts else 0,
                "failed": processed_counts.get("failed", 0) if processed_counts else 0,
                "errors": errors,
            }
        )

    return {"ok": True, "total_new": total_new, "per_account": per_account}


@app.post("/ai/revise", response_model=ReviseResponse)
async def ai_revise(
    body: ReviseRequest,
    authorization: str | None = Header(default=None),
    supabase: SupabaseRest = Depends(get_supabase),
) -> ReviseResponse:
    try:
        user_id = await require_user_id_from_authorization_header(authorization)
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    settings = get_settings()
    provider = (settings.llm_provider or "openai").strip().lower()
    if provider == "openai" and not settings.openai_api_key:
        raise HTTPException(status_code=501, detail="LLM not configured (set OPENAI_API_KEY)")
    if provider == "gemini" and not settings.gemini_api_key:
        raise HTTPException(status_code=501, detail="LLM not configured (set GEMINI_API_KEY)")

    # Ensure the email belongs to the user before revising/inserting.
    try:
        owned = await supabase.select(
            "email_items",
            columns="id",
            filters={"id": f"eq.{body.email_item_id}", "user_id": f"eq.{user_id}"},
            limit=1,
        )
        if not owned:
            raise HTTPException(status_code=404, detail="Email item not found")

        ctx_rows = await supabase.select(
            "context_packs",
            columns="brand_name,brand_blurb,products_info_json,policies_json,tone,signature,keywords_array",
            filters={"user_id": f"eq.{user_id}"},
            limit=1,
        )
        ctx = ContextPack()
        if ctx_rows:
            r = ctx_rows[0]
            ctx = ContextPack(
                brand_name=r.get("brand_name"),
                brand_blurb=r.get("brand_blurb"),
                products_info_json=r.get("products_info_json"),
                policies_json=r.get("policies_json"),
                tone=r.get("tone"),
                signature=r.get("signature"),
                keywords_array=r.get("keywords_array") or [],
            )
    except SupabaseRestError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    try:
        res = await llm_revise_draft(
            ctx=ctx,
            current_draft_text=body.current_draft_text,
            instruction=body.instruction,
        )
        revised = str(res.get("revised_draft") or "").strip()
        if not revised:
            raise HTTPException(status_code=500, detail="LLM returned empty revised draft")
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    # Store as a new draft version
    try:
        existing = await supabase.select(
            "reply_drafts",
            columns="version",
            filters={"email_item_id": f"eq.{body.email_item_id}"},
            order="version.desc",
            limit=1,
        )
        next_version = (existing[0]["version"] if existing else 0) + 1

        await supabase.insert(
            "reply_drafts",
            {
                "email_item_id": body.email_item_id,
                "version": next_version,
                "draft_text": revised,
                "instruction": body.instruction,
            },
        )
    except SupabaseRestError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return ReviseResponse(revised_draft=revised)


@app.post("/gmail/send-reply", response_model=SendReplyResponse)
async def gmail_send_reply(
    body: SendReplyRequest,
    authorization: str | None = Header(default=None),
    supabase: SupabaseRest = Depends(get_supabase),
) -> SendReplyResponse:
    try:
        user_id = await require_user_id_from_authorization_header(authorization)
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    # Load email item + gmail account
    try:
        items = await supabase.select(
            "email_items",
            columns="id,user_id,gmail_account_id,gmail_message_id,thread_id,from_email,subject,status",
            filters={"id": f"eq.{body.email_item_id}", "user_id": f"eq.{user_id}"},
            limit=1,
        )
        if not items:
            raise HTTPException(status_code=404, detail="Email item not found")
        item = items[0]

        accounts = await supabase.select(
            "gmail_accounts",
            columns="id,refresh_token_encrypted,status",
            filters={"id": f"eq.{item['gmail_account_id']}"},
            limit=1,
        )
        if not accounts:
            raise HTTPException(status_code=404, detail="Gmail account not found")
        acc = accounts[0]

        refresh_token = decrypt_text(acc["refresh_token_encrypted"])
        access_token = await refresh_access_token(refresh_token=refresh_token)

        # Fetch original message headers to thread properly.
        original = await get_message_full(access_token=access_token, message_id=item["gmail_message_id"])
        headers = _extract_headers(original)
        message_id_hdr = headers.get("message-id")
        references_hdr = headers.get("references")
        to_email = item.get("from_email") or parse_from_email(headers.get("from") or "")
        subject = item.get("subject") or (headers.get("subject") or "")
        if not to_email:
            raise HTTPException(status_code=400, detail="Missing recipient (from_email)")

        raw = build_raw_reply(
            to_email=to_email,
            subject=subject,
            message_id=message_id_hdr,
            references=references_hdr,
            body_text=body.final_draft_text,
        )
        sent = await send_message(access_token=access_token, thread_id=item.get("thread_id"), raw_rfc822=raw)

        await supabase.update(
            "email_items",
            {
                "status": "sent",
                "sent_message_id": sent.get("id"),
                "sent_at": datetime.now(tz=timezone.utc).isoformat(),
                "error_message": None,
            },
            filters={"id": f"eq.{body.email_item_id}", "user_id": f"eq.{user_id}"},
        )
    except SupabaseRestError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return SendReplyResponse(ok=True)

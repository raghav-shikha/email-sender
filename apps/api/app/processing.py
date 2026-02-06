from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import anyio
from pywebpush import WebPushException

from .llm import ContextPack, classify_email, draft_reply, summarize_email
from .push import send_web_push
from .supabase_rest import SupabaseRest, SupabaseRestError


def _keyword_prefilter(*, keywords: list[str], subject: str | None, snippet: str | None, body_text: str | None) -> bool:
    if not keywords:
        return True
    hay = "\n".join([subject or "", snippet or "", body_text or ""]).lower()
    for kw in keywords:
        k = (kw or "").strip().lower()
        if not k:
            continue
        if k in hay:
            return True
    return False


def _one_line_summary(summary_json: dict[str, Any]) -> str:
    bullets = summary_json.get("summary_bullets")
    if isinstance(bullets, list) and bullets and isinstance(bullets[0], str):
        s = bullets[0].strip()
        if s:
            return s
    nxt = summary_json.get("suggested_next_step")
    if isinstance(nxt, str) and nxt.strip():
        return nxt.strip()
    return "New relevant email"


async def _send_push_to_user(
    *,
    supabase: SupabaseRest,
    user_id: str,
    email_item_id: str,
    from_email: str | None,
    one_line: str,
) -> int:
    try:
        subs = await supabase.select(
            "push_subscriptions",
            columns="id,endpoint,p256dh,auth",
            filters={"user_id": f"eq.{user_id}"},
            limit=100,
        )
    except SupabaseRestError:
        return 0

    payload = {
        "email_item_id": email_item_id,
        "title": from_email or "Inbox Copilot",
        "body": one_line[:180],
        "url": f"/inbox/{email_item_id}",
    }

    pushed = 0
    for sub in subs:
        sub_id = sub.get("id")
        endpoint = sub.get("endpoint")
        p256dh = sub.get("p256dh")
        auth = sub.get("auth")
        if not endpoint or not p256dh or not auth:
            continue

        subscription_info = {"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}}
        try:
            await anyio.to_thread.run_sync(send_web_push, subscription=subscription_info, payload=payload)
            pushed += 1
            if sub_id:
                try:
                    await supabase.update(
                        "push_subscriptions",
                        {"last_used_at": datetime.now(tz=timezone.utc).isoformat()},
                        filters={"id": f"eq.{sub_id}"},
                    )
                except Exception:
                    pass
        except WebPushException as e:
            # Drop expired subscriptions to keep the table clean.
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (404, 410) and sub_id:
                try:
                    await supabase.delete("push_subscriptions", filters={"id": f"eq.{sub_id}"})
                except Exception:
                    pass
        except Exception:
            continue

    return pushed


async def process_ingested_for_account(
    *,
    supabase: SupabaseRest,
    user_id: str,
    gmail_account_id: str,
    max_items: int = 25,
) -> dict[str, Any]:
    """
    Processes ingested email_items: keyword prefilter -> LLM classify -> (if relevant) summary + draft + push.
    Returns aggregate counts and a list of processing errors.
    """
    counts = {
        "processed": 0,
        "relevant": 0,
        "pushed": 0,
        "failed": 0,
        "prefiltered_out": 0,
    }
    errors: list[str] = []

    # Load context pack (optional).
    ctx = ContextPack()
    try:
        ctx_rows = await supabase.select(
            "context_packs",
            columns="brand_name,brand_blurb,products_info_json,policies_json,tone,signature,keywords_array",
            filters={"user_id": f"eq.{user_id}"},
            limit=1,
        )
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
    except Exception:
        pass

    # Fetch ingested items (oldest first).
    try:
        items = await supabase.select(
            "email_items",
            columns="id,from_email,subject,snippet,body_text,status",
            filters={"gmail_account_id": f"eq.{gmail_account_id}", "status": "eq.ingested"},
            order="received_at.asc",
            limit=max_items,
        )
    except SupabaseRestError as e:
        return {"counts": counts, "errors": [str(e)]}

    for item in items:
        email_item_id = item.get("id")
        if not email_item_id:
            continue

        from_email = item.get("from_email")
        subject = item.get("subject")
        snippet = item.get("snippet")
        body_text = item.get("body_text")

        patch: dict[str, Any] = {"error_message": None}
        is_relevant = False
        try:
            prefilter_hit = _keyword_prefilter(
                keywords=ctx.keywords_array or [],
                subject=subject,
                snippet=snippet,
                body_text=body_text,
            )
            if not prefilter_hit:
                counts["prefiltered_out"] += 1
                patch.update(
                    {
                        "is_relevant": False,
                        "confidence": 0.0,
                        "category": "prefiltered_out",
                        "reason": "No keyword match in subject/snippet/body.",
                        "summary_json": None,
                        "status": "processed",
                    }
                )
                await supabase.update("email_items", patch, filters={"id": f"eq.{email_item_id}"})
                counts["processed"] += 1
                continue

            classification = await classify_email(
                ctx=ctx,
                from_email=from_email,
                subject=subject,
                snippet=snippet,
                body_text=body_text,
            )
            patch.update(
                {
                    "is_relevant": bool(classification.get("is_relevant")),
                    "confidence": float(classification.get("confidence", 0.0)),
                    "category": str(classification.get("category") or "unknown"),
                    "reason": str(classification.get("reason") or ""),
                }
            )

            is_relevant = bool(classification.get("is_relevant"))
            if not is_relevant:
                patch.update({"summary_json": None, "status": "processed"})
                await supabase.update("email_items", patch, filters={"id": f"eq.{email_item_id}"})
                counts["processed"] += 1
                continue

            summary = await summarize_email(ctx=ctx, from_email=from_email, subject=subject, body_text=body_text)
            draft = await draft_reply(
                ctx=ctx,
                from_email=from_email,
                subject=subject,
                body_text=body_text,
                summary_json=summary,
            )

            # Insert draft version (append-only).
            existing = await supabase.select(
                "reply_drafts",
                columns="version",
                filters={"email_item_id": f"eq.{email_item_id}"},
                order="version.desc",
                limit=1,
            )
            next_version = (existing[0]["version"] if existing else 0) + 1
            await supabase.insert(
                "reply_drafts",
                {
                    "email_item_id": email_item_id,
                    "version": next_version,
                    "draft_text": str(draft.get("draft_text") or "").strip(),
                    "instruction": None,
                },
            )

            patch.update({"summary_json": summary, "status": "needs_review"})
            await supabase.update("email_items", patch, filters={"id": f"eq.{email_item_id}"})

            counts["processed"] += 1
            counts["relevant"] += 1

            # Best-effort push (do not fail item if push fails).
            pushed = await _send_push_to_user(
                supabase=supabase,
                user_id=user_id,
                email_item_id=email_item_id,
                from_email=from_email,
                one_line=_one_line_summary(summary),
            )
            counts["pushed"] += pushed
        except Exception as e:
            counts["failed"] += 1
            msg = str(e)
            errors.append(f"{email_item_id}: {msg}")
            patch.update({"status": "failed", "error_message": msg})
            try:
                await supabase.update("email_items", patch, filters={"id": f"eq.{email_item_id}"})
            except Exception:
                pass

    return {"counts": counts, "errors": errors}


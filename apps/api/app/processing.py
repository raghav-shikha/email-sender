from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import anyio
from pywebpush import WebPushException

from .buckets import ensure_default_buckets, route_to_bucket
from .llm import ContextPack, classify_email, draft_reply, summarize_email
from .push import send_web_push
from .supabase_rest import SupabaseRest, SupabaseRestError


def _one_line_summary(*, summary_json: dict[str, Any] | None, subject: str | None, snippet: str | None) -> str:
    if summary_json and isinstance(summary_json, dict):
        bullets = summary_json.get("summary_bullets")
        if isinstance(bullets, list) and bullets and isinstance(bullets[0], str):
            s = bullets[0].strip()
            if s:
                return s
        nxt = summary_json.get("suggested_next_step")
        if isinstance(nxt, str) and nxt.strip():
            return nxt.strip()

    if subject and subject.strip():
        return subject.strip()
    if snippet and snippet.strip():
        return snippet.strip()
    return "New email"


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
    """Process ingested emails into: bucket -> classify -> (optional) summary/draft -> (optional) push."""

    counts: dict[str, Any] = {
        "processed": 0,
        "relevant": 0,
        "pushed": 0,
        "failed": 0,
        "ignored": 0,
    }
    errors: list[str] = []

    # Ensure buckets exist (seed defaults for new users).
    buckets = await ensure_default_buckets(supabase=supabase, user_id=user_id)

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

        bucket = route_to_bucket(
            buckets=buckets,
            from_email=from_email,
            subject=subject,
            snippet=snippet,
            body_text=body_text,
        )
        bucket_id = bucket.get("id") if isinstance(bucket, dict) else None
        actions = (bucket.get("actions") if isinstance(bucket, dict) else None) or {}

        patch: dict[str, Any] = {
            "error_message": None,
            "bucket_id": bucket_id,
        }

        try:
            # Ignore/noise buckets: store it, but don't spend tokens or send pushes.
            if bool(actions.get("ignore")):
                counts["ignored"] += 1
                patch.update(
                    {
                        "is_relevant": False,
                        "confidence": 0.0,
                        "category": "ignored",
                        "reason": "Routed to FYI bucket.",
                        "summary_json": None,
                        "status": "processed",
                    }
                )
                await supabase.update("email_items", patch, filters={"id": f"eq.{email_item_id}"})
                counts["processed"] += 1
                continue

            # LLM classification (per bucket). Defaults to on.
            if bool(actions.get("llm_classify", True)):
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
            else:
                patch.update(
                    {
                        "is_relevant": True,
                        "confidence": 1.0,
                        "category": "bucket_routed",
                        "reason": "Bucket rule match.",
                    }
                )

            is_relevant = bool(patch.get("is_relevant"))
            confidence = float(patch.get("confidence") or 0.0)

            if not is_relevant:
                patch.update({"summary_json": None, "status": "processed"})
                await supabase.update("email_items", patch, filters={"id": f"eq.{email_item_id}"})
                counts["processed"] += 1
                continue

            summary: dict[str, Any] | None = None
            if bool(actions.get("llm_summarize", True)):
                summary = await summarize_email(ctx=ctx, from_email=from_email, subject=subject, body_text=body_text)
                patch["summary_json"] = summary

            # Draft can be gated by confidence (useful for the fallback bucket).
            draft_min_conf = actions.get("draft_min_confidence")
            if draft_min_conf is None:
                draft_min_conf = 0.0
            try:
                draft_min_conf_f = float(draft_min_conf)
            except Exception:
                draft_min_conf_f = 0.0

            did_draft = False
            if bool(actions.get("llm_draft", True)) and confidence >= draft_min_conf_f:
                draft = await draft_reply(
                    ctx=ctx,
                    from_email=from_email,
                    subject=subject,
                    body_text=body_text,
                    summary_json=summary
                    or {
                        "summary_bullets": ["(no summary)"],
                        "what_they_want": ["(unknown)"],
                        "suggested_next_step": "Reply if needed.",
                    },
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
                did_draft = True

            patch.update({"status": "needs_review"})
            await supabase.update("email_items", patch, filters={"id": f"eq.{email_item_id}"})

            counts["processed"] += 1
            counts["relevant"] += 1

            # Best-effort push (do not fail item if push fails).
            push_min_conf = actions.get("push_min_confidence")
            if push_min_conf is None:
                push_min_conf = 0.0
            try:
                push_min_conf_f = float(push_min_conf)
            except Exception:
                push_min_conf_f = 0.0

            if bool(actions.get("push", True)) and confidence >= push_min_conf_f:
                pushed = await _send_push_to_user(
                    supabase=supabase,
                    user_id=user_id,
                    email_item_id=email_item_id,
                    from_email=from_email,
                    one_line=_one_line_summary(summary_json=summary, subject=subject, snippet=snippet),
                )
                counts["pushed"] += pushed

            # If we created no draft and we also didn't summarize, keep the status accurate.
            if not did_draft and not summary:
                try:
                    await supabase.update(
                        "email_items",
                        {"status": "processed"},
                        filters={"id": f"eq.{email_item_id}"},
                    )
                except Exception:
                    pass

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

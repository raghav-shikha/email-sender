from __future__ import annotations

from typing import Any

from .supabase_rest import SupabaseRest, SupabaseRestError


# Default buckets are opinionated for (a) solo founders and (b) small startup operators.
# The goal is to catch the 80/20 of "stuff you must act on" while suppressing newsletter noise.
DEFAULT_BUCKETS: list[dict[str, Any]] = [
    {
        "slug": "priority",
        "name": "Priority",
        "description": "Time-sensitive, high-stakes messages.",
        "priority": 10,
        "is_enabled": True,
        "matchers": {
            "keywords": [
                "urgent",
                "asap",
                "action required",
                "deadline",
                "past due",
                "overdue",
                "payment failed",
                "account suspended",
                "security alert",
                "verify your",
                "reset your password",
            ],
            "sender_emails": [],
            "sender_domains": [],
            "exclude_keywords": [],
            "exclude_sender_emails": [],
            "exclude_sender_domains": [],
        },
        "actions": {
            "ignore": False,
            "llm_classify": True,
            "llm_summarize": True,
            "llm_draft": True,
            "push": True,
        },
    },
    {
        "slug": "sales",
        "name": "Sales",
        "description": "Leads, pricing, demos, and revenue conversations.",
        "priority": 20,
        "is_enabled": True,
        "matchers": {
            "keywords": [
                "pricing",
                "price",
                "quote",
                "quotation",
                "demo",
                "trial",
                "pilot",
                "poc",
                "proposal",
                "rfp",
                "rfq",
                "buy",
                "purchase",
                "subscription",
                "enterprise",
                "licensing",
                "integration",
                "partnership",
            ],
            "sender_emails": [],
            "sender_domains": [],
            "exclude_keywords": ["unsubscribe"],
            "exclude_sender_emails": [],
            "exclude_sender_domains": [],
        },
        "actions": {
            "ignore": False,
            "llm_classify": True,
            "llm_summarize": True,
            "llm_draft": True,
            "push": True,
        },
    },
    {
        "slug": "support",
        "name": "Customer",
        "description": "Customer support, bugs, issues, cancellations.",
        "priority": 30,
        "is_enabled": True,
        "matchers": {
            "keywords": [
                "support",
                "help",
                "issue",
                "bug",
                "error",
                "broken",
                "failed",
                "can't",
                "cannot",
                "refund",
                "cancel",
                "cancellation",
                "complaint",
            ],
            "sender_emails": [],
            "sender_domains": [],
            "exclude_keywords": ["unsubscribe"],
            "exclude_sender_emails": [],
            "exclude_sender_domains": [],
        },
        "actions": {
            "ignore": False,
            "llm_classify": True,
            "llm_summarize": True,
            "llm_draft": True,
            "push": True,
        },
    },
    {
        "slug": "hiring",
        "name": "Hiring",
        "description": "Candidates, recruiters, interviews, hiring logistics.",
        "priority": 40,
        "is_enabled": True,
        "matchers": {
            "keywords": [
                "application",
                "apply",
                "resume",
                "cv",
                "candidate",
                "interview",
                "recruiter",
                "hiring",
                "role",
                "position",
                "offer",
                "salary",
            ],
            "sender_emails": [],
            "sender_domains": [],
            "exclude_keywords": ["unsubscribe"],
            "exclude_sender_emails": [],
            "exclude_sender_domains": [],
        },
        "actions": {
            "ignore": False,
            "llm_classify": True,
            "llm_summarize": True,
            "llm_draft": True,
            "push": True,
        },
    },
    {
        "slug": "finance",
        "name": "Finance",
        "description": "Invoices, receipts, payments, renewals.",
        "priority": 50,
        "is_enabled": True,
        "matchers": {
            "keywords": [
                "invoice",
                "billing",
                "payment",
                "receipt",
                "charged",
                "charge",
                "renewal",
                "tax",
                "vat",
                "gst",
                "wire",
                "bank",
                "payout",
                "statement",
                "balance",
                "past due",
                "overdue",
            ],
            "sender_emails": [],
            "sender_domains": [],
            "exclude_keywords": ["unsubscribe"],
            "exclude_sender_emails": [],
            "exclude_sender_domains": [],
        },
        "actions": {
            "ignore": False,
            "llm_classify": True,
            "llm_summarize": True,
            "llm_draft": False,
            "push": True,
        },
    },
    {
        "slug": "ops",
        "name": "Ops",
        "description": "Contracts, legal, security, vendor questionnaires.",
        "priority": 60,
        "is_enabled": True,
        "matchers": {
            "keywords": [
                "contract",
                "nda",
                "msa",
                "dpa",
                "sow",
                "legal",
                "terms",
                "privacy",
                "security",
                "soc2",
                "soc 2",
                "iso",
                "gdpr",
                "data processing",
                "audit",
                "compliance",
                "questionnaire",
            ],
            "sender_emails": [],
            "sender_domains": [],
            "exclude_keywords": ["unsubscribe"],
            "exclude_sender_emails": [],
            "exclude_sender_domains": [],
        },
        "actions": {
            "ignore": False,
            "llm_classify": True,
            "llm_summarize": True,
            "llm_draft": False,
            "push": True,
        },
    },
    {
        "slug": "fyi",
        "name": "FYI",
        "description": "Newsletters and low-signal updates.",
        "priority": 90,
        "is_enabled": True,
        "matchers": {
            "keywords": [
                "unsubscribe",
                "newsletter",
                "digest",
                "view in browser",
                "no-reply",
                "noreply",
                "do not reply",
            ],
            "sender_emails": [],
            "sender_domains": [],
            "exclude_keywords": [],
            "exclude_sender_emails": [],
            "exclude_sender_domains": [],
        },
        "actions": {
            "ignore": True,
            "llm_classify": False,
            "llm_summarize": False,
            "llm_draft": False,
            "push": False,
        },
    },
    {
        "slug": "other",
        "name": "Other",
        "description": "Everything else. We only push/draft when confidence is high.",
        "priority": 1000,
        "is_enabled": True,
        "matchers": {
            "keywords": [],
            "sender_emails": [],
            "sender_domains": [],
            "exclude_keywords": [],
            "exclude_sender_emails": [],
            "exclude_sender_domains": [],
        },
        "actions": {
            "ignore": False,
            "llm_classify": True,
            "llm_summarize": True,
            "llm_draft": True,
            "push": True,
            "push_min_confidence": 0.85,
            "draft_min_confidence": 0.7,
        },
    },
]


def _as_str_list(x: Any) -> list[str]:
    if not x:
        return []
    if isinstance(x, list):
        return [str(v).strip() for v in x if str(v).strip()]
    return [str(x).strip()] if str(x).strip() else []


def _domain_matches(*, domain: str, rule_domain: str) -> bool:
    d = (domain or "").lower().strip()
    r = (rule_domain or "").lower().strip().lstrip("@")
    if not d or not r:
        return False
    return d == r or d.endswith("." + r)


def bucket_matches(
    *,
    bucket: dict[str, Any],
    from_email: str | None,
    subject: str | None,
    snippet: str | None,
    body_text: str | None,
) -> bool:
    matchers = bucket.get("matchers") or {}

    fe = (from_email or "").strip().lower()
    domain = fe.split("@", 1)[1] if "@" in fe else ""
    hay = "\n".join([subject or "", snippet or "", body_text or ""]).lower()

    exclude_sender_emails = set(_as_str_list(matchers.get("exclude_sender_emails")))
    exclude_sender_domains = _as_str_list(matchers.get("exclude_sender_domains"))
    exclude_keywords = _as_str_list(matchers.get("exclude_keywords"))

    if fe and fe in exclude_sender_emails:
        return False
    if domain and any(_domain_matches(domain=domain, rule_domain=d) for d in exclude_sender_domains):
        return False
    if any(kw.lower() in hay for kw in exclude_keywords if kw):
        return False

    sender_emails = set(s.lower() for s in _as_str_list(matchers.get("sender_emails")))
    sender_domains = _as_str_list(matchers.get("sender_domains"))
    keywords = _as_str_list(matchers.get("keywords"))

    sender_match = bool(fe and fe in sender_emails) or bool(
        domain and any(_domain_matches(domain=domain, rule_domain=d) for d in sender_domains)
    )
    keyword_match = any(kw.lower() in hay for kw in keywords if kw)

    if not sender_emails and not sender_domains and not keywords:
        return False

    return sender_match or keyword_match


def route_to_bucket(
    *,
    buckets: list[dict[str, Any]],
    from_email: str | None,
    subject: str | None,
    snippet: str | None,
    body_text: str | None,
) -> dict[str, Any] | None:
    """Returns the highest-priority matching bucket, else a fallback bucket (slug=other) if present."""
    fallback: dict[str, Any] | None = None

    for b in sorted(buckets, key=lambda x: int(x.get("priority") or 100)):
        if not bool(b.get("is_enabled", True)):
            continue
        slug = str(b.get("slug") or "").strip().lower()
        if slug == "other":
            fallback = b
            continue
        if bucket_matches(bucket=b, from_email=from_email, subject=subject, snippet=snippet, body_text=body_text):
            return b

    return fallback


async def ensure_default_context_pack(*, supabase: SupabaseRest, user_id: str) -> None:
    try:
        rows = await supabase.select("context_packs", columns="user_id", filters={"user_id": f"eq.{user_id}"}, limit=1)
        if rows:
            return
        await supabase.insert("context_packs", {"user_id": user_id}, upsert=True, on_conflict="user_id")
    except Exception:
        # Non-critical.
        return


async def ensure_default_buckets(*, supabase: SupabaseRest, user_id: str) -> list[dict[str, Any]]:
    """Ensure a user has the default bucket set. Returns current buckets (ordered by priority)."""
    try:
        existing = await supabase.select("email_buckets", columns="id", filters={"user_id": f"eq.{user_id}"}, limit=1)
    except SupabaseRestError:
        existing = []

    if not existing:
        rows = []
        for b in DEFAULT_BUCKETS:
            rows.append(
                {
                    "user_id": user_id,
                    "slug": b["slug"],
                    "name": b["name"],
                    "description": b.get("description"),
                    "priority": b.get("priority", 100),
                    "is_enabled": b.get("is_enabled", True),
                    "matchers": b.get("matchers", {}),
                    "actions": b.get("actions", {}),
                }
            )

        try:
            await supabase.insert("email_buckets", rows)
        except SupabaseRestError:
            # Best-effort. If a race inserted them, we'll just return what's there.
            pass

    try:
        return await supabase.select(
            "email_buckets",
            columns="id,slug,name,description,priority,is_enabled,matchers,actions",
            filters={"user_id": f"eq.{user_id}"},
            order="priority.asc",
            limit=100,
        )
    except SupabaseRestError:
        return []

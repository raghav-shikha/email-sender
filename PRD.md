# Inbox Copilot (PWA) -- Product Requirements Document

Updated PRD: "Inbox Copilot" PWA (Gmail -> AI Summary/Draft -> Push -> Review/Send)

## 0) One-liner

A home-screen PWA that connects to a user's Gmail, periodically checks for new emails, filters for "my business emails," generates summary + suggested reply, sends a push notification, and lets the user approve/edit and reply inside the app.

## 1) Goals (MVP)

- Works as a PWA installable to phone home screen; supports push notifications.
- User connects Gmail via OAuth (offline access).
- Backend checks Gmail on a schedule (hourly cron).
- Detects "relevant" emails (business-related) and generates:
  - structured summary
  - suggested reply draft (in user-defined tone)
- Sends push notification for each relevant email.
- In-app UI supports:
  - view summary + draft
  - revise draft with instructions
  - manual approval gate
  - send reply via Gmail API (threaded)

## 2) Non-goals (MVP)

- No auto-send without explicit user confirmation.
- No WhatsApp/Telegram integration.
- No multi-provider (Outlook) support.
- No team/shared inbox.

## 3) Public "Anyone can use it" requirements (OAuth / Launch reality)

### 3.1 Audience + Publishing status

To support anyone with a Google account, your OAuth project must be:

- User type = External (available to any Google Account)
- Publishing status = In production (after clicking "Publish app")

If you leave it in Testing:

- capped to up to 100 test users
- user authorizations (and refresh tokens) expire after 7 days

### 3.2 Scope verification / Security assessment risk

Gmail scopes are categorized as Sensitive or Restricted.

Sensitive/Restricted scopes require additional verification and may require a security assessment, especially if restricted data is accessed "from or through a server."

Avoid the restricted scope `https://mail.google.com/` unless absolutely required (it's explicitly marked "Restricted").

Choose the least-privilege scopes.

### 3.3 Unverified app screen + user caps

If you're "In production" but not verified for requested sensitive/restricted scopes, users may see the unverified app warning and you can hit user caps.

## 4) Trigger strategy

MVP trigger: hourly polling

- A cron job runs every hour and checks each connected inbox for new messages.
- Simpler + fewer moving parts.

Important hosting note: Vercel's Hobby plan cron jobs can only run once per day; hourly requires upgrading or using an external scheduler.

V2 trigger: near real-time Gmail push

- Add Gmail "watch" -> Pub/Sub -> webhook (more infra). (Keep as later milestone.)

## 5) Push notifications (PWA constraints)

- Android/Desktop: straightforward web push.
- iOS: web push works for iOS/iPadOS 16.4+, but users must add the app to Home Screen and open it from there to subscribe.

UX must include an iOS "Add to Home Screen" guide.

## 6) Core user flows

### 6.1 Onboarding

- Sign in / create account
- Connect Gmail (OAuth, offline access)
- Create "Context Pack" (brand/product context + tone + signature)
- Enable push notifications
- Done -> status screen "Monitoring hourly"

### 6.2 New relevant email

- Cron finds new email
- Classify relevance + category
- Generate summary + suggested reply
- Store results
- Send push: "New business email from X -- 1-line summary"
- Tapping push deep-links to email detail view

### 6.3 Review & send

- Show summary + "what they want" + draft
- User can edit draft or give instruction ("make it shorter, ask for MOQ")
- User taps Approve & Send
- Reply sent in same Gmail thread; status becomes Sent

## 7) Functional requirements

### 7.1 Auth

- Email/password or Google sign-in (your choice).
- Must support multi-device login.

### 7.2 Gmail connection

- OAuth with offline access -> store refresh token securely.
- Store granted scopes + status.

### 7.3 Email ingestion (polling)

- Every run: fetch new messages since last run; dedupe by Gmail message ID.

### 7.4 Classifier

- Rule-based prefilter + LLM classifier
- Output: `is_relevant`, `confidence`, `category`, `reason`

### 7.5 Summarizer

Output JSON:

- `summary_bullets[]`
- `what_they_want[]`
- `suggested_next_step`
- `flags[]` (optional)

### 7.6 Draft reply generator

Uses email + context pack + chosen tone + signature.

Returns `draft_text` + `clarifying_questions[]` optional.

### 7.7 Instruction-based revise

Input: `current_draft` + `instruction`

Output: `revised_draft`

Store versions.

### 7.8 Send reply

- Reply in correct thread using threadId/message headers.
- Approval gate required.

### 7.9 Push notifications

- Store push subscriptions per user/device.
- When a relevant email is processed, send push to all active subs.

## 8) Data model (Supabase Postgres)

### Tables

- `users`
- `gmail_accounts` (encrypted refresh token, scopes, last_polled_at, status)
- `email_items` (gmail_message_id, thread_id, from, subject, snippet, received_at, relevance, summary_json, status)
- `reply_drafts` (email_item_id, version, draft_text, instruction, created_at)
- `context_packs` (brand info, policies, tone, signature, keywords)
- `push_subscriptions` (endpoint, p256dh, auth, device label, last_used_at)
- `processing_runs` (logs per poll)

### Encryption

Encrypt refresh tokens at rest (app-level encryption with server key) + never expose to client.

## 9) API surface (suggested)

Next.js (frontend + thin API)

- `POST /api/push/subscribe` (store subscription in DB)
- `POST /api/push/unsubscribe`
- `GET /api/me`

FastAPI (backend/worker)

- `GET /oauth/google/start`
- `GET /oauth/google/callback`
- `POST /cron/poll-gmail` (secured with cron secret)
- `POST /ai/classify`
- `POST /ai/summarize`
- `POST /ai/draft`
- `POST /ai/revise`
- `POST /gmail/send-reply`

(You can collapse AI endpoints into internal functions; keep them separate only if helpful.)

## 10) Hosting / scheduling options

Recommended MVP approach

- Host Next.js on Vercel.
- Host FastAPI on Render/Fly/VPS (always-on).
- Use external scheduler (or Vercel Pro cron) to call `POST /cron/poll-gmail`.

Remember: Vercel Hobby cron can't run hourly.

## 11) Milestones

- PWA shell + install + push subscribe flow (store subscriptions)
- Gmail OAuth connect + token storage (encrypted)
- Hourly polling endpoint + dedupe + store basic emails
- Classify + summarize + draft + push notification
- Draft revise + versioning
- Send reply in thread + sent status
- Settings UI (context pack, keywords, disconnect Gmail)
- Admin/debug logs & retries

---

# Build Prompt (Implementation Spec)

You are building "Inbox Copilot", a PWA web app that connects to a user's Gmail, polls for new emails hourly, classifies which ones are business-relevant, generates a structured summary + suggested reply, sends a web push notification, and lets the user approve/edit and send the reply from inside the app.

## Stack / Architecture

- Frontend: Next.js (App Router) + TypeScript + Tailwind
- DB/Auth: Supabase Postgres (use supabase-js on server; implement RLS if time)
- Backend worker/API: FastAPI (Python) deployed separately
- Scheduling: external cron hits FastAPI endpoint `POST /cron/poll-gmail` every hour
- Push: Web Push using VAPID; store PushSubscription in Supabase; send push from FastAPI
- Gmail: Google OAuth (offline access) + Gmail API read + send
- LLM: implement provider interface (OpenAI or Gemini) with env var keys; keep prompts + JSON schema validation

## Critical product constraints

- Manual approval gate: NEVER send emails automatically.
- Tokens: store `refresh_token` encrypted at rest (app-level encryption key from env).
- Minimize OAuth scopes; do NOT request `https://mail.google.com/` unless required.
- iOS push requires Add to Home Screen. Provide onboarding UI for iOS.

## Repo layout (monorepo)

- `/apps/web` (Next.js)
- `/apps/api` (FastAPI)
- `/packages/shared` (shared types, JSON schemas)

## Functional requirements

### 1) PWA + Push

- `manifest.json`, service worker, installability
- UI to enable push notifications (button)
- Next API route `POST /api/push/subscribe` saves subscription to Supabase table `push_subscriptions`
- Notification click opens `/inbox/[email_item_id]`

### 2) Gmail OAuth connect

FastAPI endpoints:

- `GET /oauth/google/start` -> redirect to Google consent
- `GET /oauth/google/callback` -> exchange code, get `refresh_token`, store in Supabase `gmail_accounts`

Use state param to bind to logged-in user. Implement a simple session:

- Use Supabase auth OR implement JWT cookie session in Next.
- For MVP: implement Supabase email/password auth in web; user must be logged in to connect Gmail.
- Gmail connect links the `gmail_accounts` row to the Supabase `user_id`.

### 3) Hourly polling

- FastAPI `POST /cron/poll-gmail` (secured with header `X-CRON-SECRET`)
- For each active `gmail_account`:
  - refresh access token
  - query Gmail for messages newer than `last_polled_at`
  - dedupe by `gmail_message_id`
  - fetch message content (prefer `text/plain`; fallback `html->text`)
  - store in `email_items`

### 4) AI processing

For each new email:

- rule-based prefilter (keywords from user `context_pack`)
- LLM classify -> `is_relevant`, `confidence`, `category`, `reason`
- if relevant:
  - LLM summarize -> `summary_json`
  - LLM draft reply -> `draft_text`
  - store `reply_drafts` `version=1` and `email_items` fields
  - send web push notification to all `push_subscriptions` for user

### 5) Web UI

- `/inbox` page with tabs: Relevant, All, Sent, Needs review
- `/inbox/[id]` detail view:
  - show summary, what_they_want, suggested_next_step
  - editable draft textarea
  - instruction box + "Revise draft" button (calls FastAPI `/ai/revise` via Next server action or route)
  - "Approve & Send" button (calls FastAPI `/gmail/send-reply`)
  - status display (processed/sent/failed)

### 6) Send reply

- FastAPI `POST /gmail/send-reply`:
  - takes `email_item_id`, `final_draft_text`
  - sends reply into correct Gmail thread (`threadId` + headers)
  - updates `email_items.status = sent` and stores sent message id + timestamp

## Data model (Supabase)

- users (supabase auth)
- gmail_accounts: `id`, `user_id`, `google_email`, `refresh_token_encrypted`, `scopes`, `last_polled_at`, `status`, `error_message`
- email_items: `id`, `user_id`, `gmail_account_id`, `gmail_message_id` (unique), `thread_id`, `from_email`, `subject`, `snippet`, `body_text`, `received_at`, `is_relevant`, `confidence`, `category`, `reason`, `summary_json`, `status`
- reply_drafts: `id`, `email_item_id`, `version`, `draft_text`, `instruction`, `created_at`
- context_packs: `user_id`, `brand_name`, `brand_blurb`, `products_info_json`, `policies_json`, `tone`, `signature`, `keywords_array`
- push_subscriptions: `id`, `user_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`, `created_at`, `last_used_at`
- processing_runs: `id`, `gmail_account_id`, `started_at`, `finished_at`, `counts`, `log_json`

## Implementation notes

- Add schema migrations (SQL) and seed minimal data.
- Validate LLM outputs with JSON schemas; retry once if invalid.
- Avoid pushing sensitive content: push notification should contain sender + 1-line summary only.
- Provide Settings page to edit `context_pack` + keywords + disconnect Gmail.

## Deliverables

- Working Next.js app (PWA + push + inbox UI)
- Working FastAPI service (oauth, cron polling, AI processing, send reply)
- Supabase schema SQL
- README with setup steps + env vars + how to run cron (example curl with secret)


# Inbox Copilot

Monorepo for:

- `apps/web`: Next.js PWA (inbox UI, push subscribe, auth)
- `apps/api`: FastAPI service (Google OAuth, cron polling, AI processing, send reply)
- `packages/shared`: shared types + JSON schemas
- `supabase/migrations`: Supabase Postgres schema

## Quick Start (Local)

### 1) Supabase

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/0001_init.sql` in the Supabase SQL editor.
3. Grab env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (API backend only; keep server-side)

### 2) Web (Next.js)

`apps/web/.env.example` lists required env vars.

```bash
npm install
npm -w apps/web run dev
```

### 3) API (FastAPI)

`apps/api/.env.example` lists required env vars.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn app.main:app --reload --port 8001 --app-dir apps/api
```

Local dev reads env from the repo root `.env` (gitignored). `apps/web/.env` and `apps/api/.env` are symlinks to it.

### 4) Cron (Hourly)

Example:

```bash
curl -X POST "$API_BASE_URL/cron/poll-gmail" -H "X-CRON-SECRET: $CRON_SECRET"
```

## Notes

- Manual approval gate: the system never sends emails automatically; sending requires an explicit user action.
- Replace placeholder PWA icons under `apps/web/public/` with real 192/512 icons for production.

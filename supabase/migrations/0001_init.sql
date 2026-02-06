-- Inbox Copilot initial schema
-- Safe to run multiple times (uses IF NOT EXISTS where possible).

create extension if not exists pgcrypto;

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Gmail accounts (refresh token encrypted at rest)
create table if not exists public.gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_email text not null,
  refresh_token_encrypted text not null,
  scopes text[] not null default '{}'::text[],
  last_polled_at timestamptz,
  status text not null default 'active',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_email)
);

drop trigger if exists gmail_accounts_set_updated_at on public.gmail_accounts;
create trigger gmail_accounts_set_updated_at
before update on public.gmail_accounts
for each row execute function public.set_updated_at();

-- Per-user context pack used by the classifier/summarizer/drafter
create table if not exists public.context_packs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  brand_name text,
  brand_blurb text,
  products_info_json jsonb,
  policies_json jsonb,
  tone text,
  signature text,
  keywords_array text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists context_packs_set_updated_at on public.context_packs;
create trigger context_packs_set_updated_at
before update on public.context_packs
for each row execute function public.set_updated_at();

-- Ingested emails + processing results
create table if not exists public.email_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_account_id uuid not null references public.gmail_accounts(id) on delete cascade,
  gmail_message_id text not null,
  thread_id text,
  from_email text,
  subject text,
  snippet text,
  body_text text,
  received_at timestamptz,

  is_relevant boolean,
  confidence real,
  category text,
  reason text,
  summary_json jsonb,

  status text not null default 'ingested', -- ingested|processed|needs_review|sent|failed
  error_message text,
  sent_message_id text,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (gmail_account_id, gmail_message_id)
);

create index if not exists email_items_user_received_at_idx
on public.email_items (user_id, received_at desc);

create index if not exists email_items_user_status_idx
on public.email_items (user_id, status);

drop trigger if exists email_items_set_updated_at on public.email_items;
create trigger email_items_set_updated_at
before update on public.email_items
for each row execute function public.set_updated_at();

-- Reply drafts (versioned)
create table if not exists public.reply_drafts (
  id uuid primary key default gen_random_uuid(),
  email_item_id uuid not null references public.email_items(id) on delete cascade,
  version integer not null,
  draft_text text not null,
  instruction text,
  created_at timestamptz not null default now(),
  unique (email_item_id, version)
);

create index if not exists reply_drafts_email_item_version_idx
on public.reply_drafts (email_item_id, version desc);

-- Web push subscriptions (per device)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (endpoint)
);

create index if not exists push_subscriptions_user_idx
on public.push_subscriptions (user_id, created_at desc);

-- Processing run logs
create table if not exists public.processing_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_account_id uuid not null references public.gmail_accounts(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  counts jsonb,
  log_json jsonb
);

create index if not exists processing_runs_user_started_idx
on public.processing_runs (user_id, started_at desc);

-- RLS
alter table public.gmail_accounts enable row level security;
alter table public.context_packs enable row level security;
alter table public.email_items enable row level security;
alter table public.reply_drafts enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.processing_runs enable row level security;

-- gmail_accounts
drop policy if exists gmail_accounts_select_own on public.gmail_accounts;
create policy gmail_accounts_select_own on public.gmail_accounts
for select using (auth.uid() = user_id);

drop policy if exists gmail_accounts_insert_own on public.gmail_accounts;
create policy gmail_accounts_insert_own on public.gmail_accounts
for insert with check (auth.uid() = user_id);

drop policy if exists gmail_accounts_update_own on public.gmail_accounts;
create policy gmail_accounts_update_own on public.gmail_accounts
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists gmail_accounts_delete_own on public.gmail_accounts;
create policy gmail_accounts_delete_own on public.gmail_accounts
for delete using (auth.uid() = user_id);

-- context_packs
drop policy if exists context_packs_select_own on public.context_packs;
create policy context_packs_select_own on public.context_packs
for select using (auth.uid() = user_id);

drop policy if exists context_packs_insert_own on public.context_packs;
create policy context_packs_insert_own on public.context_packs
for insert with check (auth.uid() = user_id);

drop policy if exists context_packs_update_own on public.context_packs;
create policy context_packs_update_own on public.context_packs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists context_packs_delete_own on public.context_packs;
create policy context_packs_delete_own on public.context_packs
for delete using (auth.uid() = user_id);

-- email_items
drop policy if exists email_items_select_own on public.email_items;
create policy email_items_select_own on public.email_items
for select using (auth.uid() = user_id);

drop policy if exists email_items_insert_own on public.email_items;
create policy email_items_insert_own on public.email_items
for insert with check (auth.uid() = user_id);

drop policy if exists email_items_update_own on public.email_items;
create policy email_items_update_own on public.email_items
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists email_items_delete_own on public.email_items;
create policy email_items_delete_own on public.email_items
for delete using (auth.uid() = user_id);

-- reply_drafts (authorize via parent email_item)
drop policy if exists reply_drafts_select_own on public.reply_drafts;
create policy reply_drafts_select_own on public.reply_drafts
for select using (
  exists (
    select 1 from public.email_items ei
    where ei.id = reply_drafts.email_item_id
      and ei.user_id = auth.uid()
  )
);

drop policy if exists reply_drafts_insert_own on public.reply_drafts;
create policy reply_drafts_insert_own on public.reply_drafts
for insert with check (
  exists (
    select 1 from public.email_items ei
    where ei.id = reply_drafts.email_item_id
      and ei.user_id = auth.uid()
  )
);

drop policy if exists reply_drafts_update_own on public.reply_drafts;
create policy reply_drafts_update_own on public.reply_drafts
for update using (
  exists (
    select 1 from public.email_items ei
    where ei.id = reply_drafts.email_item_id
      and ei.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.email_items ei
    where ei.id = reply_drafts.email_item_id
      and ei.user_id = auth.uid()
  )
);

drop policy if exists reply_drafts_delete_own on public.reply_drafts;
create policy reply_drafts_delete_own on public.reply_drafts
for delete using (
  exists (
    select 1 from public.email_items ei
    where ei.id = reply_drafts.email_item_id
      and ei.user_id = auth.uid()
  )
);

-- push_subscriptions
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
for select using (auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
for insert with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
for delete using (auth.uid() = user_id);

-- processing_runs
drop policy if exists processing_runs_select_own on public.processing_runs;
create policy processing_runs_select_own on public.processing_runs
for select using (auth.uid() = user_id);

drop policy if exists processing_runs_insert_own on public.processing_runs;
create policy processing_runs_insert_own on public.processing_runs
for insert with check (auth.uid() = user_id);

drop policy if exists processing_runs_update_own on public.processing_runs;
create policy processing_runs_update_own on public.processing_runs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists processing_runs_delete_own on public.processing_runs;
create policy processing_runs_delete_own on public.processing_runs
for delete using (auth.uid() = user_id);


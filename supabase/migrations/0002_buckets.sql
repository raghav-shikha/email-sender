-- Buckets + routing

-- Per-user inbox buckets with matcher rules + processing actions.
create table if not exists public.email_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  priority integer not null default 100,
  is_enabled boolean not null default true,
  matchers jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

drop trigger if exists email_buckets_set_updated_at on public.email_buckets;
create trigger email_buckets_set_updated_at
before update on public.email_buckets
for each row execute function public.set_updated_at();

-- Email items can be routed into a bucket (nullable for legacy rows).
alter table public.email_items
  add column if not exists bucket_id uuid references public.email_buckets(id) on delete set null;

create index if not exists email_items_user_bucket_received_at_idx
on public.email_items (user_id, bucket_id, received_at desc);

-- RLS
alter table public.email_buckets enable row level security;

drop policy if exists email_buckets_select_own on public.email_buckets;
create policy email_buckets_select_own on public.email_buckets
for select using (auth.uid() = user_id);

drop policy if exists email_buckets_insert_own on public.email_buckets;
create policy email_buckets_insert_own on public.email_buckets
for insert with check (auth.uid() = user_id);

drop policy if exists email_buckets_update_own on public.email_buckets;
create policy email_buckets_update_own on public.email_buckets
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists email_buckets_delete_own on public.email_buckets;
create policy email_buckets_delete_own on public.email_buckets
for delete using (auth.uid() = user_id);

-- Daily photo of the HubSpot sales funnel, one row per deal per day, written
-- by /api/vendas?snapshot=1 (Vercel cron, ~23h São Paulo) and by /api/vendas
-- when today's photo is missing. Re-taking a day overwrites it: the rows of
-- the day that are not in the new photo are deleted (see api/_lib/vendasSnapshot.js).
--
-- Run once in Supabase → SQL Editor.

create table if not exists public.deal_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,                 -- São Paulo calendar day of the photo
  deal_id text not null,
  deal_name text not null default '',
  stage_id text not null,
  stage_label text not null default '',
  entered_stage_at timestamptz,      -- when the deal entered that stage (HubSpot)
  taken_at timestamptz not null default now(),
  unique (user_id, day, deal_id)
);

create index if not exists deal_snapshots_user_day_idx
  on public.deal_snapshots (user_id, day);

alter table public.deal_snapshots enable row level security;

-- The dashboard only reads through /api/vendas (service role); this policy
-- also lets the logged-in session read its own rows directly.
drop policy if exists "deal_snapshots_select_own" on public.deal_snapshots;
create policy "deal_snapshots_select_own"
  on public.deal_snapshots for select
  using (auth.uid() = user_id);

-- Apple Health samples pushed by the "Sincronizar Saúde" Shortcut through
-- /api/health-webhook. One row per sample; re-sending the same sample
-- (same type + start time + source) just overwrites it, so overlapping
-- incremental syncs are harmless.
--
-- Run once in Supabase → SQL Editor.

create table if not exists public.health_samples (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,               -- 'weight' (kg), later 'sleep', 'steps', ...
  start_at timestamptz not null,
  end_at timestamptz,
  value double precision not null,
  unit text,
  source text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, type, start_at, source)
);

create index if not exists health_samples_user_type_start_idx
  on public.health_samples (user_id, type, start_at);

alter table public.health_samples enable row level security;

-- The dashboard reads its own rows with the logged-in session; writes only
-- happen server-side (service role) from the webhook.
drop policy if exists "health_samples_select_own" on public.health_samples;
create policy "health_samples_select_own"
  on public.health_samples for select
  using (auth.uid() = user_id);

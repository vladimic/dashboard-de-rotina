-- Daily snapshots of the dashboard state, so a bad save is never the only
-- copy. The app writes at most one 'daily' row per day on load, a
-- 'before-import' row before restoring a backup, and prunes rows older than
-- 90 days.
--
-- Run once in Supabase → SQL Editor.

create table if not exists public.dashboard_state_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  source text not null default 'daily',
  created_at timestamptz not null default now()
);

create index if not exists dashboard_state_history_user_created_idx
  on public.dashboard_state_history (user_id, created_at desc);

alter table public.dashboard_state_history enable row level security;

drop policy if exists "dashboard_state_history_select_own" on public.dashboard_state_history;
create policy "dashboard_state_history_select_own"
  on public.dashboard_state_history for select using (auth.uid() = user_id);

drop policy if exists "dashboard_state_history_insert_own" on public.dashboard_state_history;
create policy "dashboard_state_history_insert_own"
  on public.dashboard_state_history for insert with check (auth.uid() = user_id);

drop policy if exists "dashboard_state_history_delete_own" on public.dashboard_state_history;
create policy "dashboard_state_history_delete_own"
  on public.dashboard_state_history for delete using (auth.uid() = user_id);

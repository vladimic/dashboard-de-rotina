-- Posts saved on Instagram, imported from the JSON file the "exporta salvos"
-- script produces (Backlog tab, ⬆ button). One row per post per import day;
-- only the three queues that count as backlog are stored (other collections
-- are ignored at import). Importing the same day again replaces that day.
--
-- Run once in Supabase → SQL Editor.

create table if not exists public.instagram_saved (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,                 -- São Paulo day of the import
  link text not null,
  autor text not null default '',
  post_date date,                    -- date of the post (not of the save)
  category text not null check (category in ('none', 'inbox', 'backlog')),
  imported_at timestamptz not null default now(),
  unique (user_id, day, link)
);

create index if not exists instagram_saved_user_day_idx
  on public.instagram_saved (user_id, day);

alter table public.instagram_saved enable row level security;

-- The dashboard reads and writes its own rows with the logged-in session.
drop policy if exists "instagram_saved_select_own" on public.instagram_saved;
create policy "instagram_saved_select_own" on public.instagram_saved
  for select using (auth.uid() = user_id);

drop policy if exists "instagram_saved_insert_own" on public.instagram_saved;
create policy "instagram_saved_insert_own" on public.instagram_saved
  for insert with check (auth.uid() = user_id);

drop policy if exists "instagram_saved_update_own" on public.instagram_saved;
create policy "instagram_saved_update_own" on public.instagram_saved
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "instagram_saved_delete_own" on public.instagram_saved;
create policy "instagram_saved_delete_own" on public.instagram_saved
  for delete using (auth.uid() = user_id);

-- Counts per day and queue (what the chart reads); respects the RLS above.
create or replace view public.instagram_saved_daily
  with (security_invoker = true) as
  select user_id, day, category, count(*)::int as n, max(imported_at) as imported_at
  from public.instagram_saved
  group by user_id, day, category;

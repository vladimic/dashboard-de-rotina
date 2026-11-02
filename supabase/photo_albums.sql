-- Albums of the Mac's Photos app (name, number of items, size on disk), imported
-- from the JSON/CSV file made on the Mac (Backlog tab, Fotos - Álbuns, ⬆ button).
-- One row per album per import day; importing the same day again replaces it.
--
-- Run once in Supabase → SQL Editor.

create table if not exists public.photo_albums (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,                 -- São Paulo day of the import
  album text not null,
  items integer not null default 0,
  bytes bigint not null default 0,
  imported_at timestamptz not null default now(),
  unique (user_id, day, album)
);

create index if not exists photo_albums_user_day_idx
  on public.photo_albums (user_id, day);

alter table public.photo_albums enable row level security;

-- The dashboard reads and writes its own rows with the logged-in session.
drop policy if exists "photo_albums_select_own" on public.photo_albums;
create policy "photo_albums_select_own" on public.photo_albums
  for select using (auth.uid() = user_id);

drop policy if exists "photo_albums_insert_own" on public.photo_albums;
create policy "photo_albums_insert_own" on public.photo_albums
  for insert with check (auth.uid() = user_id);

drop policy if exists "photo_albums_update_own" on public.photo_albums;
create policy "photo_albums_update_own" on public.photo_albums
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "photo_albums_delete_own" on public.photo_albums;
create policy "photo_albums_delete_own" on public.photo_albums
  for delete using (auth.uid() = user_id);

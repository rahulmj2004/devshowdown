-- DevShowdown initial schema.
-- Run in the Supabase SQL editor, or with `supabase db push`.
--
-- Access model
--   registrations  private. No anonymous access at all. Rows are inserted by
--                  the server (service role) and read only by organizers.
--   results        public can read rows marked published; organizers manage all.
--   site_settings  public can read; organizers can update.
--   admins         the list of organizer accounts. Managed from the SQL editor.

-- ---------------------------------------------------------------- admins ----
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

drop policy if exists "Organizers can read their own admin row" on public.admins;
create policy "Organizers can read their own admin row"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));

-- True when the calling user is an organizer. SECURITY DEFINER so policies on
-- other tables can consult `admins` without granting read access to it.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- --------------------------------------------------------- registrations ----
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  organization text not null check (char_length(organization) between 2 and 120),
  event_slug text not null check (char_length(event_slug) between 1 and 80),
  team_name text check (team_name is null or char_length(team_name) between 2 and 60),
  phone text check (phone is null or char_length(phone) between 7 and 20),
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- One registration per person per event. The app reports a friendly duplicate
-- message when this index rejects an insert.
create unique index if not exists registrations_email_event_key
  on public.registrations (lower(email), event_slug);

create index if not exists registrations_event_slug_idx
  on public.registrations (event_slug);

alter table public.registrations enable row level security;

-- No policy exists for `anon`, so the public API cannot read or write this
-- table. Revoke the table grants too, as defence in depth.
revoke all on public.registrations from anon;

drop policy if exists "Organizers can read registrations" on public.registrations;
create policy "Organizers can read registrations"
  on public.registrations for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Organizers can delete registrations" on public.registrations;
create policy "Organizers can delete registrations"
  on public.registrations for delete
  to authenticated
  using (public.is_admin());

-- --------------------------------------------------------------- results ----
-- `display_name` is the public name shown on the leaderboard. Never store an
-- email address or phone number in this table.
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null check (char_length(event_slug) between 1 and 80),
  display_name text not null check (char_length(display_name) between 1 and 80),
  score numeric not null,
  completion_time_ms integer check (completion_time_ms is null or completion_time_ms >= 0),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists results_event_published_idx
  on public.results (event_slug, published);

alter table public.results enable row level security;

drop policy if exists "Anyone can read published results" on public.results;
create policy "Anyone can read published results"
  on public.results for select
  to anon, authenticated
  using (published);

drop policy if exists "Organizers can read all results" on public.results;
create policy "Organizers can read all results"
  on public.results for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Organizers can insert results" on public.results;
create policy "Organizers can insert results"
  on public.results for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Organizers can update results" on public.results;
create policy "Organizers can update results"
  on public.results for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Organizers can delete results" on public.results;
create policy "Organizers can delete results"
  on public.results for delete
  to authenticated
  using (public.is_admin());

-- --------------------------------------------------------- site_settings ----
-- Single-row table: the boolean primary key can only ever be `true`.
create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  registration_status text not null default 'not_open'
    check (registration_status in ('not_open', 'open', 'closed')),
  announcement_label text not null default 'Announced'
    check (char_length(announcement_label) <= 40),
  announcement_text text not null default 'Dates, venue and registration details coming soon'
    check (char_length(announcement_text) <= 160),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Organizers can update site settings" on public.site_settings;
create policy "Organizers can update site settings"
  on public.site_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------- granting organizer access --
-- 1. Create the organizer's account under Authentication > Users.
-- 2. Then run, with their user id:
--      insert into public.admins (user_id) values ('<auth user uuid>');

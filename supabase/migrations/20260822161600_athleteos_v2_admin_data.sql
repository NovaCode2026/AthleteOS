-- AthleteOS V2 production safety migration.
-- Idempotent and data-preserving: creates missing objects, updates safe defaults,
-- refreshes only relevant RLS policies/grants, and does not insert fake/demo data.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'planned' check (status in ('research','planned','in-progress','released')),
  votes integer not null default 0 check (votes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roadmap_votes (
  id uuid primary key default gen_random_uuid(),
  roadmap_item_id uuid not null references public.roadmap_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (roadmap_item_id, user_id)
);

create table if not exists public.tournament_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  tournament_name text,
  tournament_date date,
  venue text,
  registration_deadline date,
  weigh_in_information text,
  categories text,
  notices text,
  pdfs jsonb not null default '[]',
  schedules_results text,
  source_hash text,
  detected_changes text,
  status text not null default 'pending' check (status in ('pending','checked','blocked','failed')),
  last_checked_at timestamptz,
  next_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_url)
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user','athlete','coach','academy_admin','support_admin','admin','super_admin'));
alter table public.profiles alter column role set default 'user';

alter table public.feedback_items add column if not exists visibility text not null default 'public';
alter table public.feedback_items drop constraint if exists feedback_items_visibility_check;
alter table public.feedback_items
  add constraint feedback_items_visibility_check check (visibility in ('public','private'));

create index if not exists idx_roadmap_items_status_votes on public.roadmap_items(status, votes desc);
create index if not exists idx_roadmap_votes_item_user on public.roadmap_votes(roadmap_item_id, user_id);
create index if not exists idx_tournament_scans_user_next on public.tournament_scans(user_id, next_check_at);
create index if not exists idx_feedback_items_visibility_status on public.feedback_items(visibility, status, created_at desc);

alter table public.roadmap_items enable row level security;
alter table public.roadmap_votes enable row level security;
alter table public.tournament_scans enable row level security;
alter table public.feedback_items enable row level security;
alter table public.profiles enable row level security;

create or replace function public.owns_row(row_user_id uuid)
returns boolean language sql stable set search_path = public as $$
  select (select auth.uid()) = row_user_id;
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role in ('support_admin','admin','super_admin')
  );
$$;

create or replace function public.enforce_profile_entitlement_security()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' and not public.is_platform_admin() then
    new.role = 'user';
    new.plan_id = 'free';
    new.verified_athlete = false;
    new.founder_badge = false;
  end if;

  if tg_op = 'UPDATE' and not public.is_platform_admin() then
    new.role = old.role;
    new.plan_id = old.plan_id;
    new.verified_athlete = old.verified_athlete;
    new.founder_badge = old.founder_badge;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_profile_entitlement_security() from public, anon, authenticated;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.owns_row(uuid) to authenticated;

drop trigger if exists enforce_profile_entitlement_security on public.profiles;
create trigger enforce_profile_entitlement_security
before insert or update on public.profiles
for each row execute function public.enforce_profile_entitlement_security();

drop trigger if exists set_roadmap_items_updated_at on public.roadmap_items;
create trigger set_roadmap_items_updated_at
before update on public.roadmap_items
for each row execute function public.set_updated_at();

drop trigger if exists set_tournament_scans_updated_at on public.tournament_scans;
create trigger set_tournament_scans_updated_at
before update on public.tournament_scans
for each row execute function public.set_updated_at();

drop trigger if exists set_feedback_items_updated_at on public.feedback_items;
create trigger set_feedback_items_updated_at
before update on public.feedback_items
for each row execute function public.set_updated_at();

drop policy if exists "roadmap public read" on public.roadmap_items;
drop policy if exists "roadmap authenticated insert" on public.roadmap_items;
drop policy if exists "roadmap admin manage" on public.roadmap_items;
create policy "roadmap public read" on public.roadmap_items
for select to authenticated
using (true);
create policy "roadmap admin manage" on public.roadmap_items
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "roadmap_votes select own rows" on public.roadmap_votes;
drop policy if exists "roadmap_votes insert own rows" on public.roadmap_votes;
drop policy if exists "roadmap_votes update own rows" on public.roadmap_votes;
drop policy if exists "roadmap_votes delete own rows" on public.roadmap_votes;
drop policy if exists "roadmap votes read" on public.roadmap_votes;
drop policy if exists "roadmap votes insert own" on public.roadmap_votes;
drop policy if exists "roadmap votes delete own" on public.roadmap_votes;
create policy "roadmap votes read" on public.roadmap_votes
for select to authenticated
using (true);
create policy "roadmap votes insert own" on public.roadmap_votes
for insert to authenticated
with check (public.owns_row(user_id));
create policy "roadmap votes delete own" on public.roadmap_votes
for delete to authenticated
using (public.owns_row(user_id));

create or replace function public.refresh_roadmap_vote_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare item_id uuid;
begin
  item_id = coalesce(new.roadmap_item_id, old.roadmap_item_id);
  update public.roadmap_items
  set votes = (select count(*) from public.roadmap_votes where roadmap_item_id = item_id),
      updated_at = now()
  where id = item_id;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.refresh_roadmap_vote_count() from public, anon, authenticated;

drop trigger if exists refresh_roadmap_vote_count on public.roadmap_votes;
create trigger refresh_roadmap_vote_count
after insert or delete on public.roadmap_votes
for each row execute function public.refresh_roadmap_vote_count();

drop policy if exists "feedback_items select own rows" on public.feedback_items;
drop policy if exists "feedback_items insert own rows" on public.feedback_items;
drop policy if exists "feedback_items update own rows" on public.feedback_items;
drop policy if exists "feedback_items delete own rows" on public.feedback_items;
drop policy if exists "feedback public or own read" on public.feedback_items;
drop policy if exists "feedback submit own" on public.feedback_items;
drop policy if exists "feedback edit own draft fields" on public.feedback_items;
drop policy if exists "feedback admin moderate" on public.feedback_items;
create policy "feedback public or own read" on public.feedback_items
for select to authenticated
using (visibility = 'public' or public.owns_row(user_id) or public.is_platform_admin());
create policy "feedback submit own" on public.feedback_items
for insert to authenticated
with check (public.owns_row(user_id) and status = 'new');
create policy "feedback edit own draft fields" on public.feedback_items
for update to authenticated
using (public.owns_row(user_id))
with check (public.owns_row(user_id) and status = 'new');
create policy "feedback admin moderate" on public.feedback_items
for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "tournament_scans select own rows" on public.tournament_scans;
drop policy if exists "tournament_scans insert own rows" on public.tournament_scans;
drop policy if exists "tournament_scans update own rows" on public.tournament_scans;
drop policy if exists "tournament_scans delete own rows" on public.tournament_scans;
create policy "tournament_scans select own rows" on public.tournament_scans
for select to authenticated
using (public.owns_row(user_id) or public.is_platform_admin());
create policy "tournament_scans insert own rows" on public.tournament_scans
for insert to authenticated
with check (public.owns_row(user_id) or public.is_platform_admin());
create policy "tournament_scans update own rows" on public.tournament_scans
for update to authenticated
using (public.owns_row(user_id) or public.is_platform_admin())
with check (public.owns_row(user_id) or public.is_platform_admin());
create policy "tournament_scans delete own rows" on public.tournament_scans
for delete to authenticated
using (public.owns_row(user_id) or public.is_platform_admin());

grant usage on schema public to anon, authenticated;
revoke all on public.roadmap_items from anon;
grant select on public.roadmap_items to authenticated;
grant select, insert, update, delete on public.roadmap_items to authenticated;
grant select, insert, delete on public.roadmap_votes to authenticated;
grant select, insert, update, delete on public.tournament_scans to authenticated;
grant select, insert, update, delete on public.feedback_items to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

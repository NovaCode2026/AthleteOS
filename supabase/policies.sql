alter table public.profiles enable row level security;
alter table public.academies enable row level security;
alter table public.academy_memberships enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_plans enable row level security;
alter table public.attendance_records enable row level security;
alter table public.tournaments enable row level security;
alter table public.matches enable row level security;
alter table public.medals enable row level security;
alter table public.certificates enable row level security;
alter table public.documents enable row level security;
alter table public.weight_logs enable row level security;
alter table public.calendar_events enable row level security;
alter table public.notifications enable row level security;
alter table public.competition_checklists enable row level security;
alter table public.injuries enable row level security;
alter table public.goals enable row level security;
alter table public.student_verifications enable row level security;
alter table public.feedback_items enable row level security;
alter table public.roadmap_items enable row level security;
alter table public.roadmap_votes enable row level security;
alter table public.tournament_scans enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_usage enable row level security;
alter table public.referrals enable row level security;
alter table public.athlete_badges enable row level security;
alter table public.payment_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.announcements enable row level security;
alter table public.feature_flags enable row level security;
alter table public.audit_logs enable row level security;

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
    new.role = 'athlete';
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

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','training_sessions','training_plans','attendance_records','tournaments','matches','medals','certificates','documents',
    'weight_logs','calendar_events','notifications','competition_checklists','injuries','goals',
    'student_verifications','feedback_items','ai_usage_events','subscriptions','subscription_usage','referrals','athlete_badges',
    'support_tickets','payment_events','tournament_scans'
  ] loop
    execute format('drop policy if exists "%s select own rows" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s insert own rows" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s update own rows" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s delete own rows" on public.%I', table_name, table_name);

    execute format('create policy "%s select own rows" on public.%I for select to authenticated using (public.owns_row(user_id) or public.is_platform_admin())', table_name, table_name);
    execute format('create policy "%s insert own rows" on public.%I for insert to authenticated with check (public.owns_row(user_id) or public.is_platform_admin())', table_name, table_name);
    execute format('create policy "%s update own rows" on public.%I for update to authenticated using (public.owns_row(user_id) or public.is_platform_admin()) with check (public.owns_row(user_id) or public.is_platform_admin())', table_name, table_name);
    execute format('create policy "%s delete own rows" on public.%I for delete to authenticated using (public.owns_row(user_id) or public.is_platform_admin())', table_name, table_name);
  end loop;
end $$;

drop policy if exists "profiles insert own rows" on public.profiles;
drop policy if exists "profiles insert own profile" on public.profiles;
create policy "profiles insert own profile" on public.profiles
for insert to authenticated with check (public.owns_row(user_id));

drop policy if exists "academies owner read" on public.academies;
drop policy if exists "academies owner insert" on public.academies;
drop policy if exists "academies owner update" on public.academies;
create policy "academies owner read" on public.academies for select to authenticated using ((select auth.uid()) = owner_user_id or public.is_platform_admin());
create policy "academies owner insert" on public.academies for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy "academies owner update" on public.academies for update to authenticated using ((select auth.uid()) = owner_user_id or public.is_platform_admin()) with check ((select auth.uid()) = owner_user_id or public.is_platform_admin());

drop policy if exists "academy memberships participant read" on public.academy_memberships;
drop policy if exists "academy memberships admin write" on public.academy_memberships;
create policy "academy memberships participant read" on public.academy_memberships
for select to authenticated using (
  (select auth.uid()) = user_id
  or public.is_platform_admin()
  or exists (
    select 1 from public.academies
    where academies.id = academy_memberships.academy_id
      and academies.owner_user_id = (select auth.uid())
  )
);
create policy "academy memberships admin write" on public.academy_memberships
for all to authenticated using (
  public.is_platform_admin()
  or exists (
    select 1 from public.academies
    where academies.id = academy_memberships.academy_id
      and academies.owner_user_id = (select auth.uid())
  )
) with check (
  public.is_platform_admin()
  or exists (
    select 1 from public.academies
    where academies.id = academy_memberships.academy_id
      and academies.owner_user_id = (select auth.uid())
  )
);

drop policy if exists "roadmap public read" on public.roadmap_items;
drop policy if exists "roadmap authenticated insert" on public.roadmap_items;
drop policy if exists "roadmap admin manage" on public.roadmap_items;
create policy "roadmap public read" on public.roadmap_items for select using (true);
create policy "roadmap admin manage" on public.roadmap_items for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "roadmap votes read" on public.roadmap_votes;
drop policy if exists "roadmap votes insert own" on public.roadmap_votes;
drop policy if exists "roadmap votes delete own" on public.roadmap_votes;
create policy "roadmap votes read" on public.roadmap_votes for select to authenticated using (true);
create policy "roadmap votes insert own" on public.roadmap_votes for insert to authenticated with check (public.owns_row(user_id));
create policy "roadmap votes delete own" on public.roadmap_votes for delete to authenticated using (public.owns_row(user_id));

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

drop policy if exists "announcements public published read" on public.announcements;
drop policy if exists "announcements admin manage" on public.announcements;
create policy "announcements public published read" on public.announcements for select using (published_at is not null or public.is_platform_admin());
create policy "announcements admin manage" on public.announcements for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "feature flags authenticated read" on public.feature_flags;
drop policy if exists "feature flags admin manage" on public.feature_flags;
create policy "feature flags authenticated read" on public.feature_flags for select to authenticated using (true);
create policy "feature flags admin manage" on public.feature_flags for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "audit logs admin read" on public.audit_logs;
drop policy if exists "audit logs admin insert" on public.audit_logs;
create policy "audit logs admin read" on public.audit_logs for select to authenticated using (public.is_platform_admin());
create policy "audit logs admin insert" on public.audit_logs for insert to authenticated with check (public.is_platform_admin());

grant usage on schema public to anon, authenticated;
grant select on public.roadmap_items to anon, authenticated;
grant select on public.announcements to anon, authenticated;
grant select on public.feature_flags to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.training_sessions to authenticated;
grant select, insert, update, delete on public.training_plans to authenticated;
grant select, insert, update, delete on public.attendance_records to authenticated;
grant select, insert, update, delete on public.tournaments to authenticated;
grant select, insert, update, delete on public.matches to authenticated;
grant select, insert, update, delete on public.medals to authenticated;
grant select, insert, update, delete on public.certificates to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.weight_logs to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.competition_checklists to authenticated;
grant select, insert, update, delete on public.injuries to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.student_verifications to authenticated;
grant select, insert, update, delete on public.feedback_items to authenticated;
grant select, insert, update, delete on public.roadmap_votes to authenticated;
grant select, insert, delete on public.roadmap_votes to authenticated;
grant select, insert, update, delete on public.tournament_scans to authenticated;
grant select, insert, update, delete on public.ai_usage_events to authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update, delete on public.subscription_usage to authenticated;
grant select, insert, update, delete on public.referrals to authenticated;
grant select, insert, update, delete on public.athlete_badges to authenticated;
grant select, insert, update, delete on public.support_tickets to authenticated;
grant select, insert, update, delete on public.payment_events to authenticated;
grant select, insert, update, delete on public.academies to authenticated;
grant select, insert, update, delete on public.academy_memberships to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert, update, delete on public.feature_flags to authenticated;
grant select, insert on public.audit_logs to authenticated;

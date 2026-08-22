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
returns boolean language sql stable as $$
  select auth.uid() = row_user_id;
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
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
    'support_tickets','payment_events'
  ] loop
    execute format('drop policy if exists "%s select own rows" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s insert own rows" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s update own rows" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s delete own rows" on public.%I', table_name, table_name);

    execute format('create policy "%s select own rows" on public.%I for select using (public.owns_row(user_id) or public.is_platform_admin())', table_name, table_name);
    execute format('create policy "%s insert own rows" on public.%I for insert with check (public.owns_row(user_id) or public.is_platform_admin())', table_name, table_name);
    execute format('create policy "%s update own rows" on public.%I for update using (public.owns_row(user_id) or public.is_platform_admin()) with check (public.owns_row(user_id) or public.is_platform_admin())', table_name, table_name);
    execute format('create policy "%s delete own rows" on public.%I for delete using (public.owns_row(user_id) or public.is_platform_admin())', table_name, table_name);
  end loop;
end $$;

drop policy if exists "profiles select own rows" on public.profiles;
drop policy if exists "profiles insert own rows" on public.profiles;
drop policy if exists "profiles update own rows" on public.profiles;
drop policy if exists "profiles delete own rows" on public.profiles;
drop policy if exists "profiles read own or admin" on public.profiles;
drop policy if exists "profiles insert own profile" on public.profiles;
drop policy if exists "profiles update own or admin" on public.profiles;
drop policy if exists "profiles delete own or admin" on public.profiles;

create policy "profiles read own or admin" on public.profiles
for select using (public.owns_row(user_id) or public.is_platform_admin());

create policy "profiles insert own profile" on public.profiles
for insert with check (public.owns_row(user_id));

create policy "profiles update own or admin" on public.profiles
for update using (public.owns_row(user_id) or public.is_platform_admin())
with check (public.owns_row(user_id) or public.is_platform_admin());

create policy "profiles delete own or admin" on public.profiles
for delete using (public.owns_row(user_id) or public.is_platform_admin());

drop policy if exists "roadmap public read" on public.roadmap_items;
create policy "roadmap public read" on public.roadmap_items for select using (true);

drop policy if exists "roadmap authenticated insert" on public.roadmap_items;
create policy "roadmap authenticated insert" on public.roadmap_items for insert to authenticated with check (true);

drop policy if exists "academies owner read" on public.academies;
drop policy if exists "academies owner insert" on public.academies;
drop policy if exists "academies owner update" on public.academies;
create policy "academies owner read" on public.academies for select using (auth.uid() = owner_user_id or public.is_platform_admin());
create policy "academies owner insert" on public.academies for insert with check (auth.uid() = owner_user_id);
create policy "academies owner update" on public.academies for update using (auth.uid() = owner_user_id or public.is_platform_admin()) with check (auth.uid() = owner_user_id or public.is_platform_admin());

drop policy if exists "academy memberships participant read" on public.academy_memberships;
drop policy if exists "academy memberships admin write" on public.academy_memberships;
create policy "academy memberships participant read" on public.academy_memberships
for select using (
  auth.uid() = user_id
  or public.is_platform_admin()
  or exists (
    select 1 from public.academies
    where academies.id = academy_memberships.academy_id
      and academies.owner_user_id = auth.uid()
  )
);
create policy "academy memberships admin write" on public.academy_memberships
for all using (
  public.is_platform_admin()
  or exists (
    select 1 from public.academies
    where academies.id = academy_memberships.academy_id
      and academies.owner_user_id = auth.uid()
  )
) with check (
  public.is_platform_admin()
  or exists (
    select 1 from public.academies
    where academies.id = academy_memberships.academy_id
      and academies.owner_user_id = auth.uid()
  )
);

drop policy if exists "announcements public published read" on public.announcements;
drop policy if exists "announcements admin manage" on public.announcements;
create policy "announcements public published read" on public.announcements for select using (published_at is not null or public.is_platform_admin());
create policy "announcements admin manage" on public.announcements for all using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "feature flags authenticated read" on public.feature_flags;
drop policy if exists "feature flags admin manage" on public.feature_flags;
create policy "feature flags authenticated read" on public.feature_flags for select to authenticated using (true);
create policy "feature flags admin manage" on public.feature_flags for all using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "audit logs admin read" on public.audit_logs;
drop policy if exists "audit logs admin insert" on public.audit_logs;
create policy "audit logs admin read" on public.audit_logs for select using (public.is_platform_admin());
create policy "audit logs admin insert" on public.audit_logs for insert with check (public.is_platform_admin());

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;

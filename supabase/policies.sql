alter table public.profiles enable row level security;
alter table public.training_sessions enable row level security;
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

create or replace function public.owns_row(row_user_id uuid)
returns boolean language sql stable as $$
  select auth.uid() = row_user_id;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','training_sessions','tournaments','matches','medals','certificates','documents',
    'weight_logs','calendar_events','notifications','competition_checklists','injuries','goals'
  ] loop
    execute format('drop policy if exists "%s select own rows" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s insert own rows" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s update own rows" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s delete own rows" on public.%I', table_name, table_name);

    execute format('create policy "%s select own rows" on public.%I for select using (public.owns_row(user_id))', table_name, table_name);
    execute format('create policy "%s insert own rows" on public.%I for insert with check (public.owns_row(user_id))', table_name, table_name);
    execute format('create policy "%s update own rows" on public.%I for update using (public.owns_row(user_id)) with check (public.owns_row(user_id))', table_name, table_name);
    execute format('create policy "%s delete own rows" on public.%I for delete using (public.owns_row(user_id))', table_name, table_name);
  end loop;
end $$;

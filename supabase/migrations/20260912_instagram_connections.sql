create table if not exists public.instagram_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  instagram_user_id text not null,
  username text,
  access_token text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active','expired','revoked')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.instagram_connections enable row level security;
alter table public.instagram_oauth_states enable row level security;

drop policy if exists "users can read own instagram connection" on public.instagram_connections;
create policy "users can read own instagram connection"
  on public.instagram_connections for select
  using (user_id = auth.uid());

drop policy if exists "users cannot write instagram connections" on public.instagram_connections;

-- OAuth state is server-managed. No client policy is intentionally granted.

drop policy if exists "users cannot access instagram oauth states" on public.instagram_oauth_states;

create index if not exists instagram_oauth_states_expires_at_idx
  on public.instagram_oauth_states (expires_at);

create or replace function public.cleanup_expired_instagram_oauth_states()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.instagram_oauth_states where expires_at < now();
$$;

grant execute on function public.cleanup_expired_instagram_oauth_states() to service_role;

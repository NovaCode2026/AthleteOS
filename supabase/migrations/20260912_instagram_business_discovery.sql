-- Separate server-managed connection for Instagram Business Discovery.
-- This uses the Facebook Login / Graph API flow, which is distinct from the
-- existing Instagram Login connection used for an athlete's own account.

create table if not exists public.instagram_discovery_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  facebook_user_id text not null,
  instagram_user_id text not null,
  instagram_username text,
  access_token text not null,
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_discovery_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.instagram_discovery_connections enable row level security;
alter table public.instagram_discovery_oauth_states enable row level security;

revoke all on public.instagram_discovery_connections from anon, authenticated;
revoke all on public.instagram_discovery_oauth_states from anon, authenticated;
grant select, insert, update, delete on public.instagram_discovery_connections to service_role;
grant select, insert, update, delete on public.instagram_discovery_oauth_states to service_role;

create index if not exists instagram_discovery_oauth_states_expires_at_idx
  on public.instagram_discovery_oauth_states (expires_at);

create or replace function public.cleanup_expired_instagram_discovery_oauth_states()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.instagram_discovery_oauth_states where expires_at < now();
$$;

grant execute on function public.cleanup_expired_instagram_discovery_oauth_states() to service_role;

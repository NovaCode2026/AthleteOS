-- Instagram connections are server-managed. Never expose access tokens to the browser.

alter table public.instagram_connections enable row level security;

-- Remove the earlier direct-read policy. Status/data must be returned by server functions
-- that authenticate the caller first and never serialize access_token.
drop policy if exists "users can read own instagram connection" on public.instagram_connections;
drop policy if exists "users cannot write instagram connections" on public.instagram_connections;

-- Keep OAuth state server-only as well.
alter table public.instagram_oauth_states enable row level security;
drop policy if exists "users can read own instagram oauth states" on public.instagram_oauth_states;
drop policy if exists "users cannot access instagram oauth states" on public.instagram_oauth_states;

-- Only service_role may access the raw token/state tables. Netlify Functions use this role
-- after authenticating the user's Supabase JWT.
revoke all on public.instagram_connections from anon, authenticated;
revoke all on public.instagram_oauth_states from anon, authenticated;
grant select, insert, update, delete on public.instagram_connections to service_role;
grant select, insert, update, delete on public.instagram_oauth_states to service_role;

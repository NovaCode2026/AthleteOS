create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  name text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  message_type text not null default 'normal' check (message_type in ('normal', 'tournament_announcement', 'training_schedule', 'training_plan', 'document', 'team_announcement')),
  created_at timestamptz not null default now()
);

create index if not exists idx_conversation_members_user on public.conversation_members(user_id, conversation_id);
create index if not exists idx_messages_conversation_created on public.messages(conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversation members can read conversations" on public.conversations;
create policy "conversation members can read conversations" on public.conversations
for select to authenticated
using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = conversations.id and cm.user_id = auth.uid()
));

drop policy if exists "conversation creators can create conversations" on public.conversations;
create policy "conversation creators can create conversations" on public.conversations
for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "conversation creators can update groups" on public.conversations;
create policy "conversation creators can update groups" on public.conversations
for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "members can read membership" on public.conversation_members;
create policy "members can read membership" on public.conversation_members
for select to authenticated
using (user_id = auth.uid() or exists (
  select 1 from public.conversation_members own
  where own.conversation_id = conversation_members.conversation_id and own.user_id = auth.uid()
));

drop policy if exists "users can join conversations through secure functions" on public.conversation_members;
create policy "users can join conversations through secure functions" on public.conversation_members
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "members can read messages" on public.messages;
create policy "members can read messages" on public.messages
for select to authenticated
using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
));

drop policy if exists "members can send their own messages" on public.messages;
create policy "members can send their own messages" on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
  )
);

drop policy if exists "senders can delete their own messages" on public.messages;
create policy "senders can delete their own messages" on public.messages
for delete to authenticated
using (sender_id = auth.uid());

create or replace function public.create_direct_conversation(p_recipient_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller uuid := auth.uid();
  recipient uuid;
  existing_id uuid;
  conversation_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select id into recipient from auth.users where lower(email) = lower(trim(p_recipient_email)) limit 1;
  if recipient is null then raise exception 'Recipient account not found'; end if;
  if recipient = caller then raise exception 'You cannot message yourself'; end if;

  select c.id into existing_id
  from public.conversations c
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id = caller)
    and exists (select 1 from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id = recipient)
    and (select count(*) from public.conversation_members cm where cm.conversation_id = c.id) = 2
  limit 1;
  if existing_id is not null then return existing_id; end if;

  insert into public.conversations(kind, created_by) values ('direct', caller) returning id into conversation_id;
  insert into public.conversation_members(conversation_id, user_id) values (conversation_id, caller), (conversation_id, recipient);
  return conversation_id;
end;
$$;

create or replace function public.create_group_conversation(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  conversation_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select role into caller_role from public.profiles where user_id = caller limit 1;
  if caller_role not in ('coach', 'academy_admin', 'admin', 'super_admin') then raise exception 'Only coaches or authorized admins can create groups'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Group name is required'; end if;
  insert into public.conversations(kind, name, created_by) values ('group', trim(p_name), caller) returning id into conversation_id;
  insert into public.conversation_members(conversation_id, user_id) values (conversation_id, caller);
  return conversation_id;
end;
$$;

create or replace function public.add_group_member_by_email(p_conversation_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller uuid := auth.uid();
  member uuid;
  creator uuid;
begin
  select created_by into creator from public.conversations where id = p_conversation_id and kind = 'group';
  if creator is null or creator <> caller then raise exception 'Only the group creator can add members'; end if;
  select id into member from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if member is null then raise exception 'Member account not found'; end if;
  insert into public.conversation_members(conversation_id, user_id) values (p_conversation_id, member) on conflict do nothing;
end;
$$;

revoke all on function public.create_direct_conversation(text) from public;
grant execute on function public.create_direct_conversation(text) to authenticated;
revoke all on function public.create_group_conversation(text) from public;
grant execute on function public.create_group_conversation(text) to authenticated;
revoke all on function public.add_group_member_by_email(uuid,text) from public;
grant execute on function public.add_group_member_by_email(uuid,text) to authenticated;

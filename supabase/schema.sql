create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  profile_image_path text,
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  belt text,
  academy text,
  coach text,
  emergency_contact text,
  achievements text,
  plan_id text not null default 'free' check (plan_id in ('free','student','pro','champion','academy')),
  verified_athlete boolean not null default false,
  founder_badge boolean not null default false,
  role text not null default 'athlete' check (role in ('athlete','coach','academy_admin','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  session_date date not null,
  minutes integer not null check (minutes > 0),
  intensity text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  starts_at date,
  location text,
  status text default 'planned',
  result text,
  opponent_notes text,
  match_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  opponent_name text,
  division text,
  round_name text,
  result text,
  score text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  medal_type text not null,
  category text,
  awarded_at date,
  image_path text,
  result_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  certificate_path text,
  issued_by text,
  issued_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  document_type text not null,
  file_path text,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at date not null,
  weight_kg numeric(5,2) not null check (weight_kg > 0),
  target_weight_kg numeric(5,2),
  competition_weight_kg numeric(5,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_type text not null check (event_type in ('training','competition','recovery','medical','reminder','travel')),
  event_date timestamptz not null,
  reminder_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  notification_type text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.competition_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  category text not null default 'equipment',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.injuries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  severity text,
  occurred_at date,
  recovery_status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_date date,
  status text not null default 'active',
  progress integer not null default 0 check (progress between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('school_id','fee_receipt','bonafide')),
  file_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  details text,
  status text not null default 'new' check (status in ('new','reviewing','planned','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'planned' check (status in ('research','planned','in-progress','released')),
  votes integer not null default 0 check (votes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null default 'free',
  topic text not null,
  tokens_used integer not null default 0 check (tokens_used >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free','student','pro','champion','academy')),
  provider text check (provider in ('manual','razorpay','stripe','cashfree')),
  provider_customer_id text,
  provider_subscription_id text,
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  referred_user_id uuid references auth.users(id),
  status text not null default 'created' check (status in ('created','converted','rewarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.athlete_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  badge_label text not null,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index if not exists idx_training_sessions_user_date on public.training_sessions(user_id, session_date desc);
create index if not exists idx_tournaments_user_date on public.tournaments(user_id, starts_at);
create index if not exists idx_weight_logs_user_date on public.weight_logs(user_id, logged_at);
create index if not exists idx_calendar_events_user_date on public.calendar_events(user_id, event_date);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read_at);
create index if not exists idx_student_verifications_user_status on public.student_verifications(user_id, status);
create index if not exists idx_feedback_items_user_status on public.feedback_items(user_id, status);
create index if not exists idx_roadmap_items_status_votes on public.roadmap_items(status, votes desc);
create index if not exists idx_ai_usage_events_user_created on public.ai_usage_events(user_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','training_sessions','tournaments','matches','medals','certificates','documents',
    'weight_logs','calendar_events','notifications','competition_checklists','injuries','goals',
    'student_verifications','feedback_items','roadmap_items','subscriptions','referrals'
  ] loop
    execute format('drop trigger if exists set_%s_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

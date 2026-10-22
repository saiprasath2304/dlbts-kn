-- =============================================================================
-- Event judging: core schema
--
-- Rollback guidance: this migration only creates objects. On a development
-- database run `supabase db reset` (re-applies all migrations from scratch).
-- On production never drop these tables: restore from a backup (README
-- "Backup and recovery") or write a forward migration.
-- =============================================================================

create type public.app_role as enum ('admin', 'judge');

create type public.submission_status as enum (
  'not_started',
  'in_progress',
  'submitted',
  'reopening_requested',
  'correction_requested',
  'reopened',
  'resubmitted'
);

create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.correction_status as enum ('open', 'responded', 'resolved', 'cancelled');
create type public.participant_kind as enum ('individual', 'team');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles: one row per Supabase Auth user. Created only by trusted server code.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  username text not null unique
    check (username ~ '^[a-z0-9][a-z0-9._-]{2,49}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  role public.app_role not null default 'judge',
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Groups and events
-- -----------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]{1,12}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 2000),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger groups_updated_at before update on public.groups
  for each row execute function public.set_updated_at();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9]{1,12}$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (char_length(description) <= 4000),
  instructions text check (char_length(instructions) <= 8000),
  -- Decimal places judges may use (0 = whole marks, 1 = 22.5, 2 = 22.25)
  score_precision smallint not null default 1 check (score_precision between 0 and 2),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, code)
);
create index events_group_idx on public.events (group_id);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Participants (individuals or teams) and their event entries
-- -----------------------------------------------------------------------------
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$'),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  kind public.participant_kind not null default 'individual',
  group_id uuid references public.groups (id) on delete restrict,
  affiliation text check (char_length(affiliation) <= 200),
  registration_no text check (char_length(registration_no) <= 80),
  notes text check (char_length(notes) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index participants_group_idx on public.participants (group_id);
create trigger participants_updated_at before update on public.participants
  for each row execute function public.set_updated_at();

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  participant_id uuid not null references public.participants (id) on delete restrict,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, participant_id)
);
create index event_participants_participant_idx on public.event_participants (participant_id);
create trigger event_participants_updated_at before update on public.event_participants
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Judge assignments and evaluation criteria
-- -----------------------------------------------------------------------------
create table public.judge_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  judge_id uuid not null references public.profiles (id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, judge_id)
);
create index judge_assignments_judge_idx on public.judge_assignments (judge_id);
create trigger judge_assignments_updated_at before update on public.judge_assignments
  for each row execute function public.set_updated_at();

create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  max_marks numeric(6, 2) not null check (max_marks > 0 and max_marks <= 1000),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index evaluation_criteria_event_idx on public.evaluation_criteria (event_id);
create trigger evaluation_criteria_updated_at before update on public.evaluation_criteria
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Submissions: one per (event, judge). Scores belong to a submission.
-- -----------------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  judge_id uuid not null references public.profiles (id) on delete restrict,
  status public.submission_status not null default 'not_started',
  -- Incremented on every change; optimistic concurrency for final submit.
  version integer not null default 0,
  -- Number of completed (re)submissions.
  round integer not null default 0,
  submitted_at timestamptz,
  submitted_by uuid references public.profiles (id),
  last_saved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, judge_id)
);
create index submissions_judge_idx on public.submissions (judge_id);
create index submissions_status_idx on public.submissions (status);
create trigger submissions_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();

create table public.criterion_scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete restrict,
  participant_id uuid not null references public.participants (id) on delete restrict,
  criterion_id uuid not null references public.evaluation_criteria (id) on delete restrict,
  -- null = mark cleared by the judge
  value numeric(6, 2) check (value is null or value >= 0),
  version integer not null default 1,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, participant_id, criterion_id)
);
create index criterion_scores_participant_idx on public.criterion_scores (participant_id);
create index criterion_scores_criterion_idx on public.criterion_scores (criterion_id);
create trigger criterion_scores_updated_at before update on public.criterion_scores
  for each row execute function public.set_updated_at();

-- Every change to a mark, append-only.
create table public.score_history (
  id bigint generated always as identity primary key,
  score_id uuid not null,
  submission_id uuid not null,
  participant_id uuid not null,
  criterion_id uuid not null,
  old_value numeric(6, 2),
  new_value numeric(6, 2),
  old_version integer,
  new_version integer not null,
  source text not null check (source in ('judge', 'admin', 'system')),
  reason text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index score_history_submission_idx on public.score_history (submission_id, changed_at);

-- Immutable snapshot of each (re)submission.
create table public.submission_rounds (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete restrict,
  round integer not null,
  status public.submission_status not null,
  submitted_at timestamptz not null default now(),
  submitted_by uuid not null,
  scores jsonb not null,
  totals jsonb not null,
  unique (submission_id, round)
);

-- Every submission state transition, append-only.
create table public.submission_transitions (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.submissions (id) on delete restrict,
  from_status public.submission_status,
  to_status public.submission_status not null,
  actor_id uuid,
  reason text,
  request_id uuid,
  created_at timestamptz not null default now()
);
create index submission_transitions_submission_idx
  on public.submission_transitions (submission_id, created_at);

-- -----------------------------------------------------------------------------
-- Requests
-- -----------------------------------------------------------------------------
create table public.reopening_requests (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete restrict,
  requested_by uuid not null references public.profiles (id),
  reason text not null check (char_length(btrim(reason)) between 3 and 2000),
  status public.request_status not null default 'pending',
  previous_status public.submission_status not null,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index reopening_requests_one_pending
  on public.reopening_requests (submission_id) where status = 'pending';
create trigger reopening_requests_updated_at before update on public.reopening_requests
  for each row execute function public.set_updated_at();

create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete restrict,
  event_id uuid not null references public.events (id) on delete restrict,
  participant_id uuid references public.participants (id) on delete restrict,
  criterion_ids uuid[] not null default '{}',
  message text not null check (char_length(btrim(message)) between 3 and 2000),
  unlocks_submission boolean not null default true,
  status public.correction_status not null default 'open',
  judge_response text check (char_length(judge_response) <= 2000),
  responded_at timestamptz,
  created_by uuid not null references public.profiles (id),
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index correction_requests_submission_idx on public.correction_requests (submission_id);
create trigger correction_requests_updated_at before update on public.correction_requests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audit log (append-only; protected by triggers in the security migration)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id uuid,
  group_id uuid,
  event_id uuid,
  participant_id uuid,
  judge_id uuid,
  submission_id uuid,
  request_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  metadata jsonb not null default '{}'
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_action_idx on public.audit_logs (action);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_event_idx on public.audit_logs (event_id);
create index audit_logs_participant_idx on public.audit_logs (participant_id);

-- -----------------------------------------------------------------------------
-- Results
-- -----------------------------------------------------------------------------
create table public.tie_resolutions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  aggregate numeric(10, 2) not null,
  -- sorted ascending so a tie group has one canonical identity
  participant_ids uuid[] not null,
  original jsonb not null,
  ranks jsonb not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 2000),
  related_correction_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  resolved_by uuid not null references public.profiles (id),
  resolved_at timestamptz not null default now()
);
create index tie_resolutions_event_idx on public.tie_resolutions (event_id) where is_active;

create table public.result_finalizations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'invalidated')),
  snapshot jsonb not null,
  finalized_by uuid not null references public.profiles (id),
  finalized_at timestamptz not null default now(),
  invalidated_by uuid,
  invalidated_at timestamptz,
  invalidation_reason text
);
create unique index result_finalizations_one_active
  on public.result_finalizations (event_id) where status = 'active';

-- -----------------------------------------------------------------------------
-- Reports and settings
-- -----------------------------------------------------------------------------
create table public.report_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('final', 'progress')),
  locale text not null default 'en' check (locale in ('en', 'ta')),
  include_breakdown boolean not null default false,
  event_ids uuid[] not null default '{}',
  generated_by uuid not null references public.profiles (id),
  generated_at timestamptz not null default now(),
  file_sha256 text,
  byte_size integer,
  idempotency_key text unique,
  email_status text not null default 'not_requested'
    check (email_status in ('not_requested', 'pending', 'sent', 'failed')),
  email_recipient_masked text,
  email_attempts integer not null default 0,
  email_last_error text,
  email_sent_at timestamptz,
  provider_message_id text,
  updated_at timestamptz not null default now()
);
create trigger report_records_updated_at before update on public.report_records
  for each row execute function public.set_updated_at();

create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value) values
  ('app_title', '"Event Judging"'),
  ('default_locale', '"en"'),
  ('username_pattern', '"judge{nn}{group}{event}"'),
  ('password_pattern', '"pwd{nn}{group}{event}"'),
  ('autosave_delay_ms', '800');
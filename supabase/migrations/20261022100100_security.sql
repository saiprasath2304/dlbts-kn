-- =============================================================================
-- Security: role helpers, Row Level Security, privileges, tamper protection.
--
-- Model:
--   * anon (unauthenticated) has no access to anything.
--   * Judges can read only data for their own active assignments and their own
--     submissions/scores. They cannot write any table directly; every judge
--     write goes through SECURITY DEFINER functions that re-check ownership and
--     submission state inside a transaction.
--   * Admins can manage configuration tables directly (RLS: is_admin()), and
--     all consequential operations go through audited functions.
--   * Profiles (roles) are writable only by the service role, i.e. trusted
--     server code that has already verified the caller is an admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies can consult profiles without
-- recursive RLS evaluation). They only ever describe the *calling* user.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.is_active_judge()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'judge' and is_active
  );
$$;

-- True when the calling judge has an active assignment to an active event.
create or replace function public.is_assigned(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.judge_assignments a
    join public.profiles p on p.id = a.judge_id
    join public.events e on e.id = a.event_id
    join public.groups g on g.id = e.group_id
    where a.event_id = p_event_id
      and a.judge_id = auth.uid()
      and a.is_active and p.is_active and p.role = 'judge'
      and e.is_active and g.is_active
  );
$$;

create or replace function public.owns_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.submissions s
    where s.id = p_submission_id
      and s.judge_id = auth.uid()
      and public.is_assigned(s.event_id)
  );
$$;

create or replace function public.is_editable_status(p_status public.submission_status)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_status in ('not_started', 'in_progress', 'reopened', 'correction_requested');
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.event_participants enable row level security;
alter table public.judge_assignments enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.submissions enable row level security;
alter table public.criterion_scores enable row level security;
alter table public.score_history enable row level security;
alter table public.submission_rounds enable row level security;
alter table public.submission_transitions enable row level security;
alter table public.reopening_requests enable row level security;
alter table public.correction_requests enable row level security;
alter table public.audit_logs enable row level security;
alter table public.tie_resolutions enable row level security;
alter table public.result_finalizations enable row level security;
alter table public.report_records enable row level security;
alter table public.app_settings enable row level security;

-- -----------------------------------------------------------------------------
-- Read policies
-- -----------------------------------------------------------------------------
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy groups_read on public.groups for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.events e
      where e.group_id = groups.id and public.is_assigned(e.id)
    )
  );

create policy events_read on public.events for select to authenticated
  using ((select public.is_admin()) or public.is_assigned(id));

create policy participants_read on public.participants for select to authenticated
  using (
    (select public.is_admin())
    or (
      is_active and exists (
        select 1 from public.event_participants ep
        where ep.participant_id = participants.id
          and ep.is_active
          and public.is_assigned(ep.event_id)
      )
    )
  );

create policy event_participants_read on public.event_participants for select to authenticated
  using ((select public.is_admin()) or (is_active and public.is_assigned(event_id)));

create policy judge_assignments_read on public.judge_assignments for select to authenticated
  using ((select public.is_admin()) or (judge_id = (select auth.uid()) and is_active));

create policy evaluation_criteria_read on public.evaluation_criteria for select to authenticated
  using ((select public.is_admin()) or public.is_assigned(event_id));

create policy submissions_read on public.submissions for select to authenticated
  using (
    (select public.is_admin())
    or (judge_id = (select auth.uid()) and public.is_assigned(event_id))
  );

create policy criterion_scores_read on public.criterion_scores for select to authenticated
  using ((select public.is_admin()) or public.owns_submission(submission_id));

create policy score_history_read on public.score_history for select to authenticated
  using ((select public.is_admin()));

create policy submission_rounds_read on public.submission_rounds for select to authenticated
  using ((select public.is_admin()) or public.owns_submission(submission_id));

create policy submission_transitions_read on public.submission_transitions for select to authenticated
  using ((select public.is_admin()) or public.owns_submission(submission_id));

create policy reopening_requests_read on public.reopening_requests for select to authenticated
  using ((select public.is_admin()) or public.owns_submission(submission_id));

create policy correction_requests_read on public.correction_requests for select to authenticated
  using ((select public.is_admin()) or public.owns_submission(submission_id));

create policy audit_logs_read on public.audit_logs for select to authenticated
  using ((select public.is_admin()));

create policy tie_resolutions_read on public.tie_resolutions for select to authenticated
  using ((select public.is_admin()));

create policy result_finalizations_read on public.result_finalizations for select to authenticated
  using ((select public.is_admin()));

create policy report_records_read on public.report_records for select to authenticated
  using ((select public.is_admin()));

create policy app_settings_read on public.app_settings for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- Admin write policies (configuration tables only). Consequential changes on
-- these tables are additionally guarded by triggers (workflows migration).
-- -----------------------------------------------------------------------------
create policy groups_admin_insert on public.groups for insert to authenticated
  with check ((select public.is_admin()));
create policy groups_admin_update on public.groups for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy groups_admin_delete on public.groups for delete to authenticated
  using ((select public.is_admin()));

create policy events_admin_insert on public.events for insert to authenticated
  with check ((select public.is_admin()));
create policy events_admin_update on public.events for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy events_admin_delete on public.events for delete to authenticated
  using ((select public.is_admin()));

create policy participants_admin_insert on public.participants for insert to authenticated
  with check ((select public.is_admin()));
create policy participants_admin_update on public.participants for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy event_participants_admin_insert on public.event_participants for insert to authenticated
  with check ((select public.is_admin()));
create policy event_participants_admin_update on public.event_participants for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy evaluation_criteria_admin_insert on public.evaluation_criteria for insert to authenticated
  with check ((select public.is_admin()));
create policy evaluation_criteria_admin_update on public.evaluation_criteria for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy evaluation_criteria_admin_delete on public.evaluation_criteria for delete to authenticated
  using ((select public.is_admin()));

create policy report_records_admin_insert on public.report_records for insert to authenticated
  with check ((select public.is_admin()) and generated_by = (select auth.uid()));
create policy report_records_admin_update on public.report_records for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy app_settings_admin_update on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Table privileges. RLS decides rows; privileges decide which verbs exist.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on public.groups, public.events, public.evaluation_criteria
  to authenticated;
grant insert, update on public.participants, public.event_participants, public.report_records
  to authenticated;
grant update on public.app_settings to authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.is_admin(),
  public.is_active_judge(),
  public.is_assigned(uuid),
  public.owns_submission(uuid),
  public.is_editable_status(public.submission_status)
to authenticated;

-- -----------------------------------------------------------------------------
-- Tamper protection
-- -----------------------------------------------------------------------------
create or replace function public.forbid_modification()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'APPEND_ONLY' using detail = format('%s is append-only', tg_table_name);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['audit_logs', 'score_history', 'submission_transitions', 'submission_rounds']
  loop
    execute format(
      'create trigger %I before update or delete on public.%I for each row execute function public.forbid_modification()',
      t || '_append_only', t);
    execute format(
      'create trigger %I before truncate on public.%I for each statement execute function public.forbid_modification()',
      t || '_no_truncate', t);
  end loop;
end;
$$;

-- Roles, usernames and activation can only change through trusted server code
-- (service role) -- never through a user JWT, even an admin's.
create or replace function public.protect_profiles()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'PROFILE_CHANGE_FORBIDDEN';
  end if;
  if tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'PROFILE_CHANGE_FORBIDDEN';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger profiles_protect before insert or update or delete on public.profiles
  for each row execute function public.protect_profiles();

create or replace function public.ensure_assignment_is_judge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.profiles where id = new.judge_id and role = 'judge') then
    raise exception 'NOT_A_JUDGE';
  end if;
  return new;
end;
$$;

create trigger judge_assignments_judge_role before insert or update on public.judge_assignments
  for each row execute function public.ensure_assignment_is_judge();
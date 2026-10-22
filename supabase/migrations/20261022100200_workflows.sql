-- =============================================================================
-- Workflows (part 1): audit logging, consequential-change guards, finalization
-- invalidation, score integrity and history.
--
-- Error convention: functions raise exceptions whose MESSAGE is a stable code
-- (e.g. SUBMISSION_LOCKED). The app maps codes to translated messages.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Audit
-- -----------------------------------------------------------------------------
create or replace function public.log_audit(
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_old jsonb default null,
  p_new jsonb default null,
  p_reason text default null,
  p_event_id uuid default null,
  p_group_id uuid default null,
  p_participant_id uuid default null,
  p_judge_id uuid default null,
  p_submission_id uuid default null,
  p_request_id uuid default null,
  p_metadata jsonb default '{}',
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := coalesce(p_actor_id, auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid);
  v_role text;
begin
  if v_actor is not null then
    select role::text into v_role from public.profiles where id = v_actor;
  end if;
  v_role := coalesce(
    v_role,
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_user
  );
  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, group_id, event_id,
    participant_id, judge_id, submission_id, request_id, old_value, new_value, reason, metadata
  ) values (
    v_actor, v_role, p_action, p_entity_type, p_entity_id, p_group_id, p_event_id,
    p_participant_id, p_judge_id, p_submission_id, p_request_id, p_old, p_new,
    nullif(btrim(p_reason), ''), coalesce(p_metadata, '{}')
  );
end;
$$;

create or replace function public.current_reason()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select nullif(btrim(coalesce(current_setting('app.reason', true), '')), '');
$$;

-- Generic row-change audit for configuration tables.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return new;
  end if;
  v_row := coalesce(v_new, v_old);

  perform public.log_audit(
    p_action => tg_table_name || '.' || lower(tg_op),
    p_entity_type => tg_table_name,
    p_entity_id => case when v_row ? 'id' then (v_row ->> 'id')::uuid end,
    p_old => v_old,
    p_new => v_new,
    p_reason => public.current_reason(),
    p_event_id => case when tg_table_name = 'events' then (v_row ->> 'id')::uuid
                       else (v_row ->> 'event_id')::uuid end,
    p_group_id => case when tg_table_name = 'groups' then (v_row ->> 'id')::uuid
                       else (v_row ->> 'group_id')::uuid end,
    p_participant_id => case when tg_table_name = 'participants' then (v_row ->> 'id')::uuid
                             else (v_row ->> 'participant_id')::uuid end,
    p_judge_id => case when tg_table_name = 'profiles' then (v_row ->> 'id')::uuid
                       else (v_row ->> 'judge_id')::uuid end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'groups', 'events', 'participants', 'event_participants',
    'judge_assignments', 'evaluation_criteria', 'app_settings'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t || '_audit', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Finalization invalidation (used by triggers and admin functions)
-- -----------------------------------------------------------------------------
create or replace function public.invalidate_finalization_internal(p_event_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.result_finalizations
     set status = 'invalidated',
         invalidated_by = auth.uid(),
         invalidated_at = now(),
         invalidation_reason = p_reason
   where event_id = p_event_id and status = 'active'
  returning id into v_id;
  if v_id is null then
    return false;
  end if;
  perform public.log_audit(
    p_action => 'results.invalidated',
    p_entity_type => 'result_finalization',
    p_entity_id => v_id,
    p_reason => p_reason,
    p_event_id => p_event_id
  );
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Consequential-change guards: once an event has marks, changes that affect
-- scoring need an explicit reason (set by the admin_* functions as app.reason).
-- -----------------------------------------------------------------------------
create or replace function public.event_has_scores(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.criterion_scores cs
    join public.submissions s on s.id = cs.submission_id
    where s.event_id = p_event_id
  );
$$;

create or replace function public.require_reason(p_what text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(char_length(public.current_reason()), 0) < 3 then
    raise exception 'CONFIRMATION_REQUIRED' using detail = p_what;
  end if;
end;
$$;

create or replace function public.guard_criteria_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event uuid := coalesce(new.event_id, old.event_id);
begin
  if tg_op = 'UPDATE' and new.event_id <> old.event_id then
    if public.event_has_scores(old.event_id) then
      raise exception 'CRITERION_EVENT_CHANGE_FORBIDDEN';
    end if;
  end if;

  if not public.event_has_scores(v_event) then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.max_marks = old.max_marks and new.is_active = old.is_active then
    -- name / description / order only: no effect on existing marks
    return new;
  end if;

  perform public.require_reason('criteria');

  if tg_op = 'UPDATE' and new.max_marks < old.max_marks and exists (
    select 1 from public.criterion_scores where criterion_id = new.id and value > new.max_marks
  ) then
    raise exception 'MAX_BELOW_EXISTING_SCORE';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger evaluation_criteria_guard before insert or update or delete on public.evaluation_criteria
  for each row execute function public.guard_criteria_change();

create or replace function public.guard_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.criterion_scores cs
               join public.submissions s on s.id = cs.submission_id
               where s.event_id = old.event_id and s.judge_id = old.judge_id) then
      raise exception 'ASSIGNMENT_HAS_SCORES';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.event_id <> old.event_id or new.judge_id <> old.judge_id) then
    raise exception 'ASSIGNMENT_IMMUTABLE';
  end if;
  if public.event_has_scores(new.event_id) and (tg_op = 'INSERT' or new.is_active <> old.is_active) then
    perform public.require_reason('assignment');
  end if;
  return new;
end;
$$;

create trigger judge_assignments_guard before insert or update or delete on public.judge_assignments
  for each row execute function public.guard_assignment_change();

create or replace function public.guard_event_participant_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and (new.event_id <> old.event_id or new.participant_id <> old.participant_id) then
    raise exception 'EVENT_PARTICIPANT_IMMUTABLE';
  end if;
  if public.event_has_scores(new.event_id) and (tg_op = 'INSERT' or new.is_active <> old.is_active) then
    perform public.require_reason('event_participant');
  end if;
  return new;
end;
$$;

create trigger event_participants_guard before insert or update on public.event_participants
  for each row execute function public.guard_event_participant_change();

create or replace function public.guard_participant_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_active <> old.is_active
     and exists (select 1 from public.criterion_scores where participant_id = new.id) then
    perform public.require_reason('participant');
  end if;
  return new;
end;
$$;

create trigger participants_guard before update on public.participants
  for each row execute function public.guard_participant_change();

create or replace function public.guard_event_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.event_has_scores(old.id) then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'EVENT_HAS_SCORES';
  end if;
  if new.group_id <> old.group_id or new.is_active <> old.is_active
     or new.score_precision <> old.score_precision then
    perform public.require_reason('event');
  end if;
  if new.score_precision < old.score_precision and exists (
    select 1 from public.criterion_scores cs
    join public.submissions s on s.id = cs.submission_id
    where s.event_id = new.id and cs.value <> round(cs.value, new.score_precision)
  ) then
    raise exception 'PRECISION_BELOW_EXISTING_SCORE';
  end if;
  return new;
end;
$$;

create trigger events_guard before update or delete on public.events
  for each row execute function public.guard_event_change();

-- Substantive configuration changes invalidate an existing finalization.
create or replace function public.invalidate_on_config_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event uuid;
begin
  if tg_table_name = 'evaluation_criteria' then
    if tg_op = 'UPDATE' and new.max_marks = old.max_marks and new.is_active = old.is_active then
      return new;
    end if;
    v_event := coalesce(new.event_id, old.event_id);
  elsif tg_table_name in ('judge_assignments', 'event_participants') then
    if tg_op = 'UPDATE' and new.is_active = old.is_active then
      return new;
    end if;
    v_event := coalesce(new.event_id, old.event_id);
  elsif tg_table_name = 'events' then
    if new.is_active = old.is_active and new.score_precision = old.score_precision then
      return new;
    end if;
    v_event := new.id;
  elsif tg_table_name = 'participants' then
    if new.is_active = old.is_active then
      return new;
    end if;
    for v_event in select event_id from public.event_participants where participant_id = new.id loop
      perform public.invalidate_finalization_internal(
        v_event, format('participants changed: %s', coalesce(public.current_reason(), '-')));
    end loop;
    return new;
  end if;
  perform public.invalidate_finalization_internal(
    v_event, format('%s changed: %s', tg_table_name, coalesce(public.current_reason(), '-')));
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['evaluation_criteria', 'judge_assignments', 'event_participants']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.invalidate_on_config_change()',
      t || '_invalidate_results', t);
  end loop;
  foreach t in array array['events', 'participants']
  loop
    execute format(
      'create trigger %I after update on public.%I for each row execute function public.invalidate_on_config_change()',
      t || '_invalidate_results', t);
  end loop;
end;
$$;

-- Every assignment gets exactly one submission record.
create or replace function public.ensure_submission_for_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.submissions (event_id, judge_id)
  values (new.event_id, new.judge_id)
  on conflict (event_id, judge_id) do nothing;
  return new;
end;
$$;

create trigger judge_assignments_submission after insert on public.judge_assignments
  for each row execute function public.ensure_submission_for_assignment();

-- -----------------------------------------------------------------------------
-- Score integrity: validation, lock enforcement, history. These run for every
-- write path, including functions, so a lock cannot be bypassed.
-- -----------------------------------------------------------------------------
create or replace function public.validate_score()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
  v_crit public.evaluation_criteria;
  v_precision smallint;
begin
  if tg_op = 'DELETE' then
    raise exception 'SCORE_DELETE_FORBIDDEN';
  end if;
  if tg_op = 'UPDATE' and (new.submission_id <> old.submission_id
       or new.participant_id <> old.participant_id
       or new.criterion_id <> old.criterion_id) then
    raise exception 'SCORE_KEY_IMMUTABLE';
  end if;

  select * into v_sub from public.submissions where id = new.submission_id;
  select * into v_crit from public.evaluation_criteria where id = new.criterion_id;
  if v_crit.event_id is distinct from v_sub.event_id then
    raise exception 'CRITERION_NOT_IN_EVENT';
  end if;
  if not exists (select 1 from public.event_participants
                 where event_id = v_sub.event_id and participant_id = new.participant_id) then
    raise exception 'PARTICIPANT_NOT_IN_EVENT';
  end if;

  if not public.is_editable_status(v_sub.status)
     and coalesce(current_setting('app.admin_override', true), '') <> 'on' then
    raise exception 'SUBMISSION_LOCKED';
  end if;

  if new.value is not null then
    select score_precision into v_precision from public.events where id = v_sub.event_id;
    if new.value < 0 or new.value > v_crit.max_marks then
      raise exception 'OUT_OF_RANGE';
    end if;
    if new.value <> round(new.value, v_precision) then
      raise exception 'PRECISION';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.version := case when new.value is distinct from old.value then old.version + 1 else old.version end;
  else
    new.version := 1;
  end if;
  return new;
end;
$$;

create trigger criterion_scores_validate before insert or update or delete on public.criterion_scores
  for each row execute function public.validate_score();

create trigger criterion_scores_no_truncate before truncate on public.criterion_scores
  for each statement execute function public.forbid_modification();

create or replace function public.record_score_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event uuid;
begin
  if tg_op = 'UPDATE' and new.value is not distinct from old.value then
    return new;
  end if;
  insert into public.score_history (
    score_id, submission_id, participant_id, criterion_id,
    old_value, new_value, old_version, new_version, source, reason, changed_by
  ) values (
    new.id, new.submission_id, new.participant_id, new.criterion_id,
    case when tg_op = 'UPDATE' then old.value end, new.value,
    case when tg_op = 'UPDATE' then old.version end, new.version,
    coalesce(nullif(current_setting('app.change_source', true), ''), 'system'),
    public.current_reason(),
    auth.uid()
  );
  select event_id into v_event from public.submissions where id = new.submission_id;
  perform public.invalidate_finalization_internal(
    v_event, format('Score changed: %s', coalesce(public.current_reason(), '-')));
  return new;
end;
$$;

create trigger criterion_scores_history after insert or update on public.criterion_scores
  for each row execute function public.record_score_history();

grant execute on function public.event_has_scores(uuid) to authenticated;
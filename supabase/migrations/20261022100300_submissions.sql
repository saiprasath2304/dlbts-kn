-- =============================================================================
-- Workflows (part 2): autosave, final submission, reopening and corrections,
-- admin score correction. All functions lock the submission row (FOR UPDATE),
-- so concurrent saves and submissions are serialised.
-- =============================================================================

create or replace function public.transition_submission(
  p_submission_id uuid,
  p_to public.submission_status,
  p_reason text default null,
  p_request_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from public.submission_status;
begin
  select status into v_from from public.submissions where id = p_submission_id;
  insert into public.submission_transitions (submission_id, from_status, to_status, actor_id, reason, request_id)
  values (p_submission_id, v_from, p_to, auth.uid(), nullif(btrim(p_reason), ''), p_request_id);
  update public.submissions set status = p_to, version = version + 1 where id = p_submission_id;
end;
$$;

create or replace function public.lock_own_submission(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
begin
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or v_sub.judge_id is distinct from auth.uid() or not public.is_assigned(v_sub.event_id) then
    raise exception 'NOT_FOUND';
  end if;
  return v_sub;
end;
$$;

create or replace function public.lock_submission_as_admin(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  return v_sub;
end;
$$;

-- Number of required (participant, criterion) marks still missing.
create or replace function public.submission_missing_count(p_submission_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.submissions s
  join public.event_participants ep on ep.event_id = s.event_id and ep.is_active
  join public.participants p on p.id = ep.participant_id and p.is_active
  join public.evaluation_criteria c on c.event_id = s.event_id and c.is_active
  where s.id = p_submission_id
    and (s.judge_id = auth.uid() or public.is_admin())
    and not exists (
      select 1 from public.criterion_scores cs
      where cs.submission_id = s.id and cs.participant_id = ep.participant_id
        and cs.criterion_id = c.id and cs.value is not null
    );
$$;

-- -----------------------------------------------------------------------------
-- Judge autosave.
--   p_changes: [{participant_id, criterion_id, value: number|null, base_version}]
--   base_version = version of the mark the client edited (0 if none).
--   Each change returns status saved | conflict | invalid. A conflict means the
--   server holds a different, newer mark; it is never silently overwritten.
-- -----------------------------------------------------------------------------
create or replace function public.save_scores(p_submission_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
  v_change jsonb;
  v_results jsonb := '[]'::jsonb;
  v_changed jsonb := '[]'::jsonb;
  v_participant uuid;
  v_criterion uuid;
  v_value numeric;
  v_base integer;
  v_existing public.criterion_scores;
  v_max numeric;
  v_precision smallint;
  v_new public.criterion_scores;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 1000 then
    raise exception 'INVALID_REQUEST';
  end if;

  v_sub := public.lock_own_submission(p_submission_id);
  if not public.is_editable_status(v_sub.status) then
    raise exception 'SUBMISSION_LOCKED';
  end if;

  select score_precision into v_precision from public.events where id = v_sub.event_id;
  perform set_config('app.change_source', 'judge', true);
  perform set_config('app.reason', '', true);

  for v_change in select value from jsonb_array_elements(p_changes) loop
    begin
      v_participant := (v_change ->> 'participant_id')::uuid;
      v_criterion := (v_change ->> 'criterion_id')::uuid;
      v_base := coalesce((v_change ->> 'base_version')::integer, 0);
      if jsonb_typeof(v_change -> 'value') = 'number' then
        v_value := (v_change ->> 'value')::numeric;
      elsif v_change -> 'value' is null or jsonb_typeof(v_change -> 'value') = 'null' then
        v_value := null;
      else
        raise exception 'bad value';
      end if;
    exception when others then
      v_results := v_results || jsonb_build_object(
        'participant_id', v_change ->> 'participant_id', 'criterion_id', v_change ->> 'criterion_id',
        'status', 'invalid', 'code', 'INVALID_VALUE');
      continue;
    end;

    select max_marks into v_max from public.evaluation_criteria
     where id = v_criterion and event_id = v_sub.event_id and is_active;
    if v_max is null or not exists (
      select 1 from public.event_participants ep
      join public.participants p on p.id = ep.participant_id
      where ep.event_id = v_sub.event_id and ep.participant_id = v_participant
        and ep.is_active and p.is_active
    ) then
      v_results := v_results || jsonb_build_object(
        'participant_id', v_participant, 'criterion_id', v_criterion,
        'status', 'invalid', 'code', 'NOT_IN_EVENT');
      continue;
    end if;

    if v_value is not null and (v_value < 0 or v_value > v_max) then
      v_results := v_results || jsonb_build_object(
        'participant_id', v_participant, 'criterion_id', v_criterion,
        'status', 'invalid', 'code', 'OUT_OF_RANGE');
      continue;
    end if;
    if v_value is not null and v_value <> round(v_value, v_precision) then
      v_results := v_results || jsonb_build_object(
        'participant_id', v_participant, 'criterion_id', v_criterion,
        'status', 'invalid', 'code', 'PRECISION');
      continue;
    end if;

    select * into v_existing from public.criterion_scores
     where submission_id = v_sub.id and participant_id = v_participant and criterion_id = v_criterion
     for update;

    if not found then
      insert into public.criterion_scores (submission_id, participant_id, criterion_id, value, updated_by)
      values (v_sub.id, v_participant, v_criterion, v_value, auth.uid())
      returning * into v_new;
      v_changed := v_changed || jsonb_build_object(
        'participant_id', v_participant, 'criterion_id', v_criterion, 'old', null, 'new', v_value);
      v_results := v_results || jsonb_build_object(
        'participant_id', v_participant, 'criterion_id', v_criterion,
        'status', 'saved', 'value', v_new.value, 'version', v_new.version);
    elsif v_existing.value is not distinct from v_value then
      v_results := v_results || jsonb_build_object(
        'participant_id', v_participant, 'criterion_id', v_criterion,
        'status', 'saved', 'value', v_existing.value, 'version', v_existing.version);
    elsif v_existing.version <> v_base then
      v_results := v_results || jsonb_build_object(
        'participant_id', v_participant, 'criterion_id', v_criterion,
        'status', 'conflict',
        'server_value', v_existing.value,
        'server_version', v_existing.version,
        'server_updated_at', v_existing.updated_at);
    else
      update public.criterion_scores set value = v_value, updated_by = auth.uid()
       where id = v_existing.id
      returning * into v_new;
      v_changed := v_changed || jsonb_build_object(
        'participant_id', v_participant, 'criterion_id', v_criterion,
        'old', v_existing.value, 'new', v_value);
      v_results := v_results || jsonb_build_object(
        'participant_id', v_participant, 'criterion_id', v_criterion,
        'status', 'saved', 'value', v_new.value, 'version', v_new.version);
    end if;
  end loop;

  if jsonb_array_length(v_changed) > 0 then
    if v_sub.status = 'not_started' then
      perform public.transition_submission(v_sub.id, 'in_progress');
    end if;
    update public.submissions set version = version + 1, last_saved_at = now() where id = v_sub.id;
    perform public.log_audit(
      p_action => 'scores.saved', p_entity_type => 'submission', p_entity_id => v_sub.id,
      p_new => v_changed, p_event_id => v_sub.event_id, p_judge_id => v_sub.judge_id,
      p_submission_id => v_sub.id);
  end if;

  select * into v_sub from public.submissions where id = v_sub.id;
  return jsonb_build_object(
    'submission_id', v_sub.id, 'status', v_sub.status, 'version', v_sub.version,
    'last_saved_at', v_sub.last_saved_at, 'results', v_results);
end;
$$;

-- -----------------------------------------------------------------------------
-- Judge final submission
-- -----------------------------------------------------------------------------
create or replace function public.submit_submission(p_submission_id uuid, p_expected_version integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
  v_missing integer;
  v_participants integer;
  v_criteria integer;
  v_to public.submission_status;
  v_scores jsonb;
  v_totals jsonb;
begin
  v_sub := public.lock_own_submission(p_submission_id);
  if not public.is_editable_status(v_sub.status) then
    raise exception 'SUBMISSION_LOCKED';
  end if;
  if p_expected_version is not null and v_sub.version <> p_expected_version then
    raise exception 'VERSION_CONFLICT';
  end if;

  select count(*) into v_participants
    from public.event_participants ep
    join public.participants p on p.id = ep.participant_id
   where ep.event_id = v_sub.event_id and ep.is_active and p.is_active;
  select count(*) into v_criteria
    from public.evaluation_criteria where event_id = v_sub.event_id and is_active;
  if v_participants = 0 or v_criteria = 0 then
    raise exception 'NOTHING_TO_SUBMIT';
  end if;

  v_missing := public.submission_missing_count(v_sub.id);
  if v_missing > 0 then
    raise exception 'INCOMPLETE' using detail = v_missing::text;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'participant_id', cs.participant_id, 'criterion_id', cs.criterion_id,
           'value', cs.value, 'version', cs.version) order by cs.participant_id, cs.criterion_id), '[]'::jsonb)
    into v_scores
    from public.criterion_scores cs
    join public.evaluation_criteria c on c.id = cs.criterion_id and c.is_active
   where cs.submission_id = v_sub.id;

  select coalesce(jsonb_object_agg(t.participant_id, t.total), '{}'::jsonb)
    into v_totals
    from (
      select cs.participant_id, sum(cs.value) as total
      from public.criterion_scores cs
      join public.evaluation_criteria c on c.id = cs.criterion_id and c.is_active
      join public.event_participants ep on ep.event_id = v_sub.event_id
           and ep.participant_id = cs.participant_id and ep.is_active
      where cs.submission_id = v_sub.id
      group by cs.participant_id
    ) t;

  v_to := case when v_sub.round = 0 then 'submitted'::public.submission_status
               else 'resubmitted'::public.submission_status end;

  insert into public.submission_rounds (submission_id, round, status, submitted_by, scores, totals)
  values (v_sub.id, v_sub.round + 1, v_to, auth.uid(), v_scores, v_totals);

  perform public.transition_submission(v_sub.id, v_to);
  update public.submissions
     set round = round + 1, submitted_at = now(), submitted_by = auth.uid()
   where id = v_sub.id
  returning * into v_sub;

  update public.correction_requests
     set status = 'responded', responded_at = coalesce(responded_at, now())
   where submission_id = v_sub.id and status = 'open';

  perform public.log_audit(
    p_action => 'submission.' || v_to::text, p_entity_type => 'submission', p_entity_id => v_sub.id,
    p_new => jsonb_build_object('round', v_sub.round, 'totals', v_totals),
    p_event_id => v_sub.event_id, p_judge_id => v_sub.judge_id, p_submission_id => v_sub.id);

  return jsonb_build_object(
    'submission_id', v_sub.id, 'status', v_sub.status, 'round', v_sub.round,
    'submitted_at', v_sub.submitted_at, 'participant_count', v_participants,
    'criteria_count', v_criteria);
end;
$$;
-- -----------------------------------------------------------------------------
-- Reopening requests
-- -----------------------------------------------------------------------------
create or replace function public.request_reopening(p_submission_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
  v_id uuid;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  v_sub := public.lock_own_submission(p_submission_id);
  if v_sub.status not in ('submitted', 'resubmitted') then
    raise exception 'INVALID_STATE';
  end if;
  insert into public.reopening_requests (submission_id, requested_by, reason, previous_status)
  values (v_sub.id, auth.uid(), btrim(p_reason), v_sub.status)
  returning id into v_id;
  perform public.transition_submission(v_sub.id, 'reopening_requested', p_reason, v_id);
  perform public.log_audit(
    p_action => 'reopening.requested', p_entity_type => 'reopening_request', p_entity_id => v_id,
    p_reason => p_reason, p_event_id => v_sub.event_id, p_judge_id => v_sub.judge_id,
    p_submission_id => v_sub.id, p_request_id => v_id);
  return v_id;
end;
$$;

create or replace function public.resolve_reopening_request(p_request_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.reopening_requests;
  v_sub public.submissions;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_req from public.reopening_requests where id = p_request_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'INVALID_STATE';
  end if;
  v_sub := public.lock_submission_as_admin(v_req.submission_id);

  update public.reopening_requests
     set status = case when p_approve then 'approved'::public.request_status
                       else 'rejected'::public.request_status end,
         resolved_by = auth.uid(), resolved_at = now(), resolution_note = nullif(btrim(p_note), '')
   where id = v_req.id;

  if p_approve then
    perform public.transition_submission(
      v_sub.id, 'reopened', coalesce(nullif(btrim(p_note), ''), v_req.reason), v_req.id);
    perform public.invalidate_finalization_internal(v_sub.event_id, 'Submission reopened: ' || v_req.reason);
  elsif v_sub.status = 'reopening_requested' then
    perform public.transition_submission(v_sub.id, v_req.previous_status, p_note, v_req.id);
  end if;

  perform public.log_audit(
    p_action => case when p_approve then 'reopening.approved' else 'reopening.rejected' end,
    p_entity_type => 'reopening_request', p_entity_id => v_req.id,
    p_reason => coalesce(nullif(btrim(p_note), ''), v_req.reason),
    p_event_id => v_sub.event_id, p_judge_id => v_sub.judge_id,
    p_submission_id => v_sub.id, p_request_id => v_req.id);
end;
$$;

create or replace function public.admin_reopen_submission(p_submission_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  v_sub := public.lock_submission_as_admin(p_submission_id);
  if v_sub.status not in ('submitted', 'resubmitted', 'reopening_requested') then
    raise exception 'INVALID_STATE';
  end if;
  update public.reopening_requests
     set status = 'approved', resolved_by = auth.uid(), resolved_at = now(),
         resolution_note = 'Reopened by admin: ' || btrim(p_reason)
   where submission_id = v_sub.id and status = 'pending';
  perform public.transition_submission(v_sub.id, 'reopened', p_reason);
  perform public.invalidate_finalization_internal(v_sub.event_id, 'Submission reopened: ' || p_reason);
  perform public.log_audit(
    p_action => 'submission.reopened_by_admin', p_entity_type => 'submission', p_entity_id => v_sub.id,
    p_reason => p_reason, p_event_id => v_sub.event_id, p_judge_id => v_sub.judge_id,
    p_submission_id => v_sub.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Correction requests
-- -----------------------------------------------------------------------------
create or replace function public.create_correction_request(
  p_submission_id uuid,
  p_participant_id uuid,
  p_criterion_ids uuid[],
  p_message text,
  p_unlock boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
  v_id uuid;
begin
  if p_message is null or char_length(btrim(p_message)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  v_sub := public.lock_submission_as_admin(p_submission_id);
  if p_participant_id is not null and not exists (
    select 1 from public.event_participants
    where event_id = v_sub.event_id and participant_id = p_participant_id
  ) then
    raise exception 'PARTICIPANT_NOT_IN_EVENT';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_criterion_ids, '{}')) cid
    where not exists (select 1 from public.evaluation_criteria c where c.id = cid and c.event_id = v_sub.event_id)
  ) then
    raise exception 'CRITERION_NOT_IN_EVENT';
  end if;

  insert into public.correction_requests (
    submission_id, event_id, participant_id, criterion_ids, message, unlocks_submission, created_by
  ) values (
    v_sub.id, v_sub.event_id, p_participant_id, coalesce(p_criterion_ids, '{}'), btrim(p_message),
    coalesce(p_unlock, false), auth.uid()
  ) returning id into v_id;

  if coalesce(p_unlock, false) and v_sub.status in ('submitted', 'resubmitted', 'reopening_requested') then
    update public.reopening_requests
       set status = 'approved', resolved_by = auth.uid(), resolved_at = now(),
           resolution_note = 'Superseded by correction request'
     where submission_id = v_sub.id and status = 'pending';
    perform public.transition_submission(v_sub.id, 'correction_requested', p_message, v_id);
    perform public.invalidate_finalization_internal(v_sub.event_id, 'Correction requested: ' || p_message);
  end if;

  perform public.log_audit(
    p_action => 'correction.requested', p_entity_type => 'correction_request', p_entity_id => v_id,
    p_new => jsonb_build_object('criterion_ids', p_criterion_ids, 'unlock', p_unlock),
    p_reason => p_message, p_event_id => v_sub.event_id, p_participant_id => p_participant_id,
    p_judge_id => v_sub.judge_id, p_submission_id => v_sub.id, p_request_id => v_id);
  return v_id;
end;
$$;

create or replace function public.respond_correction_request(p_request_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.correction_requests;
  v_sub public.submissions;
begin
  if p_response is null or char_length(btrim(p_response)) < 1 then
    raise exception 'REASON_REQUIRED';
  end if;
  select * into v_req from public.correction_requests where id = p_request_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  v_sub := public.lock_own_submission(v_req.submission_id);
  if v_req.status not in ('open', 'responded') then
    raise exception 'INVALID_STATE';
  end if;
  update public.correction_requests
     set judge_response = btrim(p_response), responded_at = now(), status = 'responded'
   where id = v_req.id;
  perform public.log_audit(
    p_action => 'correction.responded', p_entity_type => 'correction_request', p_entity_id => v_req.id,
    p_new => jsonb_build_object('response', btrim(p_response)),
    p_event_id => v_sub.event_id, p_participant_id => v_req.participant_id,
    p_judge_id => v_sub.judge_id, p_submission_id => v_sub.id, p_request_id => v_req.id);
end;
$$;

create or replace function public.resolve_correction_request(p_request_id uuid, p_note text, p_cancel boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.correction_requests;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_req from public.correction_requests where id = p_request_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_req.status in ('resolved', 'cancelled') then
    raise exception 'INVALID_STATE';
  end if;
  update public.correction_requests
     set status = case when p_cancel then 'cancelled'::public.correction_status
                       else 'resolved'::public.correction_status end,
         resolved_by = auth.uid(), resolved_at = now(), resolution_note = nullif(btrim(p_note), '')
   where id = v_req.id;
  perform public.log_audit(
    p_action => case when p_cancel then 'correction.cancelled' else 'correction.resolved' end,
    p_entity_type => 'correction_request', p_entity_id => v_req.id, p_reason => p_note,
    p_event_id => v_req.event_id, p_participant_id => v_req.participant_id,
    p_submission_id => v_req.submission_id, p_request_id => v_req.id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin score correction: mandatory reason, audited, submission stays locked,
-- any finalization of the event is invalidated (score trigger).
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_score(
  p_submission_id uuid,
  p_participant_id uuid,
  p_criterion_id uuid,
  p_value numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
  v_old numeric;
  v_new public.criterion_scores;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  v_sub := public.lock_submission_as_admin(p_submission_id);

  perform set_config('app.admin_override', 'on', true);
  perform set_config('app.change_source', 'admin', true);
  perform set_config('app.reason', btrim(p_reason), true);

  select value into v_old from public.criterion_scores
   where submission_id = v_sub.id and participant_id = p_participant_id and criterion_id = p_criterion_id
   for update;

  insert into public.criterion_scores (submission_id, participant_id, criterion_id, value, updated_by)
  values (v_sub.id, p_participant_id, p_criterion_id, p_value, auth.uid())
  on conflict (submission_id, participant_id, criterion_id)
  do update set value = excluded.value, updated_by = excluded.updated_by
  returning * into v_new;

  update public.submissions set version = version + 1, last_saved_at = now() where id = v_sub.id;
  perform set_config('app.admin_override', '', true);

  perform public.log_audit(
    p_action => 'score.admin_corrected', p_entity_type => 'criterion_score', p_entity_id => v_new.id,
    p_old => jsonb_build_object('value', v_old), p_new => jsonb_build_object('value', v_new.value),
    p_reason => p_reason, p_event_id => v_sub.event_id, p_participant_id => p_participant_id,
    p_judge_id => v_sub.judge_id, p_submission_id => v_sub.id,
    p_metadata => jsonb_build_object('criterion_id', p_criterion_id));
  return jsonb_build_object('value', v_new.value, 'version', v_new.version);
end;
$$;

grant execute on function
  public.save_scores(uuid, jsonb),
  public.submit_submission(uuid, integer),
  public.request_reopening(uuid, text),
  public.resolve_reopening_request(uuid, boolean, text),
  public.admin_reopen_submission(uuid, text),
  public.create_correction_request(uuid, uuid, uuid[], text, boolean),
  public.respond_correction_request(uuid, text),
  public.resolve_correction_request(uuid, text, boolean),
  public.admin_set_score(uuid, uuid, uuid, numeric, text),
  public.submission_missing_count(uuid)
to authenticated;
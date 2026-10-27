-- RUN THIS ONCE in Supabase -> SQL Editor (after 03_update_2026-10-26_judge_features.sql).
-- Adds: participant DOB + "DOB verified", individual/team event type, the common "marking lock".
-- NOTE: marking starts LOCKED. Open it from the admin Dashboard when judging begins.
-- Safe to run again if it fails part-way.

-- =============================================================================
-- 2026-10-27: DOB + DOB verified, individual / team events, global marking lock
--   * participants.dob, dob_verified, dob_verified_at, dob_verified_by
--   * events.participation  'individual' | 'team'
--   * app_settings 'scoring_open' (false = judges cannot enter marks yet)
--   * set_dob_verified()  judges (assigned to one of the child's events) or admins
--   * admin_set_scoring_open()
--   * save_scores / save_remark / submit_submission refuse while marking is locked
-- Safe to run more than once.
-- =============================================================================

alter table public.participants add column if not exists dob date;
alter table public.participants add column if not exists dob_verified boolean not null default false;
alter table public.participants add column if not exists dob_verified_at timestamptz;
alter table public.participants add column if not exists dob_verified_by uuid references public.profiles (id);

alter table public.events add column if not exists participation text not null default 'individual';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_participation_check') then
    alter table public.events add constraint events_participation_check check (participation in ('individual', 'team'));
  end if;
end;
$$;

-- Existing team events: everything in the Team Events / Group Events groups, plus Dumb Charades.
update public.events e set participation = 'team'
  from public.groups g
 where g.id = e.group_id and e.participation = 'individual'
   and (g.code in ('team', 'gevent') or e.code = 'charades');

-- Marking starts locked; the admin opens it from the dashboard.
insert into public.app_settings (key, value) values ('scoring_open', 'false') on conflict (key) do nothing;

create or replace function public.scoring_is_open()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'scoring_open'), false);
$$;

create or replace function public.admin_set_scoring_open(p_open boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  insert into public.app_settings (key, value, updated_by)
  values ('scoring_open', to_jsonb(coalesce(p_open, false)), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by;
  perform public.log_audit(p_action => case when p_open then 'scoring.opened' else 'scoring.locked' end, p_entity_type => 'system');
  return coalesce(p_open, false);
end;
$$;

create or replace function public.set_dob_verified(p_participant_id uuid, p_verified boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p public.participants;
begin
  if not (public.is_admin() or exists (
    select 1 from public.event_participants ep
    where ep.participant_id = p_participant_id and ep.is_active and public.is_assigned(ep.event_id)
  )) then
    raise exception 'FORBIDDEN';
  end if;
  update public.participants
     set dob_verified = coalesce(p_verified, false),
         dob_verified_at = case when p_verified then now() end,
         dob_verified_by = case when p_verified then auth.uid() end
   where id = p_participant_id
  returning * into v_p;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  return jsonb_build_object(
    'verified', v_p.dob_verified,
    'at', v_p.dob_verified_at,
    'by', (select display_name from public.profiles where id = v_p.dob_verified_by));
end;
$$;

-- Context for judges now also returns DOB-verified details.
drop function if exists public.event_participant_context(uuid);
create or replace function public.event_participant_context(p_event_id uuid)
returns table (
  participant_id uuid,
  other_events jsonb,
  memento_given boolean,
  memento_given_at timestamptz,
  memento_given_by_name text,
  dob_verified boolean,
  dob_verified_at timestamptz,
  dob_verified_by_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
         coalesce((
           select jsonb_agg(jsonb_build_object('event_id', e.id, 'name', e.name, 'group', g.name, 'venue', e.venue)
                            order by g.display_order, e.display_order, e.name)
           from public.event_participants ep2
           join public.events e on e.id = ep2.event_id and e.is_active
           join public.groups g on g.id = e.group_id
           where ep2.participant_id = p.id and ep2.is_active and ep2.event_id <> p_event_id
         ), '[]'::jsonb),
         p.memento_given, p.memento_given_at, pm.display_name,
         p.dob_verified, p.dob_verified_at, pd.display_name
  from public.event_participants ep
  join public.participants p on p.id = ep.participant_id and p.is_active
  left join public.profiles pm on pm.id = p.memento_given_by
  left join public.profiles pd on pd.id = p.dob_verified_by
  where ep.event_id = p_event_id and ep.is_active
    and (public.is_admin() or public.is_assigned(p_event_id));
$$;

-- Events: participation type
drop function if exists public.admin_save_event(uuid, uuid, text, text, text, text, smallint, integer, boolean, text, text);
create or replace function public.admin_save_event(
  p_id uuid,
  p_group_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_instructions text,
  p_score_precision smallint,
  p_display_order integer,
  p_is_active boolean,
  p_reason text default null,
  p_venue text default null,
  p_participation text default 'individual'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_part text := case when p_participation = 'team' then 'team' else 'individual' end;
begin
  perform public.assert_admin();
  perform public.apply_reason(p_reason);
  if p_id is null then
    insert into public.events (group_id, code, name, description, instructions, score_precision, display_order, is_active, venue, participation)
    values (p_group_id, lower(btrim(p_code)), btrim(p_name), nullif(btrim(p_description), ''),
            nullif(btrim(p_instructions), ''), p_score_precision, coalesce(p_display_order, 0), coalesce(p_is_active, true),
            nullif(btrim(p_venue), ''), v_part)
    returning id into v_id;
  else
    update public.events
       set group_id = p_group_id, code = lower(btrim(p_code)), name = btrim(p_name),
           description = nullif(btrim(p_description), ''), instructions = nullif(btrim(p_instructions), ''),
           score_precision = p_score_precision, display_order = coalesce(p_display_order, 0),
           is_active = coalesce(p_is_active, true), venue = nullif(btrim(p_venue), ''), participation = v_part
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return v_id;
end;
$$;

-- Judges see participant codes only: tie alerts no longer return names.
create or replace function public.event_tie_alerts(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not (public.is_admin() or public.is_assigned(p_event_id)) then
    raise exception 'FORBIDDEN';
  end if;

  with req as (
    select s.id as submission_id
    from public.judge_assignments a
    join public.profiles pr on pr.id = a.judge_id and pr.is_active and pr.role = 'judge'
    join public.submissions s on s.event_id = a.event_id and s.judge_id = a.judge_id
    where a.event_id = p_event_id and a.is_active
  ),
  crit as (
    select id from public.evaluation_criteria where event_id = p_event_id and is_active
  ),
  ep as (
    select p.id, p.code, coalesce(nullif(p.registration_no, ''), p.code) as label,
           case when public.is_admin() then p.name else coalesce(nullif(p.registration_no, ''), p.code) end as name
    from public.event_participants e
    join public.participants p on p.id = e.participant_id and p.is_active
    where e.event_id = p_event_id and e.is_active
  ),
  marks as (
    select cs.participant_id, count(cs.value) as filled, sum(cs.value) as total
    from public.criterion_scores cs
    join req on req.submission_id = cs.submission_id
    join crit on crit.id = cs.criterion_id
    group by cs.participant_id
  ),
  complete as (
    select ep.id, ep.name, ep.code, m.total
    from ep join marks m on m.participant_id = ep.id
    where m.filled = (select count(*) from req) * (select count(*) from crit)
      and (select count(*) from req) > 0 and (select count(*) from crit) > 0
  ),
  ranked as (
    select c.*, rank() over (order by c.total desc) as rnk, count(*) over (partition by c.total) as n
    from complete c
  ),
  groups_ as (
    select min(rnk) as place,
           jsonb_agg(jsonb_build_object('participant_id', id, 'name', name, 'code', code) order by code) as participants
    from ranked
    where n > 1
    group by total
    having min(rnk) <= 3
  )
  select coalesce(jsonb_agg(jsonb_build_object('place', place, 'participants', participants) order by place), '[]'::jsonb)
    into v_result
    from groups_;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Marking lock enforced inside the judge write functions
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
  if not public.scoring_is_open() then
    raise exception 'SCORING_LOCKED';
  end if;
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
  if not public.scoring_is_open() then
    raise exception 'SCORING_LOCKED';
  end if;
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

create or replace function public.save_remark(p_submission_id uuid, p_participant_id uuid, p_remark text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.submissions;
  v_row public.participant_remarks;
begin
  if char_length(coalesce(p_remark, '')) > 2000 then
    raise exception 'INVALID_REQUEST';
  end if;
  v_sub := public.lock_own_submission(p_submission_id);
  if not public.scoring_is_open() then
    raise exception 'SCORING_LOCKED';
  end if;
  if not public.is_editable_status(v_sub.status) then
    raise exception 'SUBMISSION_LOCKED';
  end if;
  if not exists (
    select 1 from public.event_participants ep
    where ep.event_id = v_sub.event_id and ep.participant_id = p_participant_id and ep.is_active
  ) then
    raise exception 'PARTICIPANT_NOT_IN_EVENT';
  end if;
  insert into public.participant_remarks (submission_id, participant_id, remark, updated_by)
  values (v_sub.id, p_participant_id, btrim(coalesce(p_remark, '')), auth.uid())
  on conflict (submission_id, participant_id)
  do update set remark = excluded.remark, updated_by = excluded.updated_by
  returning * into v_row;
  return jsonb_build_object('participant_id', p_participant_id, 'remark', v_row.remark, 'updated_at', v_row.updated_at);
end;
$$;

-- Import: optional dob column (YYYY-MM-DD)
create or replace function public.admin_import_participants(
  p_rows jsonb, p_source text default null, p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r jsonb;
  v_row integer;
  v_code text;
  v_name text;
  v_kind text;
  v_group uuid;
  v_event uuid;
  v_existing public.participants;
  v_pid uuid;
  v_link public.event_participants;
  v_errors jsonb := '[]'::jsonb;
  v_created integer := 0;
  v_linked integer := 0;
  v_already integer := 0;
begin
  perform public.assert_admin();
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_REQUEST';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'IMPORT_TOO_LARGE';
  end if;
  perform public.apply_reason(p_reason);

  for r in select value from jsonb_array_elements(p_rows) loop
    v_row := coalesce((r ->> 'row')::integer, 0);
    v_code := upper(btrim(coalesce(r ->> 'code', '')));
    v_name := btrim(coalesce(r ->> 'name', ''));
    v_kind := lower(coalesce(nullif(btrim(r ->> 'kind'), ''), 'individual'));
    v_group := null;
    v_event := null;

    if v_code !~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$' then
      v_errors := v_errors || jsonb_build_object('row', v_row, 'field', 'code', 'code', 'INVALID_CODE');
      continue;
    end if;
    if v_name = '' or char_length(v_name) > 200 then
      v_errors := v_errors || jsonb_build_object('row', v_row, 'field', 'name', 'code', 'INVALID_NAME');
      continue;
    end if;
    if v_kind not in ('individual', 'team') then
      v_errors := v_errors || jsonb_build_object('row', v_row, 'field', 'kind', 'code', 'INVALID_KIND');
      continue;
    end if;
    select id into v_group from public.groups where code = lower(btrim(coalesce(r ->> 'group_code', '')));
    if v_group is null then
      v_errors := v_errors || jsonb_build_object('row', v_row, 'field', 'group_code', 'code', 'UNKNOWN_GROUP');
      continue;
    end if;
    if coalesce(btrim(r ->> 'event_code'), '') <> '' then
      select id into v_event from public.events
       where group_id = v_group and code = lower(btrim(r ->> 'event_code'));
      if v_event is null then
        v_errors := v_errors || jsonb_build_object('row', v_row, 'field', 'event_code', 'code', 'UNKNOWN_EVENT');
        continue;
      end if;
    end if;

    select * into v_existing from public.participants where code = v_code;
    if found then
      if lower(btrim(v_existing.name)) <> lower(v_name) then
        v_errors := v_errors || jsonb_build_object('row', v_row, 'field', 'code', 'code', 'CODE_USED_BY_OTHER_NAME',
                                                   'existing_name', v_existing.name);
        continue;
      end if;
      if v_existing.group_id is distinct from v_group then
        v_errors := v_errors || jsonb_build_object('row', v_row, 'field', 'group_code', 'code', 'GROUP_MISMATCH');
        continue;
      end if;
      v_pid := v_existing.id;
    else
      insert into public.participants (code, name, kind, group_id, affiliation, registration_no, notes, members, dob)
      values (v_code, v_name, v_kind::public.participant_kind, v_group,
              nullif(btrim(r ->> 'affiliation'), ''), nullif(btrim(r ->> 'registration_no'), ''),
              nullif(btrim(r ->> 'notes'), ''), nullif(btrim(r ->> 'members'), ''),
              case when coalesce(r ->> 'dob', '') ~ '^\d{4}-\d{2}-\d{2}$' then (r ->> 'dob')::date end)
      returning id into v_pid;
      v_created := v_created + 1;
    end if;

    if v_event is not null then
      select * into v_link from public.event_participants where event_id = v_event and participant_id = v_pid;
      if not found then
        insert into public.event_participants (event_id, participant_id) values (v_event, v_pid);
        v_linked := v_linked + 1;
      elsif not v_link.is_active then
        update public.event_participants set is_active = true where id = v_link.id;
        v_linked := v_linked + 1;
      else
        v_already := v_already + 1;
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'IMPORT_INVALID' using detail = v_errors::text;
  end if;

  perform public.log_audit(
    p_action => 'participants.imported', p_entity_type => 'participant_import',
    p_new => jsonb_build_object('created', v_created, 'linked', v_linked, 'already_linked', v_already,
                                'rows', jsonb_array_length(p_rows)),
    p_reason => p_reason, p_metadata => jsonb_build_object('source', p_source));

  return jsonb_build_object('created', v_created, 'linked', v_linked, 'already_linked', v_already,
                            'rows', jsonb_array_length(p_rows));
end;
$$;


-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke execute on function
  public.scoring_is_open(),
  public.admin_set_scoring_open(boolean),
  public.set_dob_verified(uuid, boolean),
  public.event_participant_context(uuid),
  public.admin_save_event(uuid, uuid, text, text, text, text, smallint, integer, boolean, text, text, text)
from public, anon;

grant execute on function
  public.scoring_is_open(),
  public.admin_set_scoring_open(boolean),
  public.set_dob_verified(uuid, boolean),
  public.event_participant_context(uuid),
  public.event_tie_alerts(uuid),
  public.admin_save_event(uuid, uuid, text, text, text, text, smallint, integer, boolean, text, text, text),
  public.save_scores(uuid, jsonb),
  public.submit_submission(uuid, integer),
  public.save_remark(uuid, uuid, text),
  public.admin_import_participants(jsonb, text, text)
to authenticated;
-- =============================================================================
-- Judge features (2026-10-26)
--   * events.venue                      room / location shown to judges
--   * participants.members              team member names (team events)
--   * participants.memento_*            memento given tracking (shared by all judges)
--   * participant_remarks               judge feedback per participant
--   * participant_requests              judge -> admin add / change / remove requests
--   * event_participant_context()       other events + memento for an event's participants
--   * event_tie_alerts()                provisional ties among the top 3 during judging
-- Safe to run more than once.
-- =============================================================================

alter table public.events add column if not exists venue text;
alter table public.participants add column if not exists members text;
alter table public.participants add column if not exists memento_given boolean not null default false;
alter table public.participants add column if not exists memento_given_at timestamptz;
alter table public.participants add column if not exists memento_given_by uuid references public.profiles (id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_venue_len') then
    alter table public.events add constraint events_venue_len check (char_length(venue) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'participants_members_len') then
    alter table public.participants add constraint participants_members_len check (char_length(members) <= 1000);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Judge remarks / feedback
-- -----------------------------------------------------------------------------
create table if not exists public.participant_remarks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete restrict,
  participant_id uuid not null references public.participants (id) on delete restrict,
  remark text not null default '' check (char_length(remark) <= 2000),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, participant_id)
);
create index if not exists participant_remarks_participant_idx on public.participant_remarks (participant_id);
drop trigger if exists participant_remarks_updated_at on public.participant_remarks;
create trigger participant_remarks_updated_at before update on public.participant_remarks
  for each row execute function public.set_updated_at();

alter table public.participant_remarks enable row level security;
drop policy if exists participant_remarks_read on public.participant_remarks;
create policy participant_remarks_read on public.participant_remarks for select to authenticated
  using ((select public.is_admin()) or public.owns_submission(submission_id));
revoke all on public.participant_remarks from anon;
grant select on public.participant_remarks to authenticated;

-- -----------------------------------------------------------------------------
-- Participant requests (judge -> admin)
-- -----------------------------------------------------------------------------
create table if not exists public.participant_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  requested_by uuid not null references public.profiles (id),
  request_type text not null check (request_type in ('add', 'change', 'remove')),
  participant_id uuid references public.participants (id) on delete set null,
  name text check (char_length(name) <= 200),
  details text not null check (char_length(btrim(details)) between 3 and 2000),
  status public.request_status not null default 'pending',
  created_participant_id uuid references public.participants (id) on delete set null,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists participant_requests_event_idx on public.participant_requests (event_id);
drop trigger if exists participant_requests_updated_at on public.participant_requests;
create trigger participant_requests_updated_at before update on public.participant_requests
  for each row execute function public.set_updated_at();

alter table public.participant_requests enable row level security;
drop policy if exists participant_requests_read on public.participant_requests;
create policy participant_requests_read on public.participant_requests for select to authenticated
  using ((select public.is_admin()) or (requested_by = (select auth.uid()) and public.is_assigned(event_id)));
revoke all on public.participant_requests from anon;
grant select on public.participant_requests to authenticated;

-- -----------------------------------------------------------------------------
-- Remarks: judges save while their submission is editable
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Memento: any judge assigned to one of the participant's events (or an admin)
-- -----------------------------------------------------------------------------
create or replace function public.set_memento(p_participant_id uuid, p_given boolean)
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
     set memento_given = coalesce(p_given, false),
         memento_given_at = case when p_given then now() end,
         memento_given_by = case when p_given then auth.uid() end
   where id = p_participant_id
  returning * into v_p;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  return jsonb_build_object(
    'given', v_p.memento_given,
    'at', v_p.memento_given_at,
    'by', (select display_name from public.profiles where id = v_p.memento_given_by));
end;
$$;

-- -----------------------------------------------------------------------------
-- Other events + memento for every participant of an event (judge or admin)
-- -----------------------------------------------------------------------------
create or replace function public.event_participant_context(p_event_id uuid)
returns table (
  participant_id uuid,
  other_events jsonb,
  memento_given boolean,
  memento_given_at timestamptz,
  memento_given_by_name text
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
         p.memento_given, p.memento_given_at, pr.display_name
  from public.event_participants ep
  join public.participants p on p.id = ep.participant_id and p.is_active
  left join public.profiles pr on pr.id = p.memento_given_by
  where ep.event_id = p_event_id and ep.is_active
    and (public.is_admin() or public.is_assigned(p_event_id));
$$;

-- -----------------------------------------------------------------------------
-- Provisional ties during judging. Considers participants whose marks are
-- complete from every required judge, ranks them by combined score and returns
-- groups that share a combined score within the top 3 places. Scores are NOT
-- returned, so judges never see each other's marks.
-- -----------------------------------------------------------------------------
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
    select p.id, p.name, p.code
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
-- Participant requests
-- -----------------------------------------------------------------------------
create or replace function public.request_participant_change(
  p_event_id uuid,
  p_type text,
  p_participant_id uuid,
  p_name text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_assigned(p_event_id) then
    raise exception 'NOT_FOUND';
  end if;
  if p_type not in ('add', 'change', 'remove') then
    raise exception 'INVALID_REQUEST';
  end if;
  if p_details is null or char_length(btrim(p_details)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_type = 'add' and coalesce(btrim(p_name), '') = '' then
    raise exception 'INVALID_REQUEST';
  end if;
  if p_type <> 'add' and not exists (
    select 1 from public.event_participants where event_id = p_event_id and participant_id = p_participant_id
  ) then
    raise exception 'PARTICIPANT_NOT_IN_EVENT';
  end if;
  insert into public.participant_requests (event_id, requested_by, request_type, participant_id, name, details)
  values (p_event_id, auth.uid(), p_type, case when p_type = 'add' then null else p_participant_id end,
          nullif(btrim(p_name), ''), btrim(p_details))
  returning id into v_id;
  perform public.log_audit(
    p_action => 'participant_request.created', p_entity_type => 'participant_request', p_entity_id => v_id,
    p_new => jsonb_build_object('type', p_type, 'name', p_name), p_reason => p_details,
    p_event_id => p_event_id, p_participant_id => p_participant_id, p_judge_id => auth.uid(), p_request_id => v_id);
  return v_id;
end;
$$;

-- Admin decision. For "add" + approve, creates the participant and adds it to the event.
-- For "remove" + approve, removes the participant from the event.
-- For "change" + approve, the admin makes the edit themselves; this records the decision.
create or replace function public.resolve_participant_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text,
  p_code text default null,
  p_name text default null,
  p_kind text default 'individual',
  p_affiliation text default null,
  p_members text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_req public.participant_requests;
  v_group uuid;
  v_pid uuid;
  v_reason text;
begin
  perform public.assert_admin();
  select * into v_req from public.participant_requests where id = p_request_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'INVALID_STATE';
  end if;
  v_reason := 'Judge request: ' || v_req.details;

  if p_approve and v_req.request_type = 'add' then
    if coalesce(btrim(p_code), '') = '' or coalesce(btrim(p_name), '') = '' then
      raise exception 'INVALID_REQUEST';
    end if;
    select group_id into v_group from public.events where id = v_req.event_id;
    insert into public.participants (code, name, kind, group_id, affiliation, members)
    values (upper(btrim(p_code)), btrim(p_name),
            (case when p_kind = 'team' then 'team' else 'individual' end)::public.participant_kind,
            v_group, nullif(btrim(p_affiliation), ''), nullif(btrim(p_members), ''))
    returning id into v_pid;
    perform public.admin_set_event_participant(v_req.event_id, v_pid, true, v_reason);
  elsif p_approve and v_req.request_type = 'remove' and v_req.participant_id is not null then
    perform public.admin_set_event_participant(v_req.event_id, v_req.participant_id, false, v_reason);
  end if;

  update public.participant_requests
     set status = case when p_approve then 'approved'::public.request_status else 'rejected'::public.request_status end,
         resolved_by = auth.uid(), resolved_at = now(),
         resolution_note = nullif(btrim(p_note), ''),
         created_participant_id = v_pid
   where id = v_req.id;

  perform public.log_audit(
    p_action => case when p_approve then 'participant_request.approved' else 'participant_request.rejected' end,
    p_entity_type => 'participant_request', p_entity_id => v_req.id, p_reason => coalesce(nullif(btrim(p_note), ''), v_req.details),
    p_event_id => v_req.event_id, p_participant_id => coalesce(v_pid, v_req.participant_id),
    p_judge_id => v_req.requested_by, p_request_id => v_req.id);
  return v_pid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Events: venue
-- -----------------------------------------------------------------------------
drop function if exists public.admin_save_event(uuid, uuid, text, text, text, text, smallint, integer, boolean, text);
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
  p_venue text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  perform public.assert_admin();
  perform public.apply_reason(p_reason);
  if p_id is null then
    insert into public.events (group_id, code, name, description, instructions, score_precision, display_order, is_active, venue)
    values (p_group_id, lower(btrim(p_code)), btrim(p_name), nullif(btrim(p_description), ''),
            nullif(btrim(p_instructions), ''), p_score_precision, coalesce(p_display_order, 0), coalesce(p_is_active, true),
            nullif(btrim(p_venue), ''))
    returning id into v_id;
  else
    update public.events
       set group_id = p_group_id, code = lower(btrim(p_code)), name = btrim(p_name),
           description = nullif(btrim(p_description), ''), instructions = nullif(btrim(p_instructions), ''),
           score_precision = p_score_precision, display_order = coalesce(p_display_order, 0),
           is_active = coalesce(p_is_active, true), venue = nullif(btrim(p_venue), '')
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Import: optional "members" column for teams
-- -----------------------------------------------------------------------------
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
      insert into public.participants (code, name, kind, group_id, affiliation, registration_no, notes, members)
      values (v_code, v_name, v_kind::public.participant_kind, v_group,
              nullif(btrim(r ->> 'affiliation'), ''), nullif(btrim(r ->> 'registration_no'), ''),
              nullif(btrim(r ->> 'notes'), ''), nullif(btrim(r ->> 'members'), ''))
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
-- Yearly reset also clears remarks and participant requests
-- -----------------------------------------------------------------------------
create or replace function public.admin_reset_event_data(p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_counts jsonb;
begin
  perform public.assert_admin();
  if p_confirm is distinct from 'RESET' then
    raise exception 'CONFIRMATION_REQUIRED';
  end if;

  select jsonb_build_object(
    'participants', (select count(*) from public.participants),
    'marks', (select count(*) from public.criterion_scores),
    'submitted', (select count(*) from public.submissions where status in ('submitted', 'resubmitted')),
    'finalized_events', (select count(*) from public.result_finalizations where status = 'active')
  ) into v_counts;

  perform set_config('app.reset_mode', 'on', true);
  delete from public.result_finalizations where true;
  delete from public.tie_resolutions where true;
  delete from public.report_records where true;
  delete from public.correction_requests where true;
  delete from public.reopening_requests where true;
  delete from public.participant_requests where true;
  delete from public.participant_remarks where true;
  delete from public.submission_rounds where true;
  delete from public.submission_transitions where true;
  delete from public.score_history where true;
  delete from public.criterion_scores where true;
  delete from public.event_participants where true;
  delete from public.participants where true;
  update public.submissions
     set status = 'not_started', version = 0, round = 0,
         submitted_at = null, submitted_by = null, last_saved_at = null
   where true;
  perform set_config('app.reset_mode', '', true);

  perform public.log_audit(p_action => 'system.reset', p_entity_type => 'system', p_metadata => v_counts,
                           p_reason => 'Reset all participants and marks for a new year');
  return v_counts;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges for new / changed functions (EXECUTE is not granted by default)
-- -----------------------------------------------------------------------------
revoke execute on function
  public.save_remark(uuid, uuid, text),
  public.set_memento(uuid, boolean),
  public.event_participant_context(uuid),
  public.event_tie_alerts(uuid),
  public.request_participant_change(uuid, text, uuid, text, text),
  public.resolve_participant_request(uuid, boolean, text, text, text, text, text, text),
  public.admin_save_event(uuid, uuid, text, text, text, text, smallint, integer, boolean, text, text)
from public, anon;

grant execute on function
  public.save_remark(uuid, uuid, text),
  public.set_memento(uuid, boolean),
  public.event_participant_context(uuid),
  public.event_tie_alerts(uuid),
  public.request_participant_change(uuid, text, uuid, text, text),
  public.resolve_participant_request(uuid, boolean, text, text, text, text, text, text),
  public.admin_save_event(uuid, uuid, text, text, text, text, smallint, integer, boolean, text, text),
  public.admin_import_participants(jsonb, text, text),
  public.admin_reset_event_data(text)
to authenticated;

-- Admin dashboard gets live updates for new participant requests.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participant_requests') then
    alter publication supabase_realtime add table public.participant_requests;
  end if;
end;
$$;
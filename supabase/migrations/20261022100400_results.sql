-- =============================================================================
-- Results: aggregation, ranking, tie handling, finalization, progress overview.
--
-- Aggregation rule: a participant's aggregate is the SUM of the totals awarded
-- by every *required* judge (active assignment, active judge). A judge's total
-- is the sum of that judge's marks over the event's active criteria.
-- Results are only computed once every required judge has submitted a
-- complete submission. Ties are never broken automatically.
-- =============================================================================

create or replace function public.missing_count_internal(p_submission_id uuid)
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
    and not exists (
      select 1 from public.criterion_scores cs
      where cs.submission_id = s.id and cs.participant_id = ep.participant_id
        and cs.criterion_id = c.id and cs.value is not null
    );
$$;

create or replace function public.event_results_internal(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_required integer;
  v_submitted integer;
  v_incomplete integer;
  v_judges jsonb;
  v_criteria jsonb;
  v_max_per_judge numeric;
  v_participant_count integer;
  v_rows jsonb;
  v_ties jsonb := '[]'::jsonb;
  v_rank_map jsonb := '{}'::jsonb;
  v_unresolved integer := 0;
  v_tie record;
  v_res public.tie_resolutions;
  v_final public.result_finalizations;
  v_complete boolean;
  v_status text;
begin
  with req as (
    select a.judge_id, p.display_name, p.username, s.id as submission_id, s.status, s.submitted_at,
           case when s.status in ('submitted', 'resubmitted')
                then public.missing_count_internal(s.id) end as missing
    from public.judge_assignments a
    join public.profiles p on p.id = a.judge_id and p.is_active and p.role = 'judge'
    left join public.submissions s on s.event_id = a.event_id and s.judge_id = a.judge_id
    where a.event_id = p_event_id and a.is_active
  )
  select count(*),
         count(*) filter (where status in ('submitted', 'resubmitted')),
         count(*) filter (where status in ('submitted', 'resubmitted') and missing > 0),
         coalesce(jsonb_agg(jsonb_build_object(
           'judge_id', judge_id, 'display_name', display_name, 'username', username,
           'submission_id', submission_id, 'status', status, 'submitted_at', submitted_at,
           'missing', missing) order by username), '[]'::jsonb)
    into v_required, v_submitted, v_incomplete, v_judges
    from req;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'name', name, 'max_marks', max_marks, 'display_order', display_order)
           order by display_order, name), '[]'::jsonb),
         coalesce(sum(max_marks), 0)
    into v_criteria, v_max_per_judge
    from public.evaluation_criteria where event_id = p_event_id and is_active;

  select count(*) into v_participant_count
    from public.event_participants ep
    join public.participants p on p.id = ep.participant_id and p.is_active
   where ep.event_id = p_event_id and ep.is_active;

  select * into v_final from public.result_finalizations
   where event_id = p_event_id and status = 'active';

  v_complete := v_required > 0 and v_submitted = v_required and v_incomplete = 0
                and v_participant_count > 0 and jsonb_array_length(v_criteria) > 0;

  if not v_complete then
    return jsonb_build_object(
      'event_id', p_event_id, 'status', 'judging_in_progress', 'complete', false,
      'required_judges', v_required, 'submitted_judges', v_submitted,
      'incomplete_submissions', v_incomplete, 'judges', v_judges, 'criteria', v_criteria,
      'max_per_judge', v_max_per_judge, 'participant_count', v_participant_count,
      'participants', null, 'ties', '[]'::jsonb, 'unresolved_ties', 0,
      'finalization', null);
  end if;

  with req as (
    select s.id as submission_id, s.judge_id
    from public.judge_assignments a
    join public.profiles p on p.id = a.judge_id and p.is_active and p.role = 'judge'
    join public.submissions s on s.event_id = a.event_id and s.judge_id = a.judge_id
    where a.event_id = p_event_id and a.is_active
  ),
  ep as (
    select p.id as participant_id, p.code, p.name, p.affiliation, p.kind
    from public.event_participants e
    join public.participants p on p.id = e.participant_id and p.is_active
    where e.event_id = p_event_id and e.is_active
  ),
  totals as (
    select r.judge_id, cs.participant_id, sum(cs.value) as total
    from public.criterion_scores cs
    join req r on r.submission_id = cs.submission_id
    join public.evaluation_criteria c on c.id = cs.criterion_id and c.is_active
    group by r.judge_id, cs.participant_id
  ),
  agg as (
    select ep.participant_id, ep.code, ep.name, ep.affiliation, ep.kind,
           coalesce(sum(t.total), 0) as aggregate,
           coalesce(jsonb_object_agg(t.judge_id, t.total) filter (where t.judge_id is not null), '{}'::jsonb) as judge_totals
    from ep left join totals t on t.participant_id = ep.participant_id
    group by ep.participant_id, ep.code, ep.name, ep.affiliation, ep.kind
  ),
  ranked as (
    select agg.*,
           rank() over (order by aggregate desc)::integer as calc_rank,
           count(*) over (partition by aggregate)::integer as tie_size
    from agg
  )
  select jsonb_agg(jsonb_build_object(
           'participant_id', participant_id, 'code', code, 'name', name,
           'affiliation', affiliation, 'kind', kind, 'aggregate', aggregate,
           'judge_totals', judge_totals, 'calc_rank', calc_rank, 'tie_size', tie_size)
           order by aggregate desc, code)
    into v_rows
    from ranked;

  for v_tie in
    select (x ->> 'aggregate')::numeric as aggregate,
           array_agg((x ->> 'participant_id')::uuid order by (x ->> 'participant_id')::uuid) as ids,
           min((x ->> 'calc_rank')::integer) as start_rank
    from jsonb_array_elements(v_rows) x
    where (x ->> 'tie_size')::integer > 1
    group by (x ->> 'aggregate')::numeric
    order by 1 desc
  loop
    v_res := null;
    select * into v_res from public.tie_resolutions
     where event_id = p_event_id and is_active
       and aggregate = v_tie.aggregate and participant_ids = v_tie.ids
     order by resolved_at desc limit 1;
    v_ties := v_ties || jsonb_build_object(
      'aggregate', v_tie.aggregate, 'participant_ids', to_jsonb(v_tie.ids),
      'start_rank', v_tie.start_rank, 'resolved', v_res.id is not null,
      'resolution_id', v_res.id, 'ranks', v_res.ranks, 'reason', v_res.reason,
      'resolved_at', v_res.resolved_at);
    if v_res.id is null then
      v_unresolved := v_unresolved + 1;
    else
      v_rank_map := v_rank_map || v_res.ranks;
    end if;
  end loop;

  select jsonb_agg(y.row order by coalesce((y.row ->> 'final_rank')::integer, (y.row ->> 'calc_rank')::integer),
                   (y.row ->> 'aggregate')::numeric desc, y.row ->> 'code')
    into v_rows
    from (
      select x || jsonb_build_object(
               'tied', (x ->> 'tie_size')::integer > 1,
               'final_rank', case when (x ->> 'tie_size')::integer = 1 then (x ->> 'calc_rank')::integer
                                  else (v_rank_map ->> (x ->> 'participant_id'))::integer end) as row
      from jsonb_array_elements(v_rows) x
    ) y;

  v_status := case
    when v_final.id is not null then 'finalized'
    when v_unresolved > 0 then 'awaiting_tie_resolution'
    else 'ready_for_finalization' end;

  return jsonb_build_object(
    'event_id', p_event_id, 'status', v_status, 'complete', true,
    'required_judges', v_required, 'submitted_judges', v_submitted,
    'incomplete_submissions', v_incomplete, 'judges', v_judges, 'criteria', v_criteria,
    'max_per_judge', v_max_per_judge, 'participant_count', v_participant_count,
    'participants', v_rows, 'ties', v_ties, 'unresolved_ties', v_unresolved,
    'finalization', case when v_final.id is null then null else jsonb_build_object(
      'id', v_final.id, 'finalized_at', v_final.finalized_at, 'finalized_by', v_final.finalized_by) end);
end;
$$;

create or replace function public.get_event_results(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  return public.event_results_internal(p_event_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Tie resolution. p_ranks: {"<participant_id>": rank, ...}. Ranks must lie in
-- [start_rank, start_rank + n - 1] and the best rank must equal start_rank.
-- Equal ranks are allowed (shared place) when the admin decides so.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_tie(
  p_event_id uuid,
  p_participant_ids uuid[],
  p_ranks jsonb,
  p_reason text,
  p_related_correction_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_results jsonb;
  v_tie jsonb;
  v_ids uuid[];
  v_start integer;
  v_n integer;
  v_rank integer;
  v_min integer := null;
  v_pid uuid;
  v_id uuid;
  v_original jsonb;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  perform 1 from public.events where id = p_event_id for update;

  v_results := public.event_results_internal(p_event_id);
  if v_results ->> 'status' = 'finalized' then
    raise exception 'ALREADY_FINALIZED';
  end if;
  if not (v_results ->> 'complete')::boolean then
    raise exception 'NOT_COMPLETE';
  end if;

  select array_agg(x order by x) into v_ids from unnest(p_participant_ids) x;
  select t into v_tie from jsonb_array_elements(v_results -> 'ties') t
   where (select array_agg(e::uuid order by e::uuid) from jsonb_array_elements_text(t -> 'participant_ids') e) = v_ids;
  if v_tie is null then
    raise exception 'TIE_NOT_FOUND';
  end if;

  v_start := (v_tie ->> 'start_rank')::integer;
  v_n := array_length(v_ids, 1);
  if (select count(*) from jsonb_object_keys(p_ranks)) <> v_n then
    raise exception 'INVALID_RANKS';
  end if;
  foreach v_pid in array v_ids loop
    if not (p_ranks ? v_pid::text) or jsonb_typeof(p_ranks -> v_pid::text) <> 'number' then
      raise exception 'INVALID_RANKS';
    end if;
    v_rank := (p_ranks ->> v_pid::text)::integer;
    if v_rank::numeric <> (p_ranks ->> v_pid::text)::numeric or v_rank < v_start or v_rank > v_start + v_n - 1 then
      raise exception 'INVALID_RANKS';
    end if;
    v_min := least(coalesce(v_min, v_rank), v_rank);
  end loop;
  if v_min <> v_start then
    raise exception 'INVALID_RANKS';
  end if;

  select jsonb_agg(p) into v_original from jsonb_array_elements(v_results -> 'participants') p
   where (p ->> 'participant_id')::uuid = any (v_ids);

  update public.tie_resolutions set is_active = false
   where event_id = p_event_id and is_active and participant_ids = v_ids;

  insert into public.tie_resolutions (
    event_id, aggregate, participant_ids, original, ranks, reason, related_correction_ids, resolved_by
  ) values (
    p_event_id, (v_tie ->> 'aggregate')::numeric, v_ids, v_original, p_ranks, btrim(p_reason),
    coalesce(p_related_correction_ids, '{}'), auth.uid()
  ) returning id into v_id;

  perform public.log_audit(
    p_action => 'tie.resolved', p_entity_type => 'tie_resolution', p_entity_id => v_id,
    p_old => v_original, p_new => p_ranks, p_reason => p_reason, p_event_id => p_event_id,
    p_metadata => jsonb_build_object('aggregate', v_tie -> 'aggregate', 'start_rank', v_start));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Finalization: stores an immutable snapshot used by reports.
-- -----------------------------------------------------------------------------
create or replace function public.finalize_event_results(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_results jsonb;
  v_event jsonb;
  v_breakdown jsonb;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  perform 1 from public.events where id = p_event_id for update;

  v_results := public.event_results_internal(p_event_id);
  if v_results ->> 'status' = 'finalized' then
    raise exception 'ALREADY_FINALIZED';
  end if;
  if v_results ->> 'status' <> 'ready_for_finalization' then
    raise exception 'NOT_READY' using detail = v_results ->> 'status';
  end if;

  select jsonb_build_object(
           'id', e.id, 'code', e.code, 'name', e.name,
           'group', jsonb_build_object('id', g.id, 'code', g.code, 'name', g.name))
    into v_event
    from public.events e join public.groups g on g.id = e.group_id
   where e.id = p_event_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'judge_id', s.judge_id, 'participant_id', cs.participant_id,
           'criterion_id', cs.criterion_id, 'value', cs.value)), '[]'::jsonb)
    into v_breakdown
    from public.criterion_scores cs
    join public.submissions s on s.id = cs.submission_id
    join public.judge_assignments a on a.event_id = s.event_id and a.judge_id = s.judge_id and a.is_active
    join public.profiles p on p.id = s.judge_id and p.is_active
    join public.evaluation_criteria c on c.id = cs.criterion_id and c.is_active
    join public.event_participants ep on ep.event_id = s.event_id and ep.participant_id = cs.participant_id and ep.is_active
   where s.event_id = p_event_id;

  insert into public.result_finalizations (event_id, snapshot, finalized_by)
  values (
    p_event_id,
    v_results || jsonb_build_object('event', v_event, 'breakdown', v_breakdown, 'status', 'finalized'),
    auth.uid()
  ) returning id into v_id;

  perform public.log_audit(
    p_action => 'results.finalized', p_entity_type => 'result_finalization', p_entity_id => v_id,
    p_new => jsonb_build_object('participants', v_results -> 'participants', 'ties', v_results -> 'ties'),
    p_event_id => p_event_id);
  return v_id;
end;
$$;

create or replace function public.unfinalize_event_results(p_event_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;
  if not public.invalidate_finalization_internal(p_event_id, btrim(p_reason)) then
    raise exception 'NOT_FINALIZED';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin dashboard: per-event progress (no marks, no rankings).
-- -----------------------------------------------------------------------------
create or replace function public.admin_event_progress()
returns table (
  event_id uuid,
  event_code text,
  event_name text,
  event_active boolean,
  event_order integer,
  group_id uuid,
  group_code text,
  group_name text,
  group_order integer,
  participant_count integer,
  criteria_count integer,
  required_judges integer,
  submitted integer,
  in_progress integer,
  not_started integer,
  incomplete_submissions integer,
  reopening_pending integer,
  corrections_open integer,
  finalized boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  return query
  select e.id, e.code, e.name, e.is_active, e.display_order,
         g.id, g.code, g.name, g.display_order,
         (select count(*)::integer from public.event_participants ep
            join public.participants p on p.id = ep.participant_id and p.is_active
           where ep.event_id = e.id and ep.is_active),
         (select count(*)::integer from public.evaluation_criteria c where c.event_id = e.id and c.is_active),
         coalesce(st.required, 0), coalesce(st.submitted, 0), coalesce(st.in_progress, 0),
         coalesce(st.not_started, 0), coalesce(st.incomplete, 0),
         (select count(*)::integer from public.reopening_requests r
            join public.submissions s on s.id = r.submission_id
           where s.event_id = e.id and r.status = 'pending'),
         (select count(*)::integer from public.correction_requests cr
           where cr.event_id = e.id and cr.status in ('open', 'responded')),
         exists (select 1 from public.result_finalizations f where f.event_id = e.id and f.status = 'active')
  from public.events e
  join public.groups g on g.id = e.group_id
  left join lateral (
    select count(*)::integer as required,
           count(*) filter (where s.status in ('submitted', 'resubmitted'))::integer as submitted,
           count(*) filter (where s.status in ('in_progress', 'reopened', 'correction_requested', 'reopening_requested'))::integer as in_progress,
           count(*) filter (where s.status = 'not_started' or s.status is null)::integer as not_started,
           count(*) filter (where s.status in ('submitted', 'resubmitted') and public.missing_count_internal(s.id) > 0)::integer as incomplete
    from public.judge_assignments a
    join public.profiles pr on pr.id = a.judge_id and pr.is_active and pr.role = 'judge'
    left join public.submissions s on s.event_id = a.event_id and s.judge_id = a.judge_id
    where a.event_id = e.id and a.is_active
  ) st on true
  order by g.display_order, g.name, e.display_order, e.name;
end;
$$;

grant execute on function
  public.get_event_results(uuid),
  public.resolve_tie(uuid, uuid[], jsonb, text, uuid[]),
  public.finalize_event_results(uuid),
  public.unfinalize_event_results(uuid, text),
  public.admin_event_progress()
to authenticated;
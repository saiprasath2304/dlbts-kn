-- =============================================================================
-- 2026-11-01: attendance + judges' event leaderboard
--   * participants.attendance  'present' | 'absent' | null (not marked yet)
--   * admin_set_attendance()   admins mark a child present / absent
--   * event_leaderboard()      combined totals of every judge of an event, ranked,
--                              with ties flagged (judges see reg. no / code only)
-- Safe to run more than once.
-- =============================================================================

alter table public.participants add column if not exists attendance text;
alter table public.participants add column if not exists attendance_at timestamptz;
alter table public.participants add column if not exists attendance_by uuid references public.profiles (id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'participants_attendance_check') then
    alter table public.participants add constraint participants_attendance_check
      check (attendance is null or attendance in ('present', 'absent'));
  end if;
end;
$$;

create or replace function public.admin_set_attendance(p_participant_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p public.participants;
begin
  perform public.assert_admin();
  if p_status is not null and p_status not in ('present', 'absent') then
    raise exception 'INVALID_REQUEST';
  end if;
  update public.participants
     set attendance = p_status,
         attendance_at = case when p_status is null then null else now() end,
         attendance_by = case when p_status is null then null else auth.uid() end
   where id = p_participant_id
  returning * into v_p;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  return jsonb_build_object('attendance', v_p.attendance, 'at', v_p.attendance_at);
end;
$$;

-- Judges are numbered Judge 1, 2, 3… by username (same as the feedback reports).
-- A judge's total for a child is null until that judge has entered a mark.
create or replace function public.event_leaderboard(p_event_id uuid)
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

  with judges as (
    select a.judge_id, s.id as submission_id, s.status,
           row_number() over (order by pr.username) as n
    from public.judge_assignments a
    join public.profiles pr on pr.id = a.judge_id and pr.is_active and pr.role = 'judge'
    left join public.submissions s on s.event_id = a.event_id and s.judge_id = a.judge_id
    where a.event_id = p_event_id and a.is_active
  ),
  crit as (
    select id, max_marks from public.evaluation_criteria where event_id = p_event_id and is_active
  ),
  ep as (
    select p.id, p.code, coalesce(nullif(p.registration_no, ''), p.code) as label,
           case when public.is_admin() then p.name end as name
    from public.event_participants e
    join public.participants p on p.id = e.participant_id and p.is_active
    where e.event_id = p_event_id and e.is_active
  ),
  per as (
    select ep.id as participant_id, j.n, sum(cs.value) as total, count(cs.value) as filled
    from ep
    cross join judges j
    left join public.criterion_scores cs
      on cs.submission_id = j.submission_id and cs.participant_id = ep.id
     and cs.criterion_id in (select id from crit)
    group by ep.id, j.n
  ),
  agg as (
    select ep.id, ep.code, ep.label, ep.name,
           coalesce(jsonb_agg(jsonb_build_object('n', per.n, 'total', per.total, 'filled', per.filled)
                              order by per.n) filter (where per.n is not null), '[]'::jsonb) as judges,
           sum(per.total) as total,
           coalesce(sum(per.filled), 0) as filled
    from ep
    left join per on per.participant_id = ep.id
    group by ep.id, ep.code, ep.label, ep.name
  ),
  ranked as (
    select agg.*,
           case when total is null then null else rank() over (order by total desc nulls last) end as rnk,
           case when total is null then 1 else count(*) over (partition by total) end as same
    from agg
  )
  select jsonb_build_object(
    'judges', coalesce((select jsonb_agg(jsonb_build_object(
                          'n', n, 'is_me', judge_id = auth.uid(), 'status', coalesce(status::text, 'not_started'))
                        order by n) from judges), '[]'::jsonb),
    'criteria', (select count(*) from crit),
    'max', coalesce((select sum(max_marks) from crit), 0),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
                        'participant_id', id, 'code', code, 'label', label, 'name', name,
                        'judges', judges, 'total', total, 'filled', filled,
                        'rank', rnk, 'tied', same > 1)
                      order by rnk nulls last, code) from ranked), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function
  public.admin_set_attendance(uuid, text),
  public.event_leaderboard(uuid)
from public, anon;

grant execute on function
  public.admin_set_attendance(uuid, text),
  public.event_leaderboard(uuid)
to authenticated;

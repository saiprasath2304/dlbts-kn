-- =============================================================================
-- Admin operations. Each sets app.reason (when given) so the change guards and
-- audit triggers record why a consequential change was made.
-- =============================================================================

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;

create or replace function public.apply_reason(p_reason text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform set_config('app.reason', coalesce(btrim(p_reason), ''), true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Assignments
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_assignment(
  p_event_id uuid, p_judge_id uuid, p_active boolean, p_reason text default null
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
  insert into public.judge_assignments (event_id, judge_id, is_active, created_by)
  values (p_event_id, p_judge_id, p_active, auth.uid())
  on conflict (event_id, judge_id) do update set is_active = excluded.is_active
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Events
-- -----------------------------------------------------------------------------
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
  p_reason text default null
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
    insert into public.events (group_id, code, name, description, instructions, score_precision, display_order, is_active)
    values (p_group_id, lower(btrim(p_code)), btrim(p_name), nullif(btrim(p_description), ''),
            nullif(btrim(p_instructions), ''), p_score_precision, coalesce(p_display_order, 0), coalesce(p_is_active, true))
    returning id into v_id;
  else
    update public.events
       set group_id = p_group_id, code = lower(btrim(p_code)), name = btrim(p_name),
           description = nullif(btrim(p_description), ''), instructions = nullif(btrim(p_instructions), ''),
           score_precision = p_score_precision, display_order = coalesce(p_display_order, 0),
           is_active = coalesce(p_is_active, true)
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
-- Criteria
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_criterion(
  p_event_id uuid,
  p_id uuid,
  p_name text,
  p_description text,
  p_max_marks numeric,
  p_display_order integer,
  p_is_active boolean,
  p_reason text default null
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
    insert into public.evaluation_criteria (event_id, name, description, max_marks, display_order, is_active)
    values (p_event_id, btrim(p_name), nullif(btrim(p_description), ''), p_max_marks,
            coalesce(p_display_order, 0), coalesce(p_is_active, true))
    returning id into v_id;
  else
    update public.evaluation_criteria
       set name = btrim(p_name), description = nullif(btrim(p_description), ''), max_marks = p_max_marks,
           display_order = coalesce(p_display_order, 0), is_active = coalesce(p_is_active, true)
     where id = p_id and event_id = p_event_id
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND';
    end if;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Participants
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_event_participant(
  p_event_id uuid, p_participant_id uuid, p_active boolean, p_reason text default null
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
  insert into public.event_participants (event_id, participant_id, is_active)
  values (p_event_id, p_participant_id, p_active)
  on conflict (event_id, participant_id) do update set is_active = excluded.is_active
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_set_participant_active(
  p_participant_id uuid, p_active boolean, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  perform public.apply_reason(p_reason);
  update public.participants set is_active = p_active where id = p_participant_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Participant import: all-or-nothing. Rows:
--   [{row, code, name, kind, group_code, event_code, affiliation, registration_no, notes}]
-- Re-importing an existing code with the same name links it (no duplicate);
-- an existing code with a different name is an error.
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
      insert into public.participants (code, name, kind, group_id, affiliation, registration_no, notes)
      values (v_code, v_name, v_kind::public.participant_kind, v_group,
              nullif(btrim(r ->> 'affiliation'), ''), nullif(btrim(r ->> 'registration_no'), ''),
              nullif(btrim(r ->> 'notes'), ''))
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
-- Service-role-only functions: called by trusted server code after it has
-- verified (with the caller's own session) that the caller is an admin.
-- -----------------------------------------------------------------------------
create or replace function public.service_create_profile(
  p_id uuid, p_username text, p_display_name text, p_role public.app_role, p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);
  insert into public.profiles (id, username, display_name, role, created_by)
  values (p_id, lower(btrim(p_username)), btrim(p_display_name), p_role, p_actor);
end;
$$;

create or replace function public.service_update_profile(
  p_id uuid, p_display_name text, p_is_active boolean, p_actor uuid, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.profiles;
  v_event uuid;
begin
  perform set_config('app.actor_id', coalesce(p_actor::text, ''), true);
  perform public.apply_reason(p_reason);
  select * into v_old from public.profiles where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  update public.profiles
     set display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
         is_active = coalesce(p_is_active, is_active)
   where id = p_id;
  if p_is_active is not null and p_is_active <> v_old.is_active then
    for v_event in select event_id from public.judge_assignments where judge_id = p_id and is_active loop
      perform public.invalidate_finalization_internal(
        v_event, format('Judge %s %s', v_old.username, case when p_is_active then 'activated' else 'deactivated' end));
    end loop;
  end if;
end;
$$;

create or replace function public.service_log_audit(
  p_action text, p_actor uuid, p_judge_id uuid default null, p_reason text default null,
  p_metadata jsonb default '{}', p_entity_type text default null, p_entity_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_audit(
    p_action => p_action, p_entity_type => p_entity_type, p_entity_id => p_entity_id,
    p_reason => p_reason, p_judge_id => p_judge_id, p_metadata => p_metadata, p_actor_id => p_actor);
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: admin dashboard listens to submission/request changes (RLS applies).
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.submissions, public.reopening_requests,
      public.correction_requests;
  end if;
end;
$$;
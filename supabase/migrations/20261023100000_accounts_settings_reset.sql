-- =============================================================================
-- DLBTS KN: event name/year settings, SQL account management, yearly reset.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Settings: the title shown everywhere is "<app_name> <event_year>".
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('app_name', '"DLBTS KN"'),
  ('event_year', '2026')
on conflict (key) do nothing;

update public.app_settings set value = '"DLBTS KN 2026"' where key = 'app_title' and value = '"Event Judging"';

-- -----------------------------------------------------------------------------
-- Accounts created directly in SQL (Supabase SQL editor, runs as postgres).
-- Passwords are hashed with bcrypt exactly like Supabase Auth does.
-- These functions are NOT callable through the API (no grants).
--
--   select public.create_account('judge01grp1sloka', 'pwd01grp1sloka', 'Group 1 Sloka Judge 1', 'judge');
--   select public.set_account_password('judge01grp1sloka', 'new-password');
--
-- p_domain must equal the app's AUTH_EMAIL_DOMAIN (default judges.invalid).
-- -----------------------------------------------------------------------------
create or replace function public.create_account(
  p_username text,
  p_password text,
  p_display_name text,
  p_role public.app_role default 'judge',
  p_domain text default 'judges.invalid'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user text := lower(btrim(p_username));
  v_email text;
  v_id uuid;
begin
  if v_user !~ '^[a-z0-9][a-z0-9._-]{2,49}$' then
    raise exception 'INVALID_USERNAME' using detail = p_username;
  end if;
  if p_password is null or char_length(p_password) < 6 then
    raise exception 'PASSWORD_TOO_SHORT' using detail = p_username;
  end if;
  v_email := v_user || '@' || lower(btrim(p_domain));

  -- Idempotent: an existing account is left unchanged (use set_account_password to change it).
  select id into v_id from public.profiles where username = v_user;
  if v_id is not null then
    return v_id;
  end if;
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      crypt(p_password, gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', jsonb_build_object('username', v_user), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  insert into public.profiles (id, username, display_name, role)
  values (v_id, v_user, btrim(p_display_name), p_role);
  return v_id;
end;
$$;

create or replace function public.set_account_password(p_username text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_password is null or char_length(p_password) < 6 then
    raise exception 'PASSWORD_TOO_SHORT';
  end if;
  select id into v_id from public.profiles where username = lower(btrim(p_username));
  if v_id is null then
    raise exception 'NOT_FOUND' using detail = p_username;
  end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = v_id;
  perform public.log_audit(p_action => 'account.password_set_sql', p_entity_type => 'profile', p_entity_id => v_id, p_judge_id => v_id);
end;
$$;

revoke execute on function public.create_account(text, text, text, public.app_role, text) from public, anon, authenticated, service_role;
revoke execute on function public.set_account_password(text, text) from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Yearly reset. Keeps groups, events, criteria, judge accounts, passwords,
-- assignments, settings and the audit log. Deletes participants and every
-- mark, submission state, request, tie decision, finalization and report record.
-- The append-only protections allow deletes only while app.reset_mode is on,
-- which can only be set inside this function (not reachable via the API).
-- -----------------------------------------------------------------------------
create or replace function public.in_reset_mode()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(current_setting('app.reset_mode', true), '') = 'on';
$$;

create or replace function public.forbid_modification()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and tg_table_name <> 'audit_logs' and public.in_reset_mode() then
    return old;
  end if;
  raise exception 'APPEND_ONLY' using detail = format('%s is append-only', tg_table_name);
end;
$$;

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
    if public.in_reset_mode() then
      return old;
    end if;
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

-- Row-level audit is skipped during a reset (one summary entry is written instead).
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
  if public.in_reset_mode() then
    return coalesce(new, old);
  end if;
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

revoke execute on function public.in_reset_mode() from public, anon;
grant execute on function public.in_reset_mode() to authenticated;
grant execute on function public.admin_reset_event_data(text) to authenticated;
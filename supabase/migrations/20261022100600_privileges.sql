-- =============================================================================
-- Function privileges: explicit allowlist.
--
-- Supabase's default privileges grant EXECUTE on new functions to anon and
-- authenticated. Internal helpers (transition_submission, log_audit,
-- invalidate_finalization_internal, service_* ...) must never be callable
-- through the Data API, so we revoke everything and re-grant only the
-- public RPC surface. Re-run this pattern in any future migration that adds
-- functions.
-- =============================================================================

alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

revoke execute on all functions in schema public from anon, authenticated, public;

-- RLS helpers (used inside policies, evaluated as the calling role)
grant execute on function
  public.is_admin(),
  public.is_active_judge(),
  public.is_assigned(uuid),
  public.owns_submission(uuid),
  public.is_editable_status(public.submission_status)
to authenticated;

-- Judge RPCs (each re-checks ownership and state)
grant execute on function
  public.save_scores(uuid, jsonb),
  public.submit_submission(uuid, integer),
  public.request_reopening(uuid, text),
  public.respond_correction_request(uuid, text),
  public.submission_missing_count(uuid)
to authenticated;

-- Admin RPCs (each checks is_admin())
grant execute on function
  public.event_has_scores(uuid),
  public.resolve_reopening_request(uuid, boolean, text),
  public.admin_reopen_submission(uuid, text),
  public.create_correction_request(uuid, uuid, uuid[], text, boolean),
  public.resolve_correction_request(uuid, text, boolean),
  public.admin_set_score(uuid, uuid, uuid, numeric, text),
  public.get_event_results(uuid),
  public.resolve_tie(uuid, uuid[], jsonb, text, uuid[]),
  public.finalize_event_results(uuid),
  public.unfinalize_event_results(uuid, text),
  public.admin_event_progress(),
  public.admin_set_assignment(uuid, uuid, boolean, text),
  public.admin_save_event(uuid, uuid, text, text, text, text, smallint, integer, boolean, text),
  public.admin_save_criterion(uuid, uuid, text, text, numeric, integer, boolean, text),
  public.admin_set_event_participant(uuid, uuid, boolean, text),
  public.admin_set_participant_active(uuid, boolean, text),
  public.admin_import_participants(jsonb, text, text)
to authenticated;

-- Trusted server code only
grant execute on function
  public.service_create_profile(uuid, text, text, public.app_role, uuid),
  public.service_update_profile(uuid, text, boolean, uuid, text),
  public.service_log_audit(text, uuid, uuid, text, jsonb, text, uuid)
to service_role;

-- Report generation and email delivery are audited too.
create trigger report_records_audit after insert or update on public.report_records
  for each row execute function public.audit_row_change();
import { fail } from '@sveltejs/kit';
import { loadJudgeEvent } from '#lib/server/judge.ts';
import { getSettings } from '#lib/server/settings.ts';
import { requireJudge } from '#lib/server/guards.ts';
import { failWith } from '#lib/server/errors.ts';
import { translate } from '#lib/i18n/index.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireJudge(locals);
	const data = await loadJudgeEvent(locals, params.eventId);
	const settings = await getSettings();
	return { ...data, autosaveDelay: settings.autosave_delay_ms };
};

export const actions: Actions = {
	requestReopen: async ({ request, locals, params }) => {
		requireJudge(locals);
		const form = await request.formData();
		const reason = String(form.get('reason') ?? '').trim();
		if (reason.length < 3)
			return fail(400, { error: translate(locals.locale, 'common.reason_required') });
		const { submission } = await loadJudgeEvent(locals, params.eventId);
		const { error } = await locals.supabase.rpc('request_reopening', {
			p_submission_id: submission.id,
			p_reason: reason
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'request.reopen_sent') };
	},
	requestParticipant: async ({ request, locals, params }) => {
		requireJudge(locals);
		const form = await request.formData();
		const type = String(form.get('request_type') ?? '');
		const details = String(form.get('details') ?? '').trim();
		if (details.length < 3)
			return fail(400, { error: translate(locals.locale, 'common.reason_required') });
		const participant = String(form.get('participant_id') ?? '');
		const { error } = await locals.supabase.rpc('request_participant_change', {
			p_event_id: params.eventId,
			p_type: type,
			p_participant_id: /^[0-9a-f-]{36}$/i.test(participant)
				? participant
				: (null as unknown as string),
			p_name: String(form.get('name') ?? '').trim(),
			p_details: details
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'preq.sent') };
	},
	respondCorrection: async ({ request, locals }) => {
		requireJudge(locals);
		const form = await request.formData();
		const response = String(form.get('response') ?? '').trim();
		if (!response) return fail(400, { error: translate(locals.locale, 'common.reason_required') });
		const { error } = await locals.supabase.rpc('respond_correction_request', {
			p_request_id: String(form.get('request_id')),
			p_response: response
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'request.respond_sent') };
	}
};

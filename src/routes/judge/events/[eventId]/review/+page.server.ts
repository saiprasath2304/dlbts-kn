import { fail, redirect } from '@sveltejs/kit';
import { loadJudgeEvent } from '#lib/server/judge.ts';
import { requireJudge } from '#lib/server/guards.ts';
import { failWith } from '#lib/server/errors.ts';
import { translate } from '#lib/i18n/index.ts';
import { isEditable } from '#lib/status.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireJudge(locals);
	const data = await loadJudgeEvent(locals, params.eventId);
	if (!isEditable(data.submission.status)) redirect(303, `/judge/events/${params.eventId}/receipt`);
	return data;
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		requireJudge(locals);
		const form = await request.formData();
		if (form.get('confirm') !== 'yes') {
			return fail(400, { error: translate(locals.locale, 'submit.confirm_check') });
		}
		const { submission } = await loadJudgeEvent(locals, params.eventId);
		const expected = Number(form.get('expected_version'));
		const { error } = await locals.supabase.rpc('submit_submission', {
			p_submission_id: submission.id,
			p_expected_version: Number.isInteger(expected) ? expected : submission.version
		});
		if (error) return failWith(locals.locale, error);
		redirect(303, `/judge/events/${params.eventId}/receipt?submitted=1`);
	}
};

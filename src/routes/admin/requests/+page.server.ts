import { fail } from '@sveltejs/kit';
import { translate } from '#lib/i18n/index.ts';
import { failWith } from '#lib/server/errors.ts';
import { bool, optStr, str } from '#lib/server/form.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.supabase;
	const sel =
		'submissions(id, event_id, events(name, groups(name)), profiles!submissions_judge_id_fkey(display_name, username))';
	const [reopen, corr, preq] = await Promise.all([
		db
			.from('reopening_requests')
			.select(`*, ${sel}`)
			.order('created_at', { ascending: false })
			.limit(200),
		db
			.from('correction_requests')
			.select(`*, participants(name, code), ${sel}`)
			.order('created_at', { ascending: false })
			.limit(200),
		db
			.from('participant_requests')
			.select(
				'*, events(name, groups(name)), participants!participant_requests_participant_id_fkey(name, code), profiles!participant_requests_requested_by_fkey(display_name)'
			)
			.order('created_at', { ascending: false })
			.limit(200)
	]);
	return {
		reopenings: reopen.data ?? [],
		corrections: corr.data ?? [],
		participantRequests: preq.data ?? []
	};
};

export const actions: Actions = {
	resolveParticipant: async ({ request, locals }) => {
		const f = await request.formData();
		const approve = bool(f, 'approve');
		const note = optStr(f, 'reason') ?? '';
		if (!approve && note.length < 3)
			return fail(400, { error: translate(locals.locale, 'common.reason_required') });
		const { error } = await locals.supabase.rpc('resolve_participant_request', {
			p_request_id: str(f, 'id'),
			p_approve: approve,
			p_note: note,
			p_code: str(f, 'code'),
			p_name: str(f, 'name'),
			p_kind: str(f, 'kind') || 'individual',
			p_affiliation: str(f, 'affiliation'),
			p_members: str(f, 'members')
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.done') };
	},
	resolveReopen: async ({ request, locals }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.rpc('resolve_reopening_request', {
			p_request_id: str(f, 'id'),
			p_approve: bool(f, 'approve'),
			p_note: optStr(f, 'reason') ?? ''
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.done') };
	},
	resolveCorrection: async ({ request, locals }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.rpc('resolve_correction_request', {
			p_request_id: str(f, 'id'),
			p_note: optStr(f, 'reason') ?? '',
			p_cancel: bool(f, 'cancel')
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.done') };
	}
};

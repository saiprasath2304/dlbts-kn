import { error, fail } from '@sveltejs/kit';
import { translate } from '#lib/i18n/index.ts';
import { failWith } from '#lib/server/errors.ts';
import { isUuid, str } from '#lib/server/form.ts';
import { reasonFrom } from '#lib/server/guards.ts';
import type { EventResults } from '#lib/results.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!isUuid(params.eventId)) error(404, { message: 'Not found' });
	const db = locals.supabase;
	const [{ data: event }, { data: results, error: err }, { data: corrections }] = await Promise.all(
		[
			db.from('events').select('id, name, groups(name)').eq('id', params.eventId).maybeSingle(),
			db.rpc('get_event_results', { p_event_id: params.eventId }),
			db
				.from('correction_requests')
				.select('id, message, status, created_at')
				.eq('event_id', params.eventId)
				.order('created_at', { ascending: false })
		]
	);
	if (!event || err) error(404, { message: 'Not found' });
	return { event, results: results as unknown as EventResults, corrections: corrections ?? [] };
};

export const actions: Actions = {
	resolveTie: async ({ request, locals, params }) => {
		const f = await request.formData();
		const reason = reasonFrom(f);
		if (!reason) return fail(400, { error: translate(locals.locale, 'common.reason_required') });
		const ids = f.getAll('pid').map(String).filter(isUuid);
		const ranks: Record<string, number> = {};
		for (const id of ids) ranks[id] = Number(str(f, `rank_${id}`));
		const { error } = await locals.supabase.rpc('resolve_tie', {
			p_event_id: params.eventId,
			p_participant_ids: ids,
			p_ranks: ranks,
			p_reason: reason,
			p_related_correction_ids: f.getAll('correction_ids').map(String).filter(isUuid)
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	},
	finalize: async ({ locals, params }) => {
		const { error } = await locals.supabase.rpc('finalize_event_results', {
			p_event_id: params.eventId
		});
		if (error) {
			const detail = error.details
				? translate(locals.locale, `result_status.${error.details}`)
				: '';
			return failWith(locals.locale, { ...error, details: detail });
		}
		return { success: translate(locals.locale, 'result_status.finalized') };
	},
	unfinalize: async ({ request, locals, params }) => {
		const reason = reasonFrom(await request.formData());
		if (!reason) return fail(400, { error: translate(locals.locale, 'common.reason_required') });
		const { error } = await locals.supabase.rpc('unfinalize_event_results', {
			p_event_id: params.eventId,
			p_reason: reason
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.done') };
	}
};

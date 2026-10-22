import { error, fail } from '@sveltejs/kit';
import { translate } from '#lib/i18n/index.ts';
import { failWith } from '#lib/server/errors.ts';
import { bool, isUuid, num, str } from '#lib/server/form.ts';
import { reasonFrom } from '#lib/server/guards.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const db = locals.supabase;
	if (!isUuid(params.id)) error(404, { message: 'Not found' });
	const { data: sub } = await db
		.from('submissions')
		.select(
			'*, events(id, name, score_precision, groups(name)), profiles!submissions_judge_id_fkey(display_name, username)'
		)
		.eq('id', params.id)
		.maybeSingle();
	if (!sub) error(404, { message: 'Not found' });

	const [crit, entries, scores, history, transitions, rounds, missing, corrections, reopenings] =
		await Promise.all([
			db
				.from('evaluation_criteria')
				.select('id, name, max_marks, is_active, display_order')
				.eq('event_id', sub.event_id)
				.order('display_order'),
			db
				.from('event_participants')
				.select('is_active, display_order, participants(id, code, name, is_active)')
				.eq('event_id', sub.event_id),
			db
				.from('criterion_scores')
				.select('participant_id, criterion_id, value, version, updated_at')
				.eq('submission_id', sub.id),
			db
				.from('score_history')
				.select('*')
				.eq('submission_id', sub.id)
				.order('changed_at', { ascending: false })
				.limit(100),
			db
				.from('submission_transitions')
				.select('*')
				.eq('submission_id', sub.id)
				.order('created_at', { ascending: false }),
			db
				.from('submission_rounds')
				.select('round, status, submitted_at, totals')
				.eq('submission_id', sub.id)
				.order('round', { ascending: false }),
			db.rpc('submission_missing_count', { p_submission_id: sub.id }),
			db
				.from('correction_requests')
				.select('*')
				.eq('submission_id', sub.id)
				.order('created_at', { ascending: false }),
			db
				.from('reopening_requests')
				.select('*')
				.eq('submission_id', sub.id)
				.order('created_at', { ascending: false })
		]);

	const participants = (entries.data ?? [])
		.filter((e) => e.participants && e.is_active && e.participants.is_active)
		.map((e) => e.participants!)
		.sort((a, b) => a.code.localeCompare(b.code));

	return {
		sub,
		criteria: (crit.data ?? [])
			.filter((c) => c.is_active)
			.map((c) => ({ ...c, max_marks: Number(c.max_marks) })),
		allCriteria: crit.data ?? [],
		participants,
		scores: (scores.data ?? []).map((s) => ({
			...s,
			value: s.value === null ? null : Number(s.value)
		})),
		history: history.data ?? [],
		transitions: transitions.data ?? [],
		rounds: rounds.data ?? [],
		missing: missing.data ?? 0,
		corrections: corrections.data ?? [],
		reopenings: reopenings.data ?? []
	};
};

export const actions: Actions = {
	reopen: async ({ request, locals, params }) => {
		const reason = reasonFrom(await request.formData());
		if (!reason) return fail(400, { error: translate(locals.locale, 'common.reason_required') });
		const { error } = await locals.supabase.rpc('admin_reopen_submission', {
			p_submission_id: params.id,
			p_reason: reason
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.done') };
	},
	correction: async ({ request, locals, params }) => {
		const f = await request.formData();
		const message = str(f, 'message');
		if (message.length < 3)
			return fail(400, { error: translate(locals.locale, 'common.reason_required') });
		const participant = str(f, 'participant_id');
		const { error } = await locals.supabase.rpc('create_correction_request', {
			p_submission_id: params.id,
			p_participant_id: isUuid(participant) ? participant : (null as unknown as string),
			p_criterion_ids: f.getAll('criterion_ids').map(String).filter(isUuid),
			p_message: message,
			p_unlock: bool(f, 'unlock')
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.done') };
	},
	setScore: async ({ request, locals, params }) => {
		const f = await request.formData();
		const reason = reasonFrom(f);
		if (!reason) return fail(400, { error: translate(locals.locale, 'common.reason_required') });
		const value = num(f, 'value');
		const { error } = await locals.supabase.rpc('admin_set_score', {
			p_submission_id: params.id,
			p_participant_id: str(f, 'participant_id'),
			p_criterion_id: str(f, 'criterion_id'),
			p_value: value as number,
			p_reason: reason
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	}
};

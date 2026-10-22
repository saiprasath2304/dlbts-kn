import { error, fail } from '@sveltejs/kit';
import { translate } from '#lib/i18n/index.ts';
import { failWith } from '#lib/server/errors.ts';
import { bool, int, isUuid, num, optStr, str } from '#lib/server/form.ts';
import { loadGroupsWithEvents, loadJudges } from '#lib/server/admin.ts';
import { saveEvent } from '#lib/server/events.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const db = locals.supabase;
	if (!isUuid(params.id)) error(404, { message: 'Not found' });
	const { data: event } = await db
		.from('events')
		.select('*, groups(id, name, code)')
		.eq('id', params.id)
		.maybeSingle();
	if (!event) error(404, { message: 'Not found' });

	const [criteriaRes, entriesRes, assignRes, scoredRes, groups, judges, poolRes] =
		await Promise.all([
			db
				.from('evaluation_criteria')
				.select('*')
				.eq('event_id', event.id)
				.order('display_order')
				.order('name'),
			db
				.from('event_participants')
				.select(
					'id, is_active, display_order, participants(id, code, name, kind, affiliation, is_active)'
				)
				.eq('event_id', event.id),
			db
				.from('judge_assignments')
				.select(
					'id, is_active, judge_id, profiles!judge_assignments_judge_id_fkey(id, username, display_name, is_active)'
				)
				.eq('event_id', event.id),
			db.rpc('event_has_scores', { p_event_id: event.id }),
			loadGroupsWithEvents(db),
			loadJudges(db),
			db
				.from('participants')
				.select('id, code, name')
				.eq('group_id', event.group_id)
				.eq('is_active', true)
				.order('code')
		]);

	const entries = (entriesRes.data ?? [])
		.filter((e) => e.participants)
		.sort(
			(a, b) =>
				a.display_order - b.display_order ||
				a.participants!.code.localeCompare(b.participants!.code)
		);
	const linked = new Set(entries.map((e) => e.participants!.id));

	return {
		event,
		criteria: (criteriaRes.data ?? []).map((c) => ({ ...c, max_marks: Number(c.max_marks) })),
		entries,
		assignments: assignRes.data ?? [],
		scoringStarted: !!scoredRes.data,
		groups,
		judges,
		available: (poolRes.data ?? []).filter((p) => !linked.has(p.id))
	};
};

export const actions: Actions = {
	saveEvent: async ({ request, locals }) => saveEvent(locals, await request.formData()),

	saveCriterion: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = str(f, 'id');
		const max = num(f, 'max_marks');
		const name = str(f, 'name');
		if (!name || max === null || max <= 0 || max > 1000) {
			return fail(400, { error: translate(locals.locale, 'error.OUT_OF_RANGE') });
		}
		const { error } = await locals.supabase.rpc('admin_save_criterion', {
			p_event_id: params.id,
			p_id: isUuid(id) ? id : (null as unknown as string),
			p_name: name,
			p_description: optStr(f, 'description') ?? '',
			p_max_marks: max,
			p_display_order: int(f, 'display_order'),
			p_is_active: isUuid(id) ? bool(f, 'is_active') : true,
			p_reason: optStr(f, 'reason') ?? ''
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	},

	setParticipant: async ({ request, locals, params }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.rpc('admin_set_event_participant', {
			p_event_id: params.id,
			p_participant_id: str(f, 'participant_id'),
			p_active: bool(f, 'active'),
			p_reason: optStr(f, 'reason') ?? ''
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	},

	setAssignment: async ({ request, locals, params }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.rpc('admin_set_assignment', {
			p_event_id: params.id,
			p_judge_id: str(f, 'judge_id'),
			p_active: bool(f, 'active'),
			p_reason: optStr(f, 'reason') ?? ''
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	}
};

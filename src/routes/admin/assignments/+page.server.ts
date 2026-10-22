import { translate } from '#lib/i18n/index.ts';
import { failWith } from '#lib/server/errors.ts';
import { bool, optStr, str } from '#lib/server/form.ts';
import { eventsWithScores, loadGroupsWithEvents, loadJudges } from '#lib/server/admin.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.supabase;
	const [groups, judges, { data: assigns }] = await Promise.all([
		loadGroupsWithEvents(db),
		loadJudges(db),
		db.from('judge_assignments').select('id, event_id, judge_id, is_active')
	]);
	const scored = await eventsWithScores(
		db,
		groups.flatMap((g) => g.events.map((e) => e.id))
	);
	return { groups, judges, assignments: assigns ?? [], scored: [...scored] };
};

export const actions: Actions = {
	set: async ({ request, locals }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.rpc('admin_set_assignment', {
			p_event_id: str(f, 'event_id'),
			p_judge_id: str(f, 'judge_id'),
			p_active: bool(f, 'active'),
			p_reason: optStr(f, 'reason') ?? ''
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	}
};

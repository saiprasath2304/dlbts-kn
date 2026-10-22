import { realtimeToken } from '#lib/server/admin.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const db = locals.supabase;
	const [progressRes, judgesRes, assignRes, groupsRes] = await Promise.all([
		db.rpc('admin_event_progress'),
		db
			.from('profiles')
			.select('id, display_name, username')
			.eq('role', 'judge')
			.eq('is_active', true)
			.order('username'),
		db.from('judge_assignments').select('event_id, judge_id').eq('is_active', true),
		db.from('groups').select('id').eq('is_active', true)
	]);

	const all = (progressRes.data ?? []).filter((e) => e.event_active);
	const group = url.searchParams.get('group') ?? '';
	const event = url.searchParams.get('event') ?? '';
	const judge = url.searchParams.get('judge') ?? '';
	const judgeEvents = new Set(
		(assignRes.data ?? []).filter((a) => a.judge_id === judge).map((a) => a.event_id)
	);

	const rows = all.filter(
		(e) =>
			(!group || e.group_id === group) &&
			(!event || e.event_id === event) &&
			(!judge || judgeEvents.has(e.event_id))
	);
	const sum = (
		k:
			| 'required_judges'
			| 'submitted'
			| 'in_progress'
			| 'not_started'
			| 'reopening_pending'
			| 'corrections_open'
	) => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
	const isComplete = (r: (typeof rows)[number]) =>
		r.required_judges > 0 && r.submitted === r.required_judges && r.incomplete_submissions === 0;

	return {
		filters: { group, event, judge },
		groupsOptions: [...new Map(all.map((e) => [e.group_id, e.group_name])).entries()],
		eventOptions: all.map((e) => ({
			id: e.event_id,
			name: e.event_name,
			group: e.group_name,
			group_id: e.group_id
		})),
		judges: judgesRes.data ?? [],
		stats: {
			groups: (groupsRes.data ?? []).length,
			events: rows.length,
			assigned: sum('required_judges'),
			submitted: sum('submitted'),
			in_progress: sum('in_progress'),
			not_started: sum('not_started'),
			reopen: sum('reopening_pending'),
			corrections: sum('corrections_open'),
			complete: rows.filter(isComplete).length,
			waiting: rows.filter((r) => !isComplete(r)).length
		},
		rows: rows.map((r) => ({ ...r, complete: isComplete(r) })),
		token: await realtimeToken(db),
		loadedAt: new Date().toISOString()
	};
};

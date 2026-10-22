import { isUuid } from '#lib/server/form.ts';
import { loadGroupsWithEvents, loadJudges, realtimeToken } from '#lib/server/admin.ts';
import type { SubmissionStatus } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const db = locals.supabase;
	const f = {
		group: url.searchParams.get('group') ?? '',
		event: url.searchParams.get('event') ?? '',
		judge: url.searchParams.get('judge') ?? '',
		status: url.searchParams.get('status') ?? ''
	};
	let q = db
		.from('submissions')
		.select(
			'id, status, round, submitted_at, last_saved_at, event_id, judge_id, events(name, group_id, groups(name)), profiles!submissions_judge_id_fkey(display_name, username)'
		)
		.order('event_id');
	if (isUuid(f.event)) q = q.eq('event_id', f.event);
	if (isUuid(f.judge)) q = q.eq('judge_id', f.judge);
	if (f.status) q = q.eq('status', f.status as SubmissionStatus);
	const [{ data }, groups, judges, { data: active }] = await Promise.all([
		q,
		loadGroupsWithEvents(db),
		loadJudges(db),
		db.from('judge_assignments').select('event_id, judge_id').eq('is_active', true)
	]);
	const required = new Set((active ?? []).map((a) => `${a.event_id}|${a.judge_id}`));
	const rows = (data ?? [])
		.filter((s) => !isUuid(f.group) || s.events?.group_id === f.group)
		.map((s) => ({ ...s, required: required.has(`${s.event_id}|${s.judge_id}`) }));
	return { rows, groups, judges, filters: f, token: await realtimeToken(db) };
};

import { isUuid } from '#lib/server/form.ts';
import { loadGroupsWithEvents } from '#lib/server/admin.ts';
import type { PageServerLoad } from './$types';

const PAGE = 50;
const ACTION_PREFIXES = [
	'scores',
	'score',
	'submission',
	'reopening',
	'correction',
	'results',
	'tie',
	'participants',
	'event_participants',
	'evaluation_criteria',
	'judge_assignments',
	'judge',
	'profiles',
	'events',
	'groups',
	'report_records',
	'app_settings'
];

export const load: PageServerLoad = async ({ locals, url }) => {
	const db = locals.supabase;
	const f = {
		from: url.searchParams.get('from') ?? '',
		to: url.searchParams.get('to') ?? '',
		actor: url.searchParams.get('actor') ?? '',
		event: url.searchParams.get('event') ?? '',
		participant: (url.searchParams.get('participant') ?? '').trim().toUpperCase(),
		action: url.searchParams.get('action') ?? '',
		before: Number(url.searchParams.get('before') ?? 0)
	};

	let q = db
		.from('audit_logs')
		.select('*')
		.order('id', { ascending: false })
		.limit(PAGE + 1);
	if (/^\d{4}-\d{2}-\d{2}$/.test(f.from)) q = q.gte('created_at', `${f.from}T00:00:00+05:30`);
	if (/^\d{4}-\d{2}-\d{2}$/.test(f.to)) q = q.lte('created_at', `${f.to}T23:59:59.999+05:30`);
	if (isUuid(f.actor)) q = q.eq('actor_id', f.actor);
	if (isUuid(f.event)) q = q.eq('event_id', f.event);
	if (ACTION_PREFIXES.includes(f.action)) q = q.like('action', `${f.action}.%`);
	if (f.before > 0) q = q.lt('id', f.before);
	if (f.participant) {
		const { data: p } = await db
			.from('participants')
			.select('id')
			.eq('code', f.participant)
			.maybeSingle();
		q = q.eq('participant_id', p?.id ?? '00000000-0000-0000-0000-000000000000');
	}

	const [{ data: rows }, { data: people }, groups] = await Promise.all([
		q,
		db.from('profiles').select('id, display_name, username, role').order('username'),
		loadGroupsWithEvents(db)
	]);
	const list = rows ?? [];
	return {
		rows: list.slice(0, PAGE),
		next: list.length > PAGE ? list[PAGE - 1].id : null,
		people: people ?? [],
		groups,
		filters: f,
		actions: ACTION_PREFIXES
	};
};

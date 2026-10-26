import { requireJudge } from '#lib/server/guards.ts';
import type { SubmissionStatus } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const judge = requireJudge(locals);
	const db = locals.supabase;

	const [assignRes, subsRes, entriesRes, criteriaRes, corrRes] = await Promise.all([
		db
			.from('judge_assignments')
			.select(
				'event_id, events(id, name, code, description, venue, display_order, groups(name, code, display_order))'
			)
			.eq('judge_id', judge.id)
			.eq('is_active', true),
		db
			.from('submissions')
			.select('id, event_id, status, submitted_at, last_saved_at')
			.eq('judge_id', judge.id),
		db.from('event_participants').select('event_id').eq('is_active', true),
		db.from('evaluation_criteria').select('event_id').eq('is_active', true),
		db.from('correction_requests').select('event_id, status').eq('status', 'open')
	]);

	const count = (rows: { event_id: string }[] | null, id: string) =>
		(rows ?? []).filter((r) => r.event_id === id).length;

	const events = (assignRes.data ?? [])
		.filter((a) => a.events)
		.map((a) => {
			const e = a.events!;
			const sub = subsRes.data?.find((s) => s.event_id === e.id);
			return {
				id: e.id,
				name: e.name,
				description: e.description,
				venue: e.venue,
				group: e.groups?.name ?? '',
				groupOrder: e.groups?.display_order ?? 0,
				order: e.display_order,
				status: (sub?.status ?? 'not_started') as SubmissionStatus,
				submitted_at: sub?.submitted_at ?? null,
				last_saved_at: sub?.last_saved_at ?? null,
				participants: count(entriesRes.data, e.id),
				criteria: count(criteriaRes.data, e.id),
				openCorrections: count(corrRes.data, e.id)
			};
		})
		.sort(
			(a, b) => a.groupOrder - b.groupOrder || a.order - b.order || a.name.localeCompare(b.name)
		);

	return { events };
};

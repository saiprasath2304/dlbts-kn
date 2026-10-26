import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/database.types.ts';
import { sumMarks } from '#lib/scoring.ts';
import type { FeedbackParticipant } from './pdf.ts';

type Db = SupabaseClient<Database>;

/**
 * Judges' remarks (and optionally totals) for one event, or for one participant
 * across all their events. Judges are anonymised as Judge 1, 2… per event,
 * ordered by username so the numbering is stable.
 */
export async function loadFeedback(
	db: Db,
	opts: { eventId?: string; participantId?: string }
): Promise<FeedbackParticipant[]> {
	let pq = db
		.from('participants')
		.select(
			'id, code, name, affiliation, members, groups(name), event_participants(is_active, event_id, events(id, name, venue, is_active, display_order))'
		)
		.eq('is_active', true)
		.order('code');
	if (opts.participantId) pq = pq.eq('id', opts.participantId);
	const { data: people } = await pq;
	const rows = (people ?? [])
		.map((p) => ({
			...p,
			events: p.event_participants
				.filter(
					(l) =>
						l.is_active && l.events?.is_active && (!opts.eventId || l.event_id === opts.eventId)
				)
				.map((l) => l.events!)
				.sort((a, b) => a.display_order - b.display_order)
		}))
		.filter((p) => p.events.length > 0);
	if (rows.length === 0) return [];

	const eventIds = [...new Set(rows.flatMap((p) => p.events.map((e) => e.id)))];
	const participantIds = rows.map((p) => p.id);

	const [{ data: assigns }, { data: subs }, { data: crit }] = await Promise.all([
		db
			.from('judge_assignments')
			.select('event_id, judge_id, profiles!judge_assignments_judge_id_fkey(username)')
			.in('event_id', eventIds)
			.eq('is_active', true),
		db.from('submissions').select('id, event_id, judge_id').in('event_id', eventIds),
		db
			.from('evaluation_criteria')
			.select('id, event_id, max_marks')
			.in('event_id', eventIds)
			.eq('is_active', true)
	]);
	const subIds = (subs ?? []).map((s) => s.id);
	const [{ data: remarks }, { data: scores }] = subIds.length
		? await Promise.all([
				db
					.from('participant_remarks')
					.select('submission_id, participant_id, remark')
					.in('submission_id', subIds)
					.in('participant_id', participantIds),
				db
					.from('criterion_scores')
					.select('submission_id, participant_id, criterion_id, value')
					.in('submission_id', subIds)
					.in('participant_id', participantIds)
			])
		: [{ data: [] }, { data: [] }];

	const activeCrit = new Set((crit ?? []).map((c) => c.id));
	const maxByEvent = new Map<string, number>();
	for (const c of crit ?? [])
		maxByEvent.set(c.event_id, sumMarks([maxByEvent.get(c.event_id) ?? 0, Number(c.max_marks)]));

	return rows.map((p) => ({
		name: p.name,
		code: p.code,
		affiliation: p.affiliation,
		members: p.members,
		group: p.groups?.name ?? '',
		events: p.events.map((e) => {
			const judges = (assigns ?? [])
				.filter((a) => a.event_id === e.id)
				.sort((a, b) => (a.profiles?.username ?? '').localeCompare(b.profiles?.username ?? ''));
			return {
				event: e.name,
				venue: e.venue,
				judges: judges.map((a, i) => {
					const sub = (subs ?? []).find((s) => s.event_id === e.id && s.judge_id === a.judge_id);
					const remark =
						(remarks ?? []).find((r) => r.submission_id === sub?.id && r.participant_id === p.id)
							?.remark ?? '';
					const mine = (scores ?? []).filter(
						(s) =>
							s.submission_id === sub?.id &&
							s.participant_id === p.id &&
							activeCrit.has(s.criterion_id)
					);
					return {
						label: i + 1,
						remark,
						total: mine.length
							? sumMarks(mine.map((s) => (s.value === null ? null : Number(s.value))))
							: null,
						max: maxByEvent.get(e.id) ?? 0
					};
				})
			};
		})
	}));
}

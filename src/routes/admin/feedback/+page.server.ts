import { isUuid } from '#lib/server/form.ts';
import { loadGroupsWithEvents } from '#lib/server/admin.ts';
import type { PageServerLoad } from './$types';

/**
 * Feedback reports can be scoped by event, by Samithi, or both.
 * Each listed participant counts the non-empty remarks they received
 * (within the chosen event, or across all their events).
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const db = locals.supabase;
	const eventId = url.searchParams.get('event') ?? '';
	const samithi = (url.searchParams.get('samithi') ?? '').trim();
	const [groups, { data: units }] = await Promise.all([
		loadGroupsWithEvents(db),
		db.from('participants').select('affiliation').not('affiliation', 'is', null).limit(5000)
	]);
	const samithis = [
		...new Set((units ?? []).map((u) => u.affiliation!.trim()).filter(Boolean))
	].sort((a, b) => a.localeCompare(b));

	let participants: {
		id: string;
		code: string;
		name: string;
		kind: string;
		affiliation: string | null;
		events: string[];
		remarks: number;
	}[] = [];

	if (isUuid(eventId) || samithi) {
		let q = db
			.from('participants')
			.select(
				'id, code, name, kind, affiliation, event_participants(is_active, event_id, events(name))'
			)
			.eq('is_active', true)
			.order('code')
			.limit(2000);
		if (samithi) q = q.eq('affiliation', samithi);
		const { data: people } = await q;
		const rows = (people ?? [])
			.map((p) => ({
				...p,
				links: p.event_participants.filter(
					(l) => l.is_active && (!isUuid(eventId) || l.event_id === eventId)
				)
			}))
			.filter((p) => p.links.length > 0);

		const eventIds = [...new Set(rows.flatMap((p) => p.links.map((l) => l.event_id)))];
		const { data: subs } = eventIds.length
			? await db.from('submissions').select('id').in('event_id', eventIds)
			: { data: [] as { id: string }[] };
		const subIds = (subs ?? []).map((s) => s.id);
		const { data: remarks } = subIds.length
			? await db
					.from('participant_remarks')
					.select('participant_id, remark')
					.in('submission_id', subIds)
					.in(
						'participant_id',
						rows.map((p) => p.id)
					)
			: { data: [] as { participant_id: string; remark: string }[] };

		participants = rows.map((p) => ({
			id: p.id,
			code: p.code,
			name: p.name,
			kind: p.kind,
			affiliation: p.affiliation,
			events: p.links.map((l) => l.events?.name ?? '').filter(Boolean),
			remarks: (remarks ?? []).filter((r) => r.participant_id === p.id && r.remark.trim()).length
		}));
	}
	return { groups, samithis, eventId, samithi, participants };
};

import { isUuid } from '#lib/server/form.ts';
import { loadGroupsWithEvents } from '#lib/server/admin.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const db = locals.supabase;
	const eventId = url.searchParams.get('event') ?? '';
	const groups = await loadGroupsWithEvents(db);
	let participants: { id: string; code: string; name: string; kind: string; remarks: number }[] =
		[];
	if (isUuid(eventId)) {
		const [{ data: entries }, { data: subs }] = await Promise.all([
			db
				.from('event_participants')
				.select('participants(id, code, name, kind, is_active)')
				.eq('event_id', eventId)
				.eq('is_active', true),
			db.from('submissions').select('id').eq('event_id', eventId)
		]);
		const subIds = (subs ?? []).map((s) => s.id);
		const { data: remarks } = subIds.length
			? await db
					.from('participant_remarks')
					.select('participant_id, remark')
					.in('submission_id', subIds)
			: { data: [] as { participant_id: string; remark: string }[] };
		participants = (entries ?? [])
			.map((e) => e.participants)
			.filter((p): p is NonNullable<typeof p> => !!p && p.is_active)
			.map((p) => ({
				id: p.id,
				code: p.code,
				name: p.name,
				kind: p.kind,
				remarks: (remarks ?? []).filter((r) => r.participant_id === p.id && r.remark.trim()).length
			}))
			.sort((a, b) => a.code.localeCompare(b.code));
	}
	return { groups, eventId, participants };
};

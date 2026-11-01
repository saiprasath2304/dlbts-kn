import { loadGroupsWithEvents } from '#lib/server/admin.ts';
import type { PageServerLoad } from './$types';

/** Every active participant; the page filters in the browser so it responds instantly. */
export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.supabase;
	const [{ data }, groups] = await Promise.all([
		db
			.from('participants')
			.select(
				'id, code, name, registration_no, affiliation, group_id, attendance, event_participants(is_active, event_id)'
			)
			.eq('is_active', true)
			.order('code')
			.limit(5000),
		loadGroupsWithEvents(db)
	]);
	const participants = (data ?? []).map((p) => ({
		id: p.id,
		code: p.code,
		name: p.name,
		label: p.registration_no?.trim() || p.code,
		affiliation: p.affiliation?.trim() || null,
		group_id: p.group_id,
		attendance: p.attendance as 'present' | 'absent' | null,
		eventIds: p.event_participants.filter((l) => l.is_active).map((l) => l.event_id)
	}));
	const samithis = [
		...new Set(participants.map((p) => p.affiliation).filter((s): s is string => !!s))
	].sort((a, b) => a.localeCompare(b));
	return { participants, groups, samithis };
};

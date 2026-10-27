import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/database.types.ts';

type Db = SupabaseClient<Database>;

/** Groups with their events, ordered for menus and filters. */
export async function loadGroupsWithEvents(db: Db) {
	const [{ data: groups }, { data: events }] = await Promise.all([
		db
			.from('groups')
			.select('id, code, name, description, display_order, is_active')
			.order('display_order')
			.order('name'),
		db
			.from('events')
			.select(
				'id, group_id, code, name, display_order, is_active, score_precision, venue, participation'
			)
			.order('display_order')
			.order('name')
	]);
	return (groups ?? []).map((g) => ({
		...g,
		events: (events ?? []).filter((e) => e.group_id === g.id)
	}));
}

export async function loadJudges(db: Db) {
	const { data } = await db
		.from('profiles')
		.select('id, username, display_name, is_active, created_at')
		.eq('role', 'judge')
		.order('username');
	return data ?? [];
}

export async function eventsWithScores(db: Db, eventIds: string[]): Promise<Set<string>> {
	const result = new Set<string>();
	await Promise.all(
		eventIds.map(async (id) => {
			const { data } = await db.rpc('event_has_scores', { p_event_id: id });
			if (data) result.add(id);
		})
	);
	return result;
}

/** Access token for the admin's own Realtime subscription (RLS still applies). */
export async function realtimeToken(db: Db): Promise<string | null> {
	const { data } = await db.auth.getSession();
	return data.session?.access_token ?? null;
}

import { error } from '@sveltejs/kit';
import { errorCode } from './errors.ts';
import type { SubmissionStatus } from '#lib/types.ts';

export interface LeaderboardRow {
	participant_id: string;
	code: string;
	/** Registration number, or the code when there is none. */
	label: string;
	/** Only filled in for admins. */
	name: string | null;
	judges: { n: number; total: number | null; filled: number }[];
	total: number | null;
	filled: number;
	rank: number | null;
	tied: boolean;
}

export interface Leaderboard {
	judges: { n: number; is_me: boolean; status: SubmissionStatus }[];
	criteria: number;
	max: number;
	rows: LeaderboardRow[];
}

/** Combined marks of every judge of an event, best first (see event_leaderboard in SQL). */
export async function loadLeaderboard(locals: App.Locals, eventId: string): Promise<Leaderboard> {
	const { data, error: err } = await locals.supabase.rpc('event_leaderboard', {
		p_event_id: eventId
	});
	if (err) {
		const { code } = errorCode(err);
		error(code === 'FORBIDDEN' ? 403 : 500, { message: code });
	}
	const lb = data as unknown as Leaderboard;
	return {
		...lb,
		max: Number(lb.max),
		rows: lb.rows.map((r) => ({
			...r,
			total: r.total === null ? null : Number(r.total),
			judges: r.judges.map((j) => ({ ...j, total: j.total === null ? null : Number(j.total) }))
		}))
	};
}

/** Tied children grouped by their shared total, highest first. */
export function tieGroups(
	rows: LeaderboardRow[]
): { rank: number; total: number; labels: string[] }[] {
	const out = new Map<number, { rank: number; total: number; labels: string[] }>();
	for (const r of rows) {
		if (!r.tied || r.total === null || r.rank === null) continue;
		const g = out.get(r.total) ?? { rank: r.rank, total: r.total, labels: [] };
		g.labels.push(r.label);
		out.set(r.total, g);
	}
	return [...out.values()].sort((a, b) => a.rank - b.rank);
}

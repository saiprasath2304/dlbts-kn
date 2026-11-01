import { requireJudge } from '#lib/server/guards.ts';
import { loadJudgeEvent } from '#lib/server/judge.ts';
import { loadLeaderboard } from '#lib/server/leaderboard.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, depends }) => {
	requireJudge(locals);
	depends('judge:leaderboard');
	const [{ event, group, submission }, leaderboard] = await Promise.all([
		loadJudgeEvent(locals, params.eventId),
		loadLeaderboard(locals, params.eventId)
	]);
	return { event, group, submission, leaderboard };
};

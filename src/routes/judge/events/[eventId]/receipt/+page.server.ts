import { loadJudgeEvent } from '#lib/server/judge.ts';
import { requireJudge } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requireJudge(locals);
	const data = await loadJudgeEvent(locals, params.eventId);
	const { data: rounds } = await locals.supabase
		.from('submission_rounds')
		.select('round, status, submitted_at, totals')
		.eq('submission_id', data.submission.id)
		.order('round', { ascending: false })
		.limit(1);
	return {
		...data,
		latest: rounds?.[0] ?? null,
		justSubmitted: url.searchParams.get('submitted') === '1'
	};
};

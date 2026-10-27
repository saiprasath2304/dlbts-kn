import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Whether the organisers have opened marking (polled by the scoring page). */
export const GET: RequestHandler = async ({ locals }) => {
	const { data } = await locals.supabase.rpc('scoring_is_open');
	return json({ scoringOpen: data === true }, { headers: { 'cache-control': 'no-store' } });
};

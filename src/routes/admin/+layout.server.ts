import { requireAdmin } from '#lib/server/guards.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const db = locals.supabase;
	const [{ count: reopen }, { count: corrections }, { count: participantReqs }] = await Promise.all(
		[
			db
				.from('reopening_requests')
				.select('id', { count: 'exact', head: true })
				.eq('status', 'pending'),
			db
				.from('correction_requests')
				.select('id', { count: 'exact', head: true })
				.in('status', ['open', 'responded']),
			db
				.from('participant_requests')
				.select('id', { count: 'exact', head: true })
				.eq('status', 'pending')
		]
	);
	return { pendingRequests: (reopen ?? 0) + (corrections ?? 0) + (participantReqs ?? 0) };
};

import type { EventResults } from '#lib/results.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.supabase;
	const { data: progress } = await db.rpc('admin_event_progress');
	const events = await Promise.all(
		(progress ?? [])
			.filter((e) => e.event_active)
			.map(async (e) => {
				const { data } = await db.rpc('get_event_results', { p_event_id: e.event_id });
				const r = data as unknown as EventResults | null;
				return {
					id: e.event_id,
					name: e.event_name,
					group: e.group_name,
					status: r?.status ?? 'judging_in_progress',
					submitted: e.submitted,
					required: e.required_judges,
					unresolved: r?.unresolved_ties ?? 0
				};
			})
	);
	return { events };
};

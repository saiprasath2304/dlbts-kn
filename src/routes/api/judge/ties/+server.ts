import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Provisional ties in the top 3 of an assigned event (names only, no scores). */
export const GET: RequestHandler = async ({ url, locals }) => {
	const eventId = url.searchParams.get('event') ?? '';
	if (!/^[0-9a-f-]{36}$/i.test(eventId)) return json([], { status: 400 });
	const { data, error } = await locals.supabase.rpc('event_tie_alerts', { p_event_id: eventId });
	if (error) return json([]);
	return json(data ?? [], { headers: { 'cache-control': 'no-store' } });
};

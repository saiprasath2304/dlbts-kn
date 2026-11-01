import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { errorCode } from '#lib/server/errors.ts';
import type { RequestHandler } from './$types';

const Body = z.object({
	participant_id: z.uuid(),
	status: z.enum(['present', 'absent']).nullable()
});

/** Mark a participant present / absent (null clears it). Saved as soon as the admin ticks. */
export const POST: RequestHandler = async ({ request, locals }) => {
	let body: z.infer<typeof Body>;
	try {
		body = Body.parse(await request.json());
	} catch {
		return json({ code: 'INVALID_REQUEST' }, { status: 400 });
	}
	const { data, error } = await locals.supabase.rpc('admin_set_attendance', {
		p_participant_id: body.participant_id,
		p_status: body.status
	});
	if (error) return json({ code: errorCode(error).code }, { status: 400 });
	return json(data);
};

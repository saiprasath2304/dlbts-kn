import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { errorCode } from '#lib/server/errors.ts';
import type { RequestHandler } from './$types';

const Change = z.object({
	participant_id: z.uuid(),
	criterion_id: z.uuid(),
	value: z.number().finite().min(0).max(1000).nullable(),
	base_version: z.number().int().min(0)
});
const Body = z.object({
	submission_id: z.uuid(),
	changes: z.array(Change).min(1).max(1000)
});

/**
 * Autosave endpoint. Totals are never accepted from the client: only raw
 * criterion marks, which the database validates, locks and versions.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	let body: z.infer<typeof Body>;
	try {
		body = Body.parse(await request.json());
	} catch {
		return json({ code: 'INVALID_REQUEST' }, { status: 400 });
	}

	const { data, error } = await locals.supabase.rpc('save_scores', {
		p_submission_id: body.submission_id,
		p_changes: body.changes
	});
	if (error) {
		const { code } = errorCode(error);
		const status =
			code === 'SUBMISSION_LOCKED'
				? 409
				: code === 'SCORING_LOCKED'
					? 423
					: code === 'NOT_FOUND'
						? 404
						: 400;
		return json({ code }, { status });
	}
	return json(data);
};

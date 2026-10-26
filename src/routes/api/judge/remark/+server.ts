import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { errorCode } from '#lib/server/errors.ts';
import type { RequestHandler } from './$types';

const Body = z.object({
	submission_id: z.uuid(),
	participant_id: z.uuid(),
	remark: z.string().max(2000)
});

/** Judge remark autosave. Only while the judge's own submission is editable. */
export const POST: RequestHandler = async ({ request, locals }) => {
	let body: z.infer<typeof Body>;
	try {
		body = Body.parse(await request.json());
	} catch {
		return json({ code: 'INVALID_REQUEST' }, { status: 400 });
	}
	const { data, error } = await locals.supabase.rpc('save_remark', {
		p_submission_id: body.submission_id,
		p_participant_id: body.participant_id,
		p_remark: body.remark
	});
	if (error) {
		const { code } = errorCode(error);
		return json(
			{ code },
			{ status: code === 'SUBMISSION_LOCKED' ? 409 : code === 'NOT_FOUND' ? 404 : 400 }
		);
	}
	return json(data);
};

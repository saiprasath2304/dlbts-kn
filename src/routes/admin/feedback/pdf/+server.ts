import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.ts';
import { isUuid } from '#lib/server/form.ts';
import { getSettings } from '#lib/server/settings.ts';
import { loadFeedback } from '#lib/server/reports/feedback.ts';
import { renderFeedback } from '#lib/server/reports/pdf.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	requireAdmin(locals);
	const eventId = url.searchParams.get('event');
	const participantId = url.searchParams.get('participant');
	const samithi = (url.searchParams.get('samithi') ?? '').trim();
	if (!isUuid(eventId) && !isUuid(participantId) && !samithi)
		error(400, { message: 'Choose an event or participant' });
	const locale =
		url.searchParams.get('locale') === 'ta'
			? 'ta'
			: url.searchParams.get('locale') === 'en'
				? 'en'
				: locals.locale;
	const participants = await loadFeedback(locals.supabase, {
		eventId: isUuid(eventId) ? eventId : undefined,
		participantId: isUuid(participantId) ? participantId : undefined,
		samithi: samithi || undefined
	});
	const settings = await getSettings();
	const pdf = await renderFeedback({
		title: settings.app_title,
		locale,
		generatedAt: new Date(),
		includeMarks: url.searchParams.get('marks') === '1',
		participants
	});
	const slug = (
		participants.length === 1
			? participants[0].code
			: [samithi, isUuid(eventId) ? eventId.slice(0, 8) : ''].filter(Boolean).join('-') || 'all'
	).replace(/[^A-Za-z0-9._-]/g, '_');
	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `${url.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'}; filename="feedback-${slug}.pdf"`,
			'cache-control': 'no-store'
		}
	});
};

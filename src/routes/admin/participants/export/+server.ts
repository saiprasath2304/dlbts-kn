import { exportRows, EXPORT_HEADER } from '#lib/server/participants.ts';
import { toCsv } from '#lib/import/participants.ts';
import { toXlsx } from '#lib/server/spreadsheet.ts';
import { isUuid } from '#lib/server/form.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const group = url.searchParams.get('group');
	const event = url.searchParams.get('event');
	const rows = await exportRows(locals.supabase, {
		group: isUuid(group) ? group : undefined,
		event: isUuid(event) ? event : undefined
	});
	const stamp = new Date().toISOString().slice(0, 10);
	if (url.searchParams.get('format') === 'xlsx') {
		const body = await toXlsx('participants', EXPORT_HEADER, rows);
		return new Response(body, {
			headers: {
				'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'content-disposition': `attachment; filename="participants-${stamp}.xlsx"`
			}
		});
	}
	return new Response(toCsv(EXPORT_HEADER, rows), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="participants-${stamp}.csv"`
		}
	});
};

import { error } from '@sveltejs/kit';
import { generateReport, parseReportParams } from '#lib/server/reports/generate.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	requireAdmin(locals);
	const params = parseReportParams(url.searchParams);
	const { pdf, filename, recordError } = await generateReport(locals, params);
	if (recordError) {
		console.error('report record failed', recordError.message);
		error(500, { message: 'Report could not be recorded' });
	}
	const disposition = url.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment';
	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `${disposition}; filename="${filename}"`,
			'cache-control': 'no-store'
		}
	});
};

import { getSettings } from '../settings.ts';
import { loadFinalReportData, loadProgressReportData } from './data.ts';
import { renderReport } from './pdf.ts';
import type { Locale } from '#lib/types.ts';

export interface ReportParams {
	kind: 'final' | 'progress';
	locale: Locale;
	breakdown: boolean;
}

export function parseReportParams(sp: URLSearchParams | FormData): ReportParams {
	const kind = sp.get('kind') === 'progress' ? 'progress' : 'final';
	const locale = sp.get('locale') === 'ta' ? 'ta' : 'en';
	const b = sp.get('breakdown');
	return { kind, locale, breakdown: b === '1' || b === 'on' || b === 'true' };
}

/** Build the PDF and record the generation (audited via report_records trigger). */
export async function generateReport(
	locals: App.Locals,
	params: ReportParams,
	extra: { idempotencyKey?: string; emailPending?: boolean; recipientMasked?: string } = {}
) {
	const settings = await getSettings();
	const generatedAt = new Date();
	const input =
		params.kind === 'final'
			? {
					kind: 'final' as const,
					title: settings.app_title,
					locale: params.locale,
					generatedAt,
					breakdown: params.breakdown,
					events: await loadFinalReportData(locals.supabase)
				}
			: {
					kind: 'progress' as const,
					title: settings.app_title,
					locale: params.locale,
					generatedAt,
					events: await loadProgressReportData(locals.supabase)
				};
	const { pdf, sha256 } = await renderReport(input);

	const eventIds =
		input.kind === 'final'
			? input.events.filter((e) => e.snapshot).map((e) => e.snapshot!.event_id)
			: [];
	const { data: record, error } = await locals.supabase
		.from('report_records')
		.insert({
			kind: params.kind,
			locale: params.locale,
			include_breakdown: params.breakdown,
			event_ids: eventIds,
			generated_by: locals.profile!.id,
			file_sha256: sha256,
			byte_size: pdf.length,
			idempotency_key: extra.idempotencyKey ?? null,
			email_status: extra.emailPending ? 'pending' : 'not_requested',
			email_recipient_masked: extra.recipientMasked ?? null
		})
		.select('id')
		.single();

	const stamp = generatedAt.toISOString().slice(0, 16).replace(/[:T]/g, '-');
	return {
		pdf,
		sha256,
		recordId: record?.id ?? null,
		recordError: error,
		filename: `${params.kind}-report-${params.locale}-${stamp}.pdf`
	};
}

import { fail } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { EMAIL_FROM, REPORT_EMAIL_TO, RESEND_API_KEY } from '$app/env/private';
import { translate } from '#lib/i18n/index.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { str } from '#lib/server/form.ts';
import { isEmailConfigured, maskEmail, sendEmail } from '#lib/server/email.ts';
import {
	generateReport,
	parseReportParams,
	type ReportParams
} from '#lib/server/reports/generate.ts';
import { getSettings } from '#lib/server/settings.ts';
import type { Actions, PageServerLoad } from './$types';

const emailConfig = () => ({ apiKey: RESEND_API_KEY, from: EMAIL_FROM, to: REPORT_EMAIL_TO });

export const load: PageServerLoad = async ({ locals }) => {
	const { data: history } = await locals.supabase
		.from('report_records')
		.select(
			'id, kind, locale, include_breakdown, generated_at, email_status, email_recipient_masked, email_attempts, email_last_error, email_sent_at, profiles!report_records_generated_by_fkey(display_name)'
		)
		.order('generated_at', { ascending: false })
		.limit(20);
	const cfg = emailConfig();
	return {
		history: history ?? [],
		emailConfigured: isEmailConfigured(cfg),
		recipient: cfg.to ? maskEmail(cfg.to) : null,
		idempotencyKey: randomUUID()
	};
};

async function emailReport(locals: App.Locals, params: ReportParams, key: string) {
	const t = (k: string, p?: Record<string, string>) => translate(locals.locale, k, p);
	const cfg = emailConfig();
	if (!isEmailConfigured(cfg)) return fail(400, { error: t('admin.reports.email_not_configured') });

	// One email per idempotency key, even if the button is pressed twice.
	const { data: existing } = await locals.supabase
		.from('report_records')
		.select('id, email_status')
		.eq('idempotency_key', key)
		.maybeSingle();
	if (existing) return { success: t('admin.reports.email_duplicate') };

	const report = await generateReport(locals, params, {
		idempotencyKey: key,
		emailPending: true,
		recipientMasked: maskEmail(cfg.to)
	});
	if (report.recordError) {
		if (report.recordError.code === '23505') return { success: t('admin.reports.email_duplicate') };
		return fail(500, { error: t('error.generic') });
	}
	const settings = await getSettings();
	const result = await sendEmail(cfg, {
		subject: `${settings.app_title} – ${t(params.kind === 'final' ? 'report.title' : 'report.progress_title')}`,
		text: t('report.generated', { time: new Date().toISOString() }),
		attachments: [{ filename: report.filename, content: report.pdf }],
		idempotencyKey: key
	});
	// Delivery status is recorded separately; results are never touched by email outcomes.
	await locals.supabase
		.from('report_records')
		.update(
			result.ok
				? {
						email_status: 'sent',
						email_attempts: 1,
						email_sent_at: new Date().toISOString(),
						provider_message_id: result.id
					}
				: { email_status: 'failed', email_attempts: 1, email_last_error: result.error }
		)
		.eq('id', report.recordId!);
	if (!result.ok)
		return fail(502, { error: t('admin.reports.email_failed', { error: result.error }) });
	return { success: t('admin.reports.email_sent', { to: maskEmail(cfg.to) }) };
}

export const actions: Actions = {
	email: async ({ request, locals }) => {
		requireAdmin(locals);
		const f = await request.formData();
		const key = str(f, 'idempotency_key');
		if (!/^[0-9a-f-]{36}$/.test(key))
			return fail(400, { error: translate(locals.locale, 'error.INVALID_REQUEST') });
		return emailReport(locals, parseReportParams(f), key);
	},
	resend: async ({ request, locals }) => {
		requireAdmin(locals);
		const f = await request.formData();
		const { data: rec } = await locals.supabase
			.from('report_records')
			.select('kind, locale, include_breakdown')
			.eq('id', str(f, 'id'))
			.maybeSingle();
		if (!rec) return fail(404, { error: translate(locals.locale, 'error.NOT_FOUND') });
		return emailReport(
			locals,
			{
				kind: rec.kind as 'final' | 'progress',
				locale: rec.locale as 'en' | 'ta',
				breakdown: rec.include_breakdown
			},
			randomUUID()
		);
	}
};

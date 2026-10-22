/**
 * Optional report delivery via Resend (https://resend.com). Configured purely
 * through server-side environment variables; if any are missing, email is
 * simply unavailable and PDF download keeps working.
 */
export interface EmailConfig {
	apiKey?: string;
	from?: string;
	to?: string;
}

export interface Attachment {
	filename: string;
	content: Buffer;
}

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export function isEmailConfigured(c: EmailConfig): c is Required<EmailConfig> {
	return !!(c.apiKey && c.from && c.to);
}

export function maskEmail(email: string): string {
	const [user, domain] = email.split('@');
	if (!domain) return '***';
	return `${user.slice(0, 1)}***@${domain}`;
}

export async function sendEmail(
	config: EmailConfig,
	msg: { subject: string; text: string; attachments: Attachment[]; idempotencyKey: string },
	fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
	if (!isEmailConfigured(config)) return { ok: false, error: 'not_configured' };
	try {
		const res = await fetchImpl('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json',
				// Resend de-duplicates retries carrying the same key.
				'Idempotency-Key': msg.idempotencyKey
			},
			body: JSON.stringify({
				from: config.from,
				to: [config.to],
				subject: msg.subject,
				text: msg.text,
				attachments: msg.attachments.map((a) => ({
					filename: a.filename,
					content: a.content.toString('base64')
				}))
			}),
			signal: AbortSignal.timeout(20_000)
		});
		if (!res.ok) {
			let detail = `HTTP ${res.status}`;
			try {
				const body = (await res.json()) as { message?: string; name?: string };
				if (body?.message) detail += `: ${String(body.message).slice(0, 200)}`;
			} catch {
				/* ignore */
			}
			return { ok: false, error: detail };
		}
		const body = (await res.json().catch(() => ({}))) as { id?: string };
		return { ok: true, id: body.id ?? null };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.name : 'network_error' };
	}
}

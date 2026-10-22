import { describe, expect, it, vi } from 'vitest';
import { isEmailConfigured, maskEmail, sendEmail } from './email';

const cfg = {
	apiKey: 're_test_secret',
	from: 'Results <results@example.org>',
	to: 'organiser@example.org'
};
const msg = {
	subject: 'Report',
	text: 'Attached',
	attachments: [{ filename: 'r.pdf', content: Buffer.from('%PDF') }],
	idempotencyKey: 'key-1'
};

describe('email delivery', () => {
	it('is optional: missing configuration never calls the provider', async () => {
		const fetchMock = vi.fn();
		expect(isEmailConfigured({})).toBe(false);
		expect(await sendEmail({ apiKey: 'x' }, msg, fetchMock)).toEqual({
			ok: false,
			error: 'not_configured'
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it('sends with an idempotency key and attachment', async () => {
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 })
		);
		const r = await sendEmail(cfg, msg, fetchMock as unknown as typeof fetch);
		expect(r).toEqual({ ok: true, id: 'msg_1' });
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.resend.com/emails');
		expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
		const body = JSON.parse(String(init.body));
		expect(body.to).toEqual(['organiser@example.org']);
		expect(body.attachments[0]).toEqual({
			filename: 'r.pdf',
			content: Buffer.from('%PDF').toString('base64')
		});
	});
	it('reports provider failures without leaking the API key', async () => {
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ message: 'Domain not verified' }), { status: 403 })
		);
		const r = await sendEmail(cfg, msg, fetchMock as unknown as typeof fetch);
		expect(r).toEqual({ ok: false, error: 'HTTP 403: Domain not verified' });
		expect(JSON.stringify(r)).not.toContain(cfg.apiKey);
	});
	it('handles network errors', async () => {
		const fetchMock = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		expect(await sendEmail(cfg, msg, fetchMock as unknown as typeof fetch)).toEqual({
			ok: false,
			error: 'TypeError'
		});
	});
	it('masks recipients for logs', () => {
		expect(maskEmail('organiser@example.org')).toBe('o***@example.org');
	});
});

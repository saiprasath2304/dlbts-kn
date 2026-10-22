import { error } from '@sveltejs/kit';
import type { Profile } from '#lib/types.ts';

export function requireAdmin(locals: App.Locals): Profile {
	if (!locals.profile || locals.profile.role !== 'admin') error(403, { message: 'Forbidden' });
	return locals.profile;
}

export function requireJudge(locals: App.Locals): Profile {
	if (!locals.profile || locals.profile.role !== 'judge') error(403, { message: 'Forbidden' });
	return locals.profile;
}

/** Only allow same-site relative redirect targets. */
export function safeNext(next: string | null, fallback: string): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\'))
		return fallback;
	return next;
}

export function reasonFrom(form: FormData): string | null {
	const r = String(form.get('reason') ?? '').trim();
	return r.length >= 3 ? r : null;
}

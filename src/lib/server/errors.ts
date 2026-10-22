import { fail } from '@sveltejs/kit';
import { errorMessage } from '#lib/i18n/index.ts';
import type { Locale } from '#lib/types.ts';

export interface DbError {
	message?: string;
	code?: string;
	details?: string | null;
	hint?: string | null;
}

/** Turn a PostgREST/Postgres error into one of our stable error codes. */
export function errorCode(error: DbError | null | undefined): { code: string; detail?: string } {
	if (!error) return { code: 'generic' };
	if (error.code === '23505') return { code: 'UNIQUE' };
	if (error.code === '42501') return { code: 'FORBIDDEN' };
	if (error.message && /^[A-Z][A-Z_]+$/.test(error.message)) {
		return { code: error.message, detail: error.details ?? undefined };
	}
	console.error('Unexpected database error:', error.code, error.message);
	return { code: 'generic' };
}

export function failWith(
	locale: Locale,
	error: DbError | null | undefined,
	extra: Record<string, unknown> = {}
) {
	const { code, detail } = errorCode(error);
	const status = code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : 400;
	return fail(status, { error: errorMessage(locale, code, detail), code, detail, ...extra });
}

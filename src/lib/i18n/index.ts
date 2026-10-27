import { en, type MessageKey } from './en';
import { ta } from './ta';
import type { Locale } from '#lib/types.ts';

export type { MessageKey };
export type Params = Record<string, string | number>;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, ta };

export function isLocale(value: unknown): value is Locale {
	return value === 'en' || value === 'ta';
}

/** Translate a key. Unknown keys fall back to English, then to the key itself. */
export function translate(locale: Locale, key: MessageKey | string, params?: Params): string {
	const dict = dictionaries[locale] ?? en;
	let text: string =
		(dict as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
	if (params) {
		for (const [name, value] of Object.entries(params)) {
			text = text.replaceAll(`{${name}}`, String(value));
		}
	}
	return text;
}

export function translator(locale: Locale) {
	return (key: MessageKey | string, params?: Params) => translate(locale, key, params);
}

/** Map a database/function error code to a translated message. */
export function errorMessage(locale: Locale, code: string | undefined, detail?: string): string {
	const key = `error.${code}`;
	if (code && key in en) return translate(locale, key, { detail: detail ?? '' });
	return translate(locale, 'error.generic');
}

export function formatDateTime(locale: Locale, value: string | Date | null | undefined): string {
	if (!value) return '';
	const d = typeof value === 'string' ? new Date(value) : value;
	return new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Asia/Kolkata'
	}).format(d);
}

export function formatTime(locale: Locale, value: string | Date | null | undefined): string {
	if (!value) return '';
	const d = typeof value === 'string' ? new Date(value) : value;
	return new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
		timeStyle: 'short',
		timeZone: 'Asia/Kolkata'
	}).format(d);
}

/** "2015-06-21" -> "21-06-2015" (no timezone shifts: a DOB is a calendar date). */
export function formatDob(value: string | null | undefined): string {
	if (!value) return '';
	const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	return m ? `${m[3]}-${m[2]}-${m[1]}` : value;
}

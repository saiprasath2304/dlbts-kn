import { serviceSupabase } from './supabase';
import { isLocale } from '#lib/i18n/index.ts';
import type { Locale } from '#lib/types.ts';

export interface AppSettings {
	/** "<app_name> <event_year>", shown in the header, page titles and reports. */
	app_title: string;
	app_name: string;
	event_year: number;
	default_locale: Locale;
	username_pattern: string;
	password_pattern: string;
	autosave_delay_ms: number;
}

const DEFAULTS: AppSettings = {
	app_title: 'DLBTS KN 2026',
	app_name: 'DLBTS KN',
	event_year: 2026,
	default_locale: 'en',
	username_pattern: 'judge{nn}{group}{event}',
	password_pattern: 'pwd{nn}{group}{event}',
	autosave_delay_ms: 800
};

let cache: { value: AppSettings; at: number } | null = null;
const TTL_MS = 30_000;

export function parseSettings(rows: { key: string; value: unknown }[]): AppSettings {
	const s: AppSettings = { ...DEFAULTS };
	for (const { key, value } of rows) {
		if (key === 'app_name' && typeof value === 'string' && value.trim()) s.app_name = value.trim();
		if (key === 'event_year' && typeof value === 'number' && value >= 2000 && value <= 2100)
			s.event_year = value;
		if (key === 'default_locale' && isLocale(value)) s.default_locale = value;
		if (key === 'username_pattern' && typeof value === 'string' && value.includes('{nn}'))
			s.username_pattern = value;
		if (key === 'password_pattern' && typeof value === 'string' && value.trim())
			s.password_pattern = value;
		if (key === 'autosave_delay_ms' && typeof value === 'number' && value >= 200 && value <= 10_000)
			s.autosave_delay_ms = value;
	}
	s.app_title = `${s.app_name} ${s.event_year}`;
	return s;
}

/** Non-sensitive settings, readable before login (title, default language). */
export async function getSettings(): Promise<AppSettings> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
	const { data, error } = await serviceSupabase().from('app_settings').select('key, value');
	if (error) {
		console.error('settings: could not load app_settings', error.message);
		return cache?.value ?? DEFAULTS;
	}
	const value = parseSettings(data ?? []);
	cache = { value, at: Date.now() };
	return value;
}

export function invalidateSettings() {
	cache = null;
}

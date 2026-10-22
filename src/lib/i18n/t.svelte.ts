import { page } from '$app/state';
import { translate, type MessageKey, type Params } from './index';
import type { Locale } from '#lib/types.ts';

/** Current locale from page data (request-scoped on the server). */
export function locale(): Locale {
	return (page.data?.locale as Locale) ?? 'en';
}

/** Translate in components: {t('nav.logout')} */
export function t(key: MessageKey | string, params?: Params): string {
	return translate(locale(), key, params);
}

import { redirect } from '@sveltejs/kit';
import { isLocale } from '#lib/i18n/index.ts';
import { safeNext } from '#lib/server/guards.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const locale = form.get('locale');
		if (isLocale(locale)) {
			cookies.set('lang', locale, {
				path: '/',
				maxAge: 60 * 60 * 24 * 365,
				httpOnly: false,
				sameSite: 'lax'
			});
		}
		redirect(303, safeNext(String(form.get('next') ?? ''), '/'));
	}
};

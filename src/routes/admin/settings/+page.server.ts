import { fail } from '@sveltejs/kit';
import { translate, isLocale } from '#lib/i18n/index.ts';
import { failWith } from '#lib/server/errors.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { int, str } from '#lib/server/form.ts';
import { getSettings, invalidateSettings } from '#lib/server/settings.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ settings: await getSettings() });

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const f = await request.formData();
		const values = {
			app_name: str(f, 'app_name').slice(0, 80),
			event_year: int(f, 'event_year', 0),
			default_locale: str(f, 'default_locale'),
			username_pattern: str(f, 'username_pattern').toLowerCase(),
			password_pattern: str(f, 'password_pattern'),
			autosave_delay_ms: int(f, 'autosave_delay_ms', 800)
		};
		if (
			!values.app_name ||
			values.event_year < 2000 ||
			values.event_year > 2100 ||
			!isLocale(values.default_locale) ||
			!values.username_pattern.includes('{nn}') ||
			!/^[a-z0-9._{}-]+$/.test(values.username_pattern) ||
			!values.password_pattern ||
			values.autosave_delay_ms < 200 ||
			values.autosave_delay_ms > 10000
		) {
			return fail(400, { error: translate(locals.locale, 'error.INVALID_REQUEST') });
		}
		for (const [key, value] of Object.entries(values)) {
			const { error } = await locals.supabase
				.from('app_settings')
				.update({ value, updated_by: admin.id })
				.eq('key', key);
			if (error) return failWith(locals.locale, error);
		}
		invalidateSettings();
		return { success: translate(locals.locale, 'common.saved_ok') };
	},

	reset: async ({ request, locals }) => {
		requireAdmin(locals);
		const f = await request.formData();
		if (str(f, 'confirm') !== 'RESET') {
			return fail(400, { error: translate(locals.locale, 'admin.settings.reset_confirm_label') });
		}
		const { data, error } = await locals.supabase.rpc('admin_reset_event_data', {
			p_confirm: 'RESET'
		});
		if (error) return failWith(locals.locale, error);
		const r = data as { participants: number; marks: number };
		return {
			success: translate(locals.locale, 'admin.settings.reset_done', {
				participants: r.participants,
				marks: r.marks
			})
		};
	}
};

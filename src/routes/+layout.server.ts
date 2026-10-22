import { getSettings } from '#lib/server/settings.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const settings = await getSettings();
	const p = locals.profile;
	return {
		locale: locals.locale,
		appTitle: settings.app_title,
		profile: p
			? { id: p.id, username: p.username, display_name: p.display_name, role: p.role }
			: null
	};
};

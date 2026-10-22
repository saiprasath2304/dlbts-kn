import { requireAdmin } from '#lib/server/guards.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	return {};
};

import { loadGroupsWithEvents } from '#lib/server/admin.ts';
import { saveEvent } from '#lib/server/events.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	groups: await loadGroupsWithEvents(locals.supabase)
});

export const actions: Actions = {
	save: async ({ request, locals }) => saveEvent(locals, await request.formData())
};

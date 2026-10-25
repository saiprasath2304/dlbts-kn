import { fail } from '@sveltejs/kit';
import { translate } from '#lib/i18n/index.ts';
import { failWith } from '#lib/server/errors.ts';
import { bool, int, isUuid, optStr, str } from '#lib/server/form.ts';
import { loadGroupsWithEvents } from '#lib/server/admin.ts';
import { saveEvent } from '#lib/server/events.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const [groups, { data: progress }] = await Promise.all([
		loadGroupsWithEvents(locals.supabase),
		locals.supabase.rpc('admin_event_progress')
	]);
	const stats = Object.fromEntries(
		(progress ?? []).map((p) => [
			p.event_id,
			{
				judges: p.required_judges,
				participants: p.participant_count,
				criteria: p.criteria_count,
				finalized: p.finalized
			}
		])
	);
	return { groups, stats, tab: url.searchParams.get('group') ?? groups[0]?.id ?? '' };
};

const CODE = /^[a-z0-9]{1,12}$/;

export const actions: Actions = {
	saveEvent: async ({ request, locals }) => saveEvent(locals, await request.formData()),

	saveGroup: async ({ request, locals }) => {
		const f = await request.formData();
		const id = str(f, 'id');
		const row = {
			code: str(f, 'code').toLowerCase(),
			name: str(f, 'name'),
			description: optStr(f, 'description'),
			display_order: int(f, 'display_order'),
			is_active: id ? bool(f, 'is_active') : true
		};
		if (!CODE.test(row.code) || !row.name)
			return fail(400, { error: translate(locals.locale, 'admin.groups.code_help') });
		const { error } = isUuid(id)
			? await locals.supabase.from('groups').update(row).eq('id', id)
			: await locals.supabase.from('groups').insert(row);
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	},

	deleteGroup: async ({ request, locals }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.from('groups').delete().eq('id', str(f, 'id'));
		if (error)
			return failWith(locals.locale, error.code === '23503' ? { message: 'INVALID_STATE' } : error);
		return { success: translate(locals.locale, 'common.done') };
	}
};

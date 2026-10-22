import { fail } from '@sveltejs/kit';
import { translate } from '#lib/i18n/index.ts';
import { failWith } from '#lib/server/errors.ts';
import { bool, isUuid, optStr, str } from '#lib/server/form.ts';
import { loadGroupsWithEvents } from '#lib/server/admin.ts';
import { CODE_RE } from '#lib/import/participants.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const db = locals.supabase;
	const group = url.searchParams.get('group') ?? '';
	const event = url.searchParams.get('event') ?? '';
	const q = (url.searchParams.get('q') ?? '').trim();
	const inactive = url.searchParams.get('inactive') === '1';

	let query = db
		.from('participants')
		.select(
			'id, code, name, kind, affiliation, registration_no, notes, is_active, group_id, groups(name), event_participants(is_active, event_id, events(name))'
		)
		.order('code')
		.limit(500);
	if (isUuid(group)) query = query.eq('group_id', group);
	if (!inactive) query = query.eq('is_active', true);
	if (q)
		query = query.or(
			`code.ilike.%${q.replace(/[%,()]/g, '')}%,name.ilike.%${q.replace(/[%,()]/g, '')}%`
		);
	const { data } = await query;
	const participants = (data ?? []).filter(
		(p) => !event || p.event_participants.some((l) => l.event_id === event && l.is_active)
	);

	return {
		participants,
		groups: await loadGroupsWithEvents(db),
		filters: { group, event, q, inactive }
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const f = await request.formData();
		const id = str(f, 'id');
		const row = {
			code: str(f, 'code').toUpperCase(),
			name: str(f, 'name'),
			kind: (str(f, 'kind') === 'team' ? 'team' : 'individual') as 'team' | 'individual',
			group_id: optStr(f, 'group_id'),
			affiliation: optStr(f, 'affiliation'),
			registration_no: optStr(f, 'registration_no'),
			notes: optStr(f, 'notes')
		};
		if (!CODE_RE.test(row.code) || !row.name) {
			return fail(400, { error: translate(locals.locale, 'admin.participants.code_help') });
		}
		if (isUuid(id)) {
			const { error } = await locals.supabase.from('participants').update(row).eq('id', id);
			if (error) return failWith(locals.locale, error);
		} else {
			const { data, error } = await locals.supabase
				.from('participants')
				.insert(row)
				.select('id')
				.single();
			if (error) return failWith(locals.locale, error);
			const eventId = str(f, 'event_id');
			if (isUuid(eventId)) {
				const { error: linkErr } = await locals.supabase.rpc('admin_set_event_participant', {
					p_event_id: eventId,
					p_participant_id: data.id,
					p_active: true,
					p_reason: optStr(f, 'reason') ?? ''
				});
				if (linkErr) return failWith(locals.locale, linkErr);
			}
		}
		return { success: translate(locals.locale, 'common.saved_ok') };
	},
	setActive: async ({ request, locals }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.rpc('admin_set_participant_active', {
			p_participant_id: str(f, 'id'),
			p_active: bool(f, 'active'),
			p_reason: optStr(f, 'reason') ?? ''
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	}
};

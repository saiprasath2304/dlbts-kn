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
	const samithi = (url.searchParams.get('samithi') ?? '').trim();

	let query = db
		.from('participants')
		.select(
			'id, code, name, kind, affiliation, registration_no, notes, members, memento_given, memento_given_at, dob, dob_verified, is_active, group_id, groups(name), event_participants(is_active, event_id, events(name))'
		)
		.order('code')
		.limit(500);
	if (isUuid(group)) query = query.eq('group_id', group);
	if (!inactive) query = query.eq('is_active', true);
	if (samithi) query = query.eq('affiliation', samithi);
	if (q)
		query = query.or(
			`code.ilike.%${q.replace(/[%,()]/g, '')}%,name.ilike.%${q.replace(/[%,()]/g, '')}%`
		);
	const [{ data }, { data: units }] = await Promise.all([
		query,
		db.from('participants').select('affiliation').not('affiliation', 'is', null).limit(5000)
	]);
	const samithis = [
		...new Set((units ?? []).map((u) => u.affiliation!.trim()).filter(Boolean))
	].sort((a, b) => a.localeCompare(b));
	const participants = (data ?? []).filter(
		(p) => !event || p.event_participants.some((l) => l.event_id === event && l.is_active)
	);

	return {
		participants,
		groups: await loadGroupsWithEvents(db),
		samithis,
		filters: { group, event, q, inactive, samithi }
	};
};

export const actions: Actions = {
	addEvent: async ({ request, locals }) => {
		const f = await request.formData();
		const eventId = str(f, 'event_id');
		if (!isUuid(eventId))
			return fail(400, {
				error: translate(locals.locale, 'admin.participants.no_events_available')
			});
		const { error } = await locals.supabase.rpc('admin_set_event_participant', {
			p_event_id: eventId,
			p_participant_id: str(f, 'id'),
			p_active: true,
			p_reason: optStr(f, 'reason') ?? ''
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	},
	removeEvent: async ({ request, locals }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.rpc('admin_set_event_participant', {
			p_event_id: str(f, 'event_id'),
			p_participant_id: str(f, 'id'),
			p_active: false,
			p_reason: optStr(f, 'reason') ?? ''
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	},
	dobVerified: async ({ request, locals }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.rpc('set_dob_verified', {
			p_participant_id: str(f, 'id'),
			p_verified: bool(f, 'verified')
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	},
	memento: async ({ request, locals }) => {
		const f = await request.formData();
		const { error } = await locals.supabase.rpc('set_memento', {
			p_participant_id: str(f, 'id'),
			p_given: bool(f, 'given')
		});
		if (error) return failWith(locals.locale, error);
		return { success: translate(locals.locale, 'common.saved_ok') };
	},
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
			notes: optStr(f, 'notes'),
			members: optStr(f, 'members'),
			dob: /^\d{4}-\d{2}-\d{2}$/.test(str(f, 'dob')) ? str(f, 'dob') : null
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

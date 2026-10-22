import { fail } from '@sveltejs/kit';
import { translate } from '#lib/i18n/index.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { failWith } from '#lib/server/errors.ts';
import { isUuid, optStr, str, bool } from '#lib/server/form.ts';
import { loadGroupsWithEvents, loadJudges } from '#lib/server/admin.ts';
import { getSettings } from '#lib/server/settings.ts';
import {
	createJudgeAccount,
	renameJudge,
	setJudgeActive,
	setJudgePassword
} from '#lib/server/accounts.ts';
import {
	isValidUsername,
	normalizeUsername,
	suggestCredentials,
	validatePassword
} from '#lib/usernames.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = locals.supabase;
	const [judges, groups, settings, { data: assigns }, { data: allNames }] = await Promise.all([
		loadJudges(db),
		loadGroupsWithEvents(db),
		getSettings(),
		db.from('judge_assignments').select('judge_id, is_active, events(name, groups(name))'),
		db.from('profiles').select('username')
	]);
	const taken = (allNames ?? []).map((p) => p.username);
	const suggestions: Record<string, { username: string; password: string }> = {};
	for (const g of groups) {
		for (const e of g.events) {
			try {
				const s = suggestCredentials(
					taken,
					settings.username_pattern,
					settings.password_pattern,
					g.code,
					e.code
				);
				suggestions[e.id] = { username: s.username, password: s.password };
			} catch {
				/* no free number */
			}
		}
	}
	return {
		judges: judges.map((j) => ({
			...j,
			events: (assigns ?? [])
				.filter((a) => a.judge_id === j.id && a.is_active)
				.map((a) => `${a.events?.groups?.name} – ${a.events?.name}`)
		})),
		groups,
		suggestions
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const f = await request.formData();
		const t = (k: string, p?: Record<string, string>) => translate(locals.locale, k, p);
		const username = normalizeUsername(str(f, 'username'));
		const password = String(f.get('password') ?? '');
		const displayName = str(f, 'display_name');
		if (!isValidUsername(username)) return fail(400, { error: t('admin.judges.username_help') });
		if (validatePassword(password)) return fail(400, { error: t('admin.judges.password_help') });
		if (!displayName) return fail(400, { error: t('admin.judges.display_name') });

		const created = await createJudgeAccount({
			username,
			password,
			displayName,
			actorId: admin.id
		});
		if ('error' in created) {
			if (created.error === 'USERNAME_TAKEN')
				return fail(400, { error: t('admin.judges.username_taken') });
			console.error('create judge failed:', created.error, created.message);
			return fail(500, { error: t('error.generic') });
		}
		const eventId = str(f, 'event_id');
		if (isUuid(eventId) && bool(f, 'assign')) {
			const { error } = await locals.supabase.rpc('admin_set_assignment', {
				p_event_id: eventId,
				p_judge_id: created.id,
				p_active: true,
				p_reason: optStr(f, 'reason') ?? ''
			});
			if (error)
				return failWith(locals.locale, error, { success: t('admin.judges.created', { username }) });
		}
		return { success: t('admin.judges.created', { username }) };
	},

	password: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const f = await request.formData();
		const password = String(f.get('password') ?? '');
		if (validatePassword(password))
			return fail(400, { error: translate(locals.locale, 'admin.judges.password_help') });
		const r = await setJudgePassword(str(f, 'id'), password, admin.id);
		if ('error' in r) return fail(400, { error: translate(locals.locale, 'error.generic') });
		return {
			success: translate(locals.locale, 'admin.judges.password_reset_done', {
				username: r.username
			})
		};
	},

	active: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const f = await request.formData();
		const r = await setJudgeActive(str(f, 'id'), bool(f, 'active'), admin.id, optStr(f, 'reason'));
		if ('error' in r) return fail(400, { error: translate(locals.locale, 'error.generic') });
		return { success: translate(locals.locale, 'common.saved_ok') };
	},

	rename: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const f = await request.formData();
		const name = str(f, 'display_name');
		if (!name) return fail(400, { error: translate(locals.locale, 'admin.judges.display_name') });
		const r = await renameJudge(str(f, 'id'), name, admin.id);
		if ('error' in r) return fail(400, { error: translate(locals.locale, 'error.generic') });
		return { success: translate(locals.locale, 'common.saved_ok') };
	}
};

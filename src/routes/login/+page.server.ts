import { fail, redirect } from '@sveltejs/kit';
import { AUTH_EMAIL_DOMAIN } from '$app/env/private';
import { isValidUsername, normalizeUsername, syntheticEmail } from '#lib/usernames.ts';
import { ipLoginLimiter, userLoginLimiter } from '#lib/server/rate-limit.ts';
import { safeNext } from '#lib/server/guards.ts';
import { translate } from '#lib/i18n/index.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.profile) redirect(303, locals.profile.role === 'admin' ? '/admin' : '/judge');
	return { next: url.searchParams.get('next') ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress, url }) => {
		const form = await request.formData();
		const username = normalizeUsername(String(form.get('username') ?? ''));
		const password = String(form.get('password') ?? '');
		const t = (k: string) => translate(locals.locale, k);

		const ip = getClientAddress();
		if (!ipLoginLimiter.attempt(ip) || !userLoginLimiter.attempt(username)) {
			return fail(429, { username, error: t('login.rate_limited') });
		}

		// Same message for unknown user, wrong password or malformed input:
		// the login form must not reveal which usernames exist.
		if (!isValidUsername(username) || password.length === 0 || password.length > 200) {
			return fail(400, { username, error: t('login.invalid') });
		}

		const { data, error } = await locals.supabase.auth.signInWithPassword({
			email: syntheticEmail(username, AUTH_EMAIL_DOMAIN),
			password
		});
		if (error || !data.user) {
			const banned = error?.code === 'user_banned';
			return fail(400, { username, error: t(banned ? 'login.inactive' : 'login.invalid') });
		}

		const { data: profile } = await locals.supabase
			.from('profiles')
			.select('id, role, is_active')
			.eq('id', data.user.id)
			.maybeSingle();
		if (!profile?.is_active) {
			await locals.supabase.auth.signOut({ scope: 'local' });
			return fail(403, { username, error: t('login.inactive') });
		}
		userLoginLimiter.reset(username);

		if (profile.role === 'admin') {
			redirect(303, safeNext(url.searchParams.get('next'), '/admin'));
		}
		// Judges land directly on their own events; with exactly one, go straight to scoring.
		let target = '/judge';
		const { data: assignments } = await locals.supabase
			.from('judge_assignments')
			.select('event_id')
			.eq('judge_id', profile.id)
			.eq('is_active', true);
		if (assignments?.length === 1) target = `/judge/events/${assignments[0].event_id}`;
		redirect(303, safeNext(url.searchParams.get('next'), target));
	}
};

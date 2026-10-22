import { json, redirect } from '@sveltejs/kit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { createSupabaseServerClient } from '#lib/server/supabase.ts';
import { getSettings } from '#lib/server/settings.ts';
import { isLocale } from '#lib/i18n/index.ts';

/** Authenticate every request: valid session AND active profile, or nobody. */
const auth: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event);
	event.locals.profile = null;

	const { data } = await event.locals.supabase.auth.getClaims();
	const userId = data?.claims?.sub;
	if (userId) {
		const { data: profile } = await event.locals.supabase
			.from('profiles')
			.select('id, username, display_name, role, is_active')
			.eq('id', userId)
			.maybeSingle();
		if (profile?.is_active) {
			event.locals.profile = profile;
		} else {
			// Deactivated or profile-less account: end the session immediately.
			await event.locals.supabase.auth.signOut({ scope: 'local' });
		}
	}

	const cookieLocale = event.cookies.get('lang');
	event.locals.locale = isLocale(cookieLocale)
		? cookieLocale
		: (await getSettings()).default_locale;

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version',
		transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.locale)
	});
};

/** Role-based route protection. RLS still protects the data underneath. */
const guard: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const profile = event.locals.profile;
	const isApi = path.startsWith('/api/');
	const area =
		path.startsWith('/admin') || path.startsWith('/api/admin')
			? 'admin'
			: path.startsWith('/judge') || path.startsWith('/api/judge')
				? 'judge'
				: null;

	if (area) {
		if (!profile) {
			if (isApi) return json({ code: 'SESSION' }, { status: 401 });
			redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
		}
		if (profile.role !== area) {
			if (isApi) return json({ code: 'FORBIDDEN' }, { status: 403 });
			redirect(303, profile.role === 'admin' ? '/admin' : '/judge');
		}
	}

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (profile) {
		// Never cache personalised pages (shared devices at events).
		response.headers.set('Cache-Control', 'no-store');
	}
	return response;
};

export const handle = sequence(auth, guard);

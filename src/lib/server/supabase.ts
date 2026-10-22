import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/env';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$app/env/public';
import { SUPABASE_SERVICE_ROLE_KEY, SESSION_MAX_AGE_HOURS } from '$app/env/private';
import type { Database } from '#lib/database.types.ts';

/**
 * Per-request client acting as the signed-in user (RLS applies).
 * Session cookies are httpOnly: browser JavaScript never sees auth tokens.
 */
export function createSupabaseServerClient(event: RequestEvent): SupabaseClient<Database> {
	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) => {
				for (const { name, value, options } of cookies) {
					event.cookies.set(name, value, {
						...options,
						path: '/',
						httpOnly: true,
						secure: !dev,
						sameSite: 'lax',
						maxAge: options.maxAge === 0 ? 0 : SESSION_MAX_AGE_HOURS * 3600
					});
				}
			}
		}
	});
}

let serviceClient: SupabaseClient<Database> | null = null;

/**
 * Service-role client. BYPASSES RLS. Use only after verifying the caller is an
 * admin, and only for operations a user JWT cannot perform (auth admin API,
 * profile management, reading public settings). Never send to the browser.
 */
export function serviceSupabase(): SupabaseClient<Database> {
	serviceClient ??= createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
	return serviceClient;
}

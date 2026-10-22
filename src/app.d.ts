import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/database.types.ts';
import type { Locale, Profile } from '#lib/types.ts';

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}
		interface Locals {
			supabase: SupabaseClient<Database>;
			/** Set only when the session is valid AND the profile is active. */
			profile: Profile | null;
			locale: Locale;
		}
		interface PageData {
			locale: Locale;
			profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'role'> | null;
			appTitle: string;
		}
	}
}

export {};

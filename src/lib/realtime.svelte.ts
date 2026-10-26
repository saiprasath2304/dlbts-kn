import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { invalidateAll } from '$app/navigation';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$app/env/public';

/**
 * Live refresh for admin pages: listens to submission/request changes via
 * Supabase Realtime (RLS-filtered with the admin's token) and re-runs the page
 * load. Falls back to polling if Realtime is unavailable.
 */
export class LiveRefresh {
	live = $state(false);
	private channel: RealtimeChannel | null = null;
	private poll: ReturnType<typeof setInterval> | undefined;
	private debounce: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private token: string | null,
		readonly pollSeconds = 30
	) {}

	start() {
		this.poll = setInterval(() => {
			if (!this.live && document.visibilityState === 'visible') void invalidateAll();
		}, this.pollSeconds * 1000);
		if (!this.token) return;
		try {
			const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
				auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
			});
			client.realtime.setAuth(this.token);
			const refresh = () => {
				clearTimeout(this.debounce);
				this.debounce = setTimeout(() => void invalidateAll(), 600);
			};
			this.channel = client
				.channel('admin-progress')
				.on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, refresh)
				.on(
					'postgres_changes',
					{ event: '*', schema: 'public', table: 'reopening_requests' },
					refresh
				)
				.on(
					'postgres_changes',
					{ event: '*', schema: 'public', table: 'correction_requests' },
					refresh
				)
				.on(
					'postgres_changes',
					{ event: '*', schema: 'public', table: 'participant_requests' },
					refresh
				)
				.subscribe((status) => {
					this.live = status === 'SUBSCRIBED';
				});
		} catch {
			this.live = false;
		}
	}

	stop() {
		clearInterval(this.poll);
		clearTimeout(this.debounce);
		void this.channel?.unsubscribe();
		this.channel = null;
	}
}

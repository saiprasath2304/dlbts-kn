<script lang="ts">
	import { page } from '$app/state';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import AdminSidebar from '#lib/components/app/AdminSidebar.svelte';
	import MenuTrigger from '#lib/components/app/MenuTrigger.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { children, data } = $props();

	const titles: [string, string][] = [
		['/admin/results', 'nav.results'],
		['/admin/reports', 'nav.reports'],
		['/admin/submissions', 'nav.submissions'],
		['/admin/requests', 'nav.requests'],
		['/admin/events', 'nav.events'],
		['/admin/participants', 'nav.participants'],
		['/admin/judges', 'nav.judges'],
		['/admin/audit', 'nav.audit'],
		['/admin/settings', 'nav.settings']
	];
	const section = $derived(
		titles.find(([p]) => page.url.pathname.startsWith(p))?.[1] ?? 'nav.dashboard'
	);
</script>

<Sidebar.Provider>
	<AdminSidebar pendingRequests={data.pendingRequests} />
	<Sidebar.Inset>
		<header
			class="bg-background/80 sticky top-0 z-20 flex h-13 items-center gap-2 border-b px-3 backdrop-blur md:px-4"
		>
			<MenuTrigger />
			<Separator orientation="vertical" class="mx-1 h-5" />
			<span class="text-sm font-medium">{t(section)}</span>
		</header>
		<main
			id="main"
			tabindex="-1"
			class="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 outline-none md:px-8 md:py-8"
		>
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>

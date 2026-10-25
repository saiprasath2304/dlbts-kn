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
	<Sidebar.Inset class="bg-background">
		<header
			class="bg-background/90 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur"
		>
			<MenuTrigger />
			<Separator orientation="vertical" class="h-6" />
			<span class="text-muted-foreground font-medium">{t(section)}</span>
		</header>
		<main id="main" tabindex="-1" class="mx-auto w-full max-w-6xl min-w-0 p-4 outline-none md:p-6">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>

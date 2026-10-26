<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import TopBar from '#lib/components/app/TopBar.svelte';
	import NavProgress from '#lib/components/app/NavProgress.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { children, data } = $props();

	// SSR sets <html lang>; keep it correct after client-side language switches
	// so screen readers use the right voice for Tamil.
	$effect(() => {
		document.documentElement.lang = data.locale;
	});

	const isAdmin = $derived(page.url.pathname.startsWith('/admin'));
	const isLogin = $derived(page.url.pathname === '/login');
</script>

<svelte:head>
	<title>{data.appTitle}</title>
	<link rel="icon" href="/logo.png" />
</svelte:head>

<NavProgress />
<a
	class="bg-background sr-only z-50 rounded-md px-4 py-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
	href="#main">{t('nav.skip')}</a
>

{#if isAdmin || isLogin}
	{@render children()}
{:else}
	<div class="bg-muted/30 min-h-svh">
		<TopBar />
		<main id="main" tabindex="-1" class="mx-auto max-w-3xl px-4 py-6 outline-none">
			{@render children()}
		</main>
	</div>
{/if}

<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import TopBar from '#lib/components/app/TopBar.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { children, data } = $props();

	// SSR sets <html lang>; keep it correct after client-side language switches
	// so screen readers use the right voice for Tamil.
	$effect(() => {
		document.documentElement.lang = data.locale;
	});

	const isAdmin = $derived(page.url.pathname.startsWith('/admin'));
</script>

<svelte:head>
	<title>{data.appTitle}</title>
	<link rel="icon" href="/logo.png" />
</svelte:head>

<a
	class="bg-background sr-only z-50 rounded-md px-4 py-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
	href="#main">{t('nav.skip')}</a
>

{#if isAdmin}
	{@render children()}
{:else}
	<div
		class="min-h-svh bg-[radial-gradient(1200px_420px_at_50%_-220px,var(--color-secondary),transparent_70%)]"
	>
		<TopBar />
		<main id="main" tabindex="-1" class="mx-auto max-w-4xl px-4 py-6 outline-none">
			{@render children()}
		</main>
	</div>
{/if}

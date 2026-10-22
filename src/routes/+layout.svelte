<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import Header from '#lib/components/Header.svelte';
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

<a class="skip-link" href="#main">{t('nav.skip')}</a>
<Header />
<main id="main" class={isAdmin ? 'admin-main' : 'container narrow'} tabindex="-1">
	{@render children()}
</main>

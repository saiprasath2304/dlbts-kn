<script lang="ts">
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
	import Brand from './Brand.svelte';
	import LanguageToggle from './LanguageToggle.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	const profile = $derived(page.data.profile);
</script>

<header class="bg-background/90 relative z-30 border-b backdrop-blur sm:sticky sm:top-0">
	<div class="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 py-2.5">
		<Brand />
		<div class="ml-auto flex flex-wrap items-center gap-2">
			{#if profile?.role === 'judge'}
				<Button href="/judge" variant="ghost" size="sm"><ListChecks />{t('nav.my_events')}</Button>
			{/if}
			<LanguageToggle />
			{#if profile}
				<form method="POST" action="/logout">
					<Button type="submit" variant="ghost" size="sm"><LogOut />{t('nav.logout')}</Button>
				</form>
			{/if}
		</div>
	</div>
</header>

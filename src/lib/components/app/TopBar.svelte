<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { withProgress } from '#lib/progress.svelte.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import UserMenu from './UserMenu.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	const profile = $derived(page.data.profile);
	const locale = $derived(page.data.locale);
</script>

<header class="bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
	<div class="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
		<a href="/" class="flex min-w-0 items-center gap-2.5">
			<img src="/logo.png" alt="" width="32" height="32" class="rounded-full" />
			<span class="truncate font-semibold tracking-tight">{page.data.appTitle}</span>
		</a>
		<div class="ml-auto flex items-center gap-1">
			{#if profile}
				<UserMenu compact />
			{:else}
				<form method="POST" action="/lang" use:enhance={withProgress()}>
					<input type="hidden" name="locale" value={locale === 'ta' ? 'en' : 'ta'} />
					<input type="hidden" name="next" value={page.url.pathname + page.url.search} />
					<Button type="submit" variant="ghost" size="sm" lang={locale === 'ta' ? 'en' : 'ta'}>
						<span class="sr-only">{t('lang.label')}: </span>{t('lang.switch_to')}
					</Button>
				</form>
			{/if}
		</div>
	</div>
</header>

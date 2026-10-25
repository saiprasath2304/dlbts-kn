<script lang="ts">
	import Languages from '@lucide/svelte/icons/languages';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { size = 'sm', class: className = '' }: { size?: 'sm' | 'default'; class?: string } =
		$props();
	const locale = $derived(page.data.locale);
</script>

<form method="POST" action="/lang" use:enhance class={className}>
	<input type="hidden" name="locale" value={locale === 'ta' ? 'en' : 'ta'} />
	<input type="hidden" name="next" value={page.url.pathname + page.url.search} />
	<Button
		type="submit"
		variant="outline"
		{size}
		lang={locale === 'ta' ? 'en' : 'ta'}
		class="w-full justify-start sm:w-auto"
	>
		<Languages />
		<span class="sr-only">{t('lang.label')}: </span>{t('lang.switch_to')}
	</Button>
</form>

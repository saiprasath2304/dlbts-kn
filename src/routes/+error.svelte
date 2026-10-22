<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n/t.svelte.ts';
</script>

<div class="card stack">
	<h1>
		{page.status === 404
			? t('error.NOT_FOUND')
			: page.status === 403
				? t('error.FORBIDDEN')
				: t('error.generic')}
	</h1>
	<p class="muted">{page.status}</p>
	<a class="btn secondary" href="/">{t('common.back')}</a>
</div>

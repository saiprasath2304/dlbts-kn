<script lang="ts">
	import { page } from '$app/state';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { t } from '#lib/i18n/t.svelte.ts';
</script>

<div class="mx-auto max-w-md py-10">
	<Card.Root>
		<Card.Header>
			<p class="text-muted-foreground text-sm">{page.status}</p>
			<Card.Title class="text-xl">
				{page.status === 404
					? t('error.NOT_FOUND')
					: page.status === 403
						? t('error.FORBIDDEN')
						: t('error.generic')}
			</Card.Title>
		</Card.Header>
		<Card.Footer><Button href="/" variant="outline">{t('common.back')}</Button></Card.Footer>
	</Card.Root>
</div>

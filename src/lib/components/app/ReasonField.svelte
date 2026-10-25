<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { show = true, id = 'reason' }: { show?: boolean; id?: string } = $props();
</script>

{#if show}
	<Alert.Root variant="warning">
		<TriangleAlert />
		<Alert.Title>{t('common.confirm_reason_title')}</Alert.Title>
		<Alert.Description>
			<p>{t('common.confirm_reason_body')}</p>
			<div class="mt-2 grid w-full gap-2">
				<Label for={id}>{t('common.reason')}</Label>
				<Textarea {id} name="reason" required minlength={3} class="bg-background" />
			</div>
		</Alert.Description>
	</Alert.Root>
{/if}

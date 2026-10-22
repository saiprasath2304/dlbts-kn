<script lang="ts">
	import { t } from '#lib/i18n/t.svelte.ts';

	let { show = true, id = 'reason' }: { show?: boolean; id?: string } = $props();
</script>

{#if show}
	<div class="alert warning stack field">
		<strong>{t('common.confirm_reason_title')}</strong>
		<p>{t('common.confirm_reason_body')}</p>
		<label for={id}>{t('common.reason')}</label>
		<textarea {id} name="reason" required minlength="3"></textarea>
	</div>
{/if}

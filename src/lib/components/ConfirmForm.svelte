<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n/t.svelte.ts';

	let {
		action,
		label,
		title,
		message = '',
		confirmLabel,
		requireReason = false,
		reasonLabel,
		danger = false,
		buttonClass = 'btn secondary',
		fields
	}: {
		action: string;
		label: string;
		title: string;
		message?: string;
		confirmLabel?: string;
		requireReason?: boolean;
		reasonLabel?: string;
		danger?: boolean;
		buttonClass?: string;
		fields?: Snippet;
	} = $props();

	let dialog: HTMLDialogElement;
	let busy = $state(false);
	const uid = $props.id();
</script>

<form
	method="POST"
	{action}
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			busy = false;
			dialog.close();
			await update();
		};
	}}
>
	{@render fields?.()}
	<button type="button" class={buttonClass} onclick={() => dialog.showModal()}>{label}</button>
	<dialog bind:this={dialog} aria-labelledby="{uid}-title">
		<div class="stack">
			<h2 id="{uid}-title">{title}</h2>
			{#if message}<p>{message}</p>{/if}
			{#if requireReason}
				<div class="field">
					<label for="{uid}-reason">{reasonLabel ?? t('common.reason')}</label>
					<textarea id="{uid}-reason" name="reason" required minlength="3"></textarea>
				</div>
			{/if}
			<div class="row">
				<button type="button" class="btn ghost" onclick={() => dialog.close()}
					>{t('common.cancel')}</button
				>
				<button type="submit" class="btn {danger ? 'danger' : ''}" disabled={busy}>
					{confirmLabel ?? t('common.confirm')}
				</button>
			</div>
		</div>
	</dialog>
</form>

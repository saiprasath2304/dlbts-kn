<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import {
		Button,
		buttonVariants,
		type ButtonVariant,
		type ButtonSize
	} from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { t } from '#lib/i18n/t.svelte.ts';

	let {
		action,
		label,
		title,
		message = '',
		confirmLabel,
		requireReason = false,
		optionalNote = false,
		reasonLabel,
		danger = false,
		variant = 'outline',
		size = 'default',
		fields
	}: {
		action: string;
		label: string;
		title: string;
		message?: string;
		confirmLabel?: string;
		requireReason?: boolean;
		optionalNote?: boolean;
		reasonLabel?: string;
		danger?: boolean;
		variant?: ButtonVariant;
		size?: ButtonSize;
		fields?: Snippet;
	} = $props();

	let open = $state(false);
	let busy = $state(false);
	const uid = $props.id();
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={buttonVariants({ variant, size })}>{label}</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-lg">
		<form
			method="POST"
			{action}
			class="grid gap-4"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					open = false;
					await update();
				};
			}}
		>
			{@render fields?.()}
			<Dialog.Header>
				<Dialog.Title class="text-xl font-semibold">{title}</Dialog.Title>
				{#if message}<Dialog.Description class="text-base">{message}</Dialog.Description>{/if}
			</Dialog.Header>
			{#if requireReason || optionalNote}
				<div class="grid gap-2">
					<Label for="{uid}-reason"
						>{reasonLabel ??
							(requireReason ? t('common.reason') : t('common.note_optional'))}</Label
					>
					<Textarea
						id="{uid}-reason"
						name="reason"
						required={requireReason}
						minlength={requireReason ? 3 : undefined}
					/>
				</div>
			{/if}
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}
					>{t('common.cancel')}</Button
				>
				<Button type="submit" variant={danger ? 'solidDestructive' : 'default'} disabled={busy}>
					{confirmLabel ?? t('common.confirm')}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

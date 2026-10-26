<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import FormFeedback from './FormFeedback.svelte';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import {
		Button,
		buttonVariants,
		type ButtonVariant,
		type ButtonSize
	} from '#lib/components/ui/button/index.js';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import { progress } from '#lib/progress.svelte.ts';
	import { t } from '#lib/i18n/t.svelte.ts';

	let {
		action,
		title,
		description,
		submitLabel,
		variant = 'default',
		size = 'default',
		trigger,
		children,
		wide = false,
		enctype
	}: {
		action: string;
		title: string;
		description?: string;
		submitLabel?: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		trigger: Snippet;
		children: Snippet;
		wide?: boolean;
		enctype?: 'multipart/form-data';
	} = $props();

	let open = $state(false);
	let busy = $state(false);
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={buttonVariants({ variant, size })}>{@render trigger()}</Dialog.Trigger>
	<Dialog.Content
		class={wide
			? 'max-h-[90svh] overflow-y-auto sm:max-w-2xl'
			: 'max-h-[90svh] overflow-y-auto sm:max-w-lg'}
	>
		<form
			method="POST"
			{action}
			{enctype}
			class="grid gap-5"
			use:enhance={() => {
				busy = true;
				progress.forms++;
				return async ({ result, update }) => {
					busy = false;
					progress.forms--;
					if (result.type === 'success' || result.type === 'redirect') open = false;
					await update();
				};
			}}
		>
			<Dialog.Header>
				<Dialog.Title class="text-xl font-semibold">{title}</Dialog.Title>
				{#if description}<Dialog.Description>{description}</Dialog.Description>{/if}
			</Dialog.Header>
			{#if page.form?.error}<FormFeedback form={page.form} />{/if}
			{@render children()}
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}
					>{t('common.cancel')}</Button
				>
				<Button type="submit" disabled={busy}
					>{#if busy}<Loader class="animate-spin" />{/if}{submitLabel ?? t('common.save')}</Button
				>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

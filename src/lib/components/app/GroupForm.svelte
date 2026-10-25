<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { t } from '#lib/i18n/t.svelte.ts';

	type Group = {
		id: string;
		code: string;
		name: string;
		description: string | null;
		display_order: number;
		is_active: boolean;
	};
	let { group }: { group?: Group } = $props();
	const sfx = $derived(group?.id ?? 'new');
	let active = $derived(group?.is_active ?? true);
</script>

{#if group}<input type="hidden" name="id" value={group.id} />{/if}
<div class="grid gap-4 sm:grid-cols-2">
	<div class="grid gap-2">
		<Label for="g-name-{sfx}">{t('common.name')}</Label>
		<Input id="g-name-{sfx}" name="name" required value={group?.name ?? ''} />
	</div>
	<div class="grid gap-2">
		<Label for="g-code-{sfx}">{t('common.code')}</Label>
		<Input
			id="g-code-{sfx}"
			name="code"
			required
			pattern={'[a-z0-9]{1,12}'}
			value={group?.code ?? ''}
			aria-describedby="g-help-{sfx}"
		/>
		<p class="text-muted-foreground text-xs" id="g-help-{sfx}">{t('admin.groups.code_help')}</p>
	</div>
	<div class="grid gap-2">
		<Label for="g-order-{sfx}">{t('common.order')}</Label>
		<Input
			id="g-order-{sfx}"
			name="display_order"
			type="number"
			value={group?.display_order ?? 0}
		/>
	</div>
	<div class="grid gap-2">
		<Label for="g-desc-{sfx}">{t('common.description')}</Label>
		<Input id="g-desc-{sfx}" name="description" value={group?.description ?? ''} />
	</div>
	{#if group}
		<div class="flex items-center gap-3">
			<Switch id="g-active-{sfx}" name="is_active" bind:checked={active} />
			<Label for="g-active-{sfx}">{t('common.active')}</Label>
		</div>
	{/if}
</div>

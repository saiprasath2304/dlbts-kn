<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import ReasonField from './ReasonField.svelte';
	import { formatMark } from '#lib/scoring.ts';
	import { t } from '#lib/i18n/t.svelte.ts';

	type C = {
		id: string;
		name: string;
		description: string | null;
		max_marks: number;
		display_order: number;
		is_active: boolean;
	};
	let {
		criterion,
		nextOrder = 0,
		scoringStarted = false
	}: { criterion?: C; nextOrder?: number; scoringStarted?: boolean } = $props();
	const sfx = $derived(criterion?.id ?? 'new');
	let active = $derived(criterion?.is_active ?? true);
</script>

{#if criterion}<input type="hidden" name="id" value={criterion.id} />{/if}
<div class="grid gap-4 sm:grid-cols-2">
	<div class="grid gap-2 sm:col-span-2">
		<Label for="c-name-{sfx}">{t('common.name')}</Label>
		<Input id="c-name-{sfx}" name="name" required value={criterion?.name ?? ''} />
	</div>
	<div class="grid gap-2">
		<Label for="c-max-{sfx}">{t('admin.criteria.max')}</Label>
		<Input
			id="c-max-{sfx}"
			name="max_marks"
			inputmode="decimal"
			required
			value={criterion ? formatMark(criterion.max_marks) : '10'}
		/>
	</div>
	<div class="grid gap-2">
		<Label for="c-order-{sfx}">{t('common.order')}</Label>
		<Input
			id="c-order-{sfx}"
			name="display_order"
			type="number"
			value={criterion?.display_order ?? nextOrder}
		/>
	</div>
	<div class="grid gap-2 sm:col-span-2">
		<Label for="c-desc-{sfx}">{t('common.description')}</Label>
		<Input id="c-desc-{sfx}" name="description" value={criterion?.description ?? ''} />
	</div>
	{#if criterion}
		<div class="flex items-center gap-3">
			<Switch id="c-active-{sfx}" name="is_active" bind:checked={active} />
			<Label for="c-active-{sfx}">{t('common.active')}</Label>
		</div>
	{/if}
</div>
<ReasonField show={scoringStarted} id="c-reason-{sfx}" />

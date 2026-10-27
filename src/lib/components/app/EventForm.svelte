<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import AppSelect from './AppSelect.svelte';
	import { groupOptions } from '#lib/options.ts';
	import { t } from '#lib/i18n/t.svelte.ts';

	type Ev = {
		id: string;
		group_id: string;
		code: string;
		name: string;
		description: string | null;
		instructions: string | null;
		venue?: string | null;
		participation?: string;
		score_precision: number;
		display_order: number;
		is_active: boolean;
	};
	let {
		event,
		groups,
		groupId
	}: { event?: Ev; groups: { id: string; name: string }[]; groupId?: string } = $props();
	const sfx = $derived(event?.id ?? 'new');
	let active = $derived(event?.is_active ?? true);
</script>

{#if event}<input type="hidden" name="id" value={event.id} />{/if}
<div class="grid gap-4 sm:grid-cols-2">
	<div class="grid gap-2 sm:col-span-2">
		<Label for="e-name-{sfx}">{t('common.name')}</Label>
		<Input id="e-name-{sfx}" name="name" required value={event?.name ?? ''} />
	</div>
	<div class="grid gap-2">
		<Label for="e-group-{sfx}">{t('common.group')}</Label>
		<AppSelect
			id="e-group-{sfx}"
			name="group_id"
			value={event?.group_id ?? groupId ?? groups[0]?.id}
			options={groupOptions(groups)}
		/>
	</div>
	<div class="grid gap-2">
		<Label for="e-code-{sfx}">{t('common.code')}</Label>
		<Input
			id="e-code-{sfx}"
			name="code"
			required
			value={event?.code ?? ''}
			aria-describedby="e-help-{sfx}"
		/>
		<p class="text-muted-foreground text-xs" id="e-help-{sfx}">{t('admin.events.code_help')}</p>
	</div>
	<div class="grid gap-2">
		<Label for="e-prec-{sfx}">{t('admin.events.precision')}</Label>
		<AppSelect
			id="e-prec-{sfx}"
			name="score_precision"
			value={String(event?.score_precision ?? 1)}
			options={[0, 1, 2].map((n) => ({
				value: String(n),
				label: t(`admin.events.precision_${n}`)
			}))}
		/>
	</div>
	<div class="grid gap-2">
		<Label for="e-order-{sfx}">{t('common.order')}</Label>
		<Input
			id="e-order-{sfx}"
			name="display_order"
			type="number"
			value={event?.display_order ?? 0}
		/>
	</div>
	<div class="grid gap-2">
		<Label for="e-part-{sfx}">{t('admin.events.participation')}</Label>
		<AppSelect
			id="e-part-{sfx}"
			name="participation"
			value={event?.participation ?? 'individual'}
			options={[
				{ value: 'individual', label: t('admin.participants.kind_individual_event') },
				{ value: 'team', label: t('admin.participants.kind_team_event') }
			]}
		/>
	</div>
	<div class="grid gap-2 sm:col-span-2">
		<Label for="e-venue-{sfx}">{t('admin.events.venue')}</Label>
		<Input
			id="e-venue-{sfx}"
			name="venue"
			maxlength={120}
			value={event?.venue ?? ''}
			aria-describedby="e-venue-help-{sfx}"
		/>
		<p class="text-muted-foreground text-xs" id="e-venue-help-{sfx}">
			{t('admin.events.venue_help')}
		</p>
	</div>
	<div class="grid gap-2 sm:col-span-2">
		<Label for="e-desc-{sfx}">{t('common.description')}</Label>
		<Input id="e-desc-{sfx}" name="description" value={event?.description ?? ''} />
	</div>
	<div class="grid gap-2 sm:col-span-2">
		<Label for="e-ins-{sfx}">{t('admin.events.instructions')}</Label>
		<Textarea id="e-ins-{sfx}" name="instructions" value={event?.instructions ?? ''} />
	</div>
	{#if event}
		<div class="flex items-center gap-3">
			<Switch id="e-active-{sfx}" name="is_active" bind:checked={active} />
			<Label for="e-active-{sfx}">{t('common.active')}</Label>
		</div>
	{/if}
</div>

<script lang="ts">
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import * as RadioGroup from '#lib/components/ui/radio-group/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import FormDialog from './FormDialog.svelte';
	import AppSelect from './AppSelect.svelte';
	import { eventChoices, type ChoiceGroup, type EventKind } from '#lib/event-choices.ts';
	import { t } from '#lib/i18n/t.svelte.ts';

	let {
		participant,
		groups
	}: {
		participant: {
			id: string;
			name: string;
			group_id: string | null;
			eventIds: string[];
		};
		groups: ChoiceGroup[];
	} = $props();

	let kind = $state<EventKind>('individual');
	const choices = $derived(eventChoices(groups, kind, participant.group_id, participant.eventIds));
	let eventId = $state('');
	$effect(() => {
		if (!choices.some((c) => c.value === eventId)) eventId = choices[0]?.value ?? '';
	});
	const uid = $props.id();
</script>

<FormDialog
	action="?/addEvent"
	title="{t('admin.participants.add_event')}: {participant.name}"
	submitLabel={t('common.add')}
	variant="ghost"
	size="sm"
>
	{#snippet trigger()}<CalendarPlus /><span class="sr-only sm:not-sr-only"
			>{t('admin.participants.add_event')}</span
		>{/snippet}
	<input type="hidden" name="id" value={participant.id} />
	<div class="grid gap-5">
		<div class="grid gap-2">
			<Label>{t('admin.participants.event_kind')}</Label>
			<RadioGroup.Root bind:value={kind} class="grid grid-cols-2 gap-2">
				{#each [['individual', 'admin.participants.kind_individual_event'], ['team', 'admin.participants.kind_team_event']] as [value, key] (value)}
					<Label
						for="{uid}-{value}"
						class="has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-lg border p-3 font-normal"
					>
						<RadioGroup.Item {value} id="{uid}-{value}" />{t(key)}
					</Label>
				{/each}
			</RadioGroup.Root>
		</div>
		<div class="grid gap-2">
			<Label for="{uid}-event">{t('common.event')}</Label>
			{#if choices.length}
				<AppSelect id="{uid}-event" name="event_id" bind:value={eventId} options={choices} />
			{:else}
				<p class="text-muted-foreground text-sm">{t('admin.participants.no_events_available')}</p>
			{/if}
		</div>
		<div class="grid gap-2">
			<Label for="{uid}-reason">{t('common.reason')} ({t('common.optional')})</Label>
			<Textarea id="{uid}-reason" name="reason" rows={2} />
		</div>
	</div>
</FormDialog>

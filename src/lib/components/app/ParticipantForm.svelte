<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import NativeSelect from './NativeSelect.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	type P = {
		id: string;
		code: string;
		name: string;
		kind: string;
		group_id: string | null;
		affiliation: string | null;
		registration_no: string | null;
		notes: string | null;
	};
	let {
		participant,
		groups,
		events = []
	}: {
		participant?: P;
		groups: { id: string; name: string }[];
		events?: { id: string; name: string; group: string }[];
	} = $props();
	const sfx = $derived(participant?.id ?? 'new');
</script>

{#if participant}<input type="hidden" name="id" value={participant.id} />{/if}
<div class="grid gap-4 sm:grid-cols-2">
	<div class="grid gap-2 sm:col-span-2">
		<Label for="p-name-{sfx}">{t('common.name')}</Label>
		<Input id="p-name-{sfx}" name="name" required value={participant?.name ?? ''} />
	</div>
	<div class="grid gap-2">
		<Label for="p-code-{sfx}">{t('common.code')}</Label>
		<Input
			id="p-code-{sfx}"
			name="code"
			required
			value={participant?.code ?? ''}
			aria-describedby="p-help-{sfx}"
		/>
		<p class="text-muted-foreground text-xs" id="p-help-{sfx}">
			{t('admin.participants.code_help')}
		</p>
	</div>
	<div class="grid gap-2">
		<Label for="p-kind-{sfx}">{t('admin.participants.kind')}</Label>
		<NativeSelect id="p-kind-{sfx}" name="kind" value={participant?.kind ?? 'individual'}>
			<option value="individual">{t('admin.participants.kind_individual')}</option>
			<option value="team">{t('admin.participants.kind_team')}</option>
		</NativeSelect>
	</div>
	<div class="grid gap-2">
		<Label for="p-group-{sfx}">{t('common.group')}</Label>
		<NativeSelect
			id="p-group-{sfx}"
			name="group_id"
			value={participant?.group_id ?? groups[0]?.id}
			required
		>
			{#each groups as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
		</NativeSelect>
	</div>
	<div class="grid gap-2">
		<Label for="p-aff-{sfx}">{t('admin.participants.affiliation')}</Label>
		<Input id="p-aff-{sfx}" name="affiliation" value={participant?.affiliation ?? ''} />
	</div>
	<div class="grid gap-2">
		<Label for="p-reg-{sfx}">{t('admin.participants.registration_no')}</Label>
		<Input id="p-reg-{sfx}" name="registration_no" value={participant?.registration_no ?? ''} />
	</div>
	<div class="grid gap-2">
		<Label for="p-notes-{sfx}">{t('admin.participants.notes')}</Label>
		<Input id="p-notes-{sfx}" name="notes" value={participant?.notes ?? ''} />
	</div>
	{#if !participant && events.length}
		<div class="grid gap-2 sm:col-span-2">
			<Label for="p-event-new"
				>{t('admin.participants.add_to_event')} ({t('common.optional')})</Label
			>
			<NativeSelect id="p-event-new" name="event_id">
				<option value="">{t('common.none')}</option>
				{#each events as e (e.id)}<option value={e.id}>{e.group} – {e.name}</option>{/each}
			</NativeSelect>
		</div>
	{/if}
</div>

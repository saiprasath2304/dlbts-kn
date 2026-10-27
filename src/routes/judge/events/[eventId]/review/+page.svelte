<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Send from '@lucide/svelte/icons/send';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';
	import { formatMark, participantTotal } from '#lib/scoring.ts';
	import { clearDrafts, pendingDraftCount } from '#lib/offline/score-sync.svelte.ts';

	let { data, form } = $props();

	let pending = $state<number | null>(null);
	let confirmed = $state(false);
	let busy = $state(false);

	const rows = $derived(
		data.participants.map((p) => {
			const marks: Record<string, number | null> = {};
			for (const s of data.scores) if (s.participant_id === p.id) marks[s.criterion_id] = s.value;
			return { p, total: participantTotal(data.criteria, marks) };
		})
	);
	const incomplete = $derived(rows.filter((r) => !r.total.complete).length);

	onMount(async () => {
		pending = await pendingDraftCount(data.profile!.id, data.submission.id);
	});

	const canSubmit = $derived(confirmed && pending === 0 && incomplete === 0 && !busy);
</script>

<svelte:head><title>{t('submit.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-5">
	<div>
		<Button href="/judge/events/{data.event.id}" variant="ghost" size="sm" class="-ml-2"
			><ArrowLeft />{t('submit.go_back_edit')}</Button
		>
		<h1 class="mt-2 text-2xl font-bold tracking-tight">{t('submit.title')}</h1>
	</div>
	<FormFeedback {form} />

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-lg"
				>{t('submit.summary', { event: data.event.name, group: data.group.name })}</Card.Title
			>
			<Card.Description class="text-base">
				{t('submit.participant_count', { n: data.participants.length })} · {t(
					'submit.criteria_count',
					{ n: data.criteria.length }
				)}
			</Card.Description>
		</Card.Header>
	</Card.Root>

	{#if pending !== null && pending > 0}
		<Alert.Root variant="warning" role="alert">
			<TriangleAlert />
			<Alert.Title>{t('submit.unsynced')}</Alert.Title>
			<Alert.Description
				><a class="underline" href="/judge/events/{data.event.id}">{t('submit.go_back_edit')}</a
				></Alert.Description
			>
		</Alert.Root>
	{/if}
	{#if incomplete > 0}
		<Alert.Root variant="destructive" role="alert"
			><TriangleAlert /><Alert.Title>{t('submit.incomplete')}</Alert.Title></Alert.Root
		>
	{/if}

	<Card.Root class="py-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{t('common.participant')}</Table.Head>
					<Table.Head class="text-right">{t('score.total')}</Table.Head>
					<Table.Head>{t('common.status')}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each rows as { p, total } (p.id)}
					<Table.Row>
						<Table.Cell class="whitespace-normal"
							><span class="font-mono font-semibold">{p.label}</span><br /><span
								class="text-muted-foreground text-sm">{p.code}</span
							></Table.Cell
						>
						<Table.Cell class="text-right text-lg font-bold tabular-nums"
							>{formatMark(total.total)} / {formatMark(total.max)}</Table.Cell
						>
						<Table.Cell>
							{#if total.complete}
								<Badge variant="success"><CircleCheck />{t('score.complete')}</Badge>
							{:else}
								<Badge variant="destructive"
									>{t('score.incomplete', { n: total.required - total.filled })}</Badge
								>
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>

	<Card.Root class="border-primary/30">
		<form
			method="POST"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					if (result.type === 'redirect') await clearDrafts(data.profile!.id, data.submission.id);
					busy = false;
					await update();
				};
			}}
		>
			<Card.Content class="grid gap-4">
				<Alert.Root variant="warning"
					><TriangleAlert /><Alert.Description class="text-base"
						>{t('submit.warning')}</Alert.Description
					></Alert.Root
				>
				<input type="hidden" name="expected_version" value={data.submission.version} />
				<div class="flex items-start gap-3">
					<Checkbox
						id="confirm"
						name="confirm"
						value="yes"
						bind:checked={confirmed}
						class="mt-0.5 size-6"
					/>
					<Label for="confirm" class="text-base leading-snug font-medium"
						>{t('submit.confirm_check')}</Label
					>
				</div>
				<Button
					type="submit"
					size="xl"
					class="w-full"
					disabled={!canSubmit}
					data-testid="final-submit"
				>
					<Send />{busy ? t('submit.submitting') : t('submit.button')}
				</Button>
			</Card.Content>
		</form>
	</Card.Root>
</div>

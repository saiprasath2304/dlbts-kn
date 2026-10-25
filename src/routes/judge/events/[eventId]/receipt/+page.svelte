<script lang="ts">
	import CircleCheckBig from '@lucide/svelte/icons/circle-check-big';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import StatusBadge from '#lib/components/app/StatusBadge.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { formatMark } from '#lib/scoring.ts';

	let { data } = $props();
	const totals = $derived((data.latest?.totals ?? {}) as Record<string, number>);
	const max = $derived(data.criteria.reduce((s, c) => s + c.max_marks, 0));
</script>

<svelte:head><title>{t('submit.receipt')}</title></svelte:head>

<div class="grid grid-cols-1 gap-5">
	{#if data.justSubmitted}
		<div
			class="border-success/30 bg-success/8 text-success flex items-center gap-3 rounded-xl border p-5"
			role="status"
			data-testid="submit-success"
		>
			<CircleCheckBig class="size-8 shrink-0" />
			<h1 class="text-2xl font-bold">{t('submit.success_title')}</h1>
		</div>
	{/if}
	<Card.Root>
		<Card.Header>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<Card.Title class="text-xl">{t('submit.receipt')}</Card.Title>
				<StatusBadge status={data.submission.status} />
			</div>
			<Card.Description class="text-base">{data.event.name} – {data.group.name}</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-1">
			{#if data.latest}
				<p>
					{t('submit.success_body', {
						event: data.event.name,
						time: formatDateTime(locale(), data.latest.submitted_at)
					})}
				</p>
				<p class="text-muted-foreground">
					{t('submit.round', { n: data.latest.round })} · {t('submit.participant_count', {
						n: data.participants.length
					})}
				</p>
			{/if}
		</Card.Content>
	</Card.Root>

	{#if data.latest}
		<Card.Root class="py-0">
			<Table.Root>
				<Table.Header>
					<Table.Row
						><Table.Head>{t('common.participant')}</Table.Head><Table.Head class="text-right"
							>{t('score.total')}</Table.Head
						></Table.Row
					>
				</Table.Header>
				<Table.Body>
					{#each data.participants as p (p.id)}
						<Table.Row>
							<Table.Cell class="whitespace-normal"
								>{p.name} <span class="text-muted-foreground text-sm">({p.code})</span></Table.Cell
							>
							<Table.Cell class="text-right font-semibold tabular-nums"
								>{formatMark(Number(totals[p.id] ?? 0))} / {formatMark(max)}</Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Root>
	{/if}

	<div class="flex flex-wrap gap-2">
		<Button href="/judge/events/{data.event.id}" variant="outline"
			>{t('judge.view_submission')}</Button
		>
		<Button href="/judge" variant="ghost">{t('nav.my_events')}</Button>
	</div>
</div>

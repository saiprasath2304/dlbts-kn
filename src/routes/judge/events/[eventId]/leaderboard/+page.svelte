<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Scale from '@lucide/svelte/icons/scale';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { t } from '#lib/i18n/t.svelte.ts';
	import { formatMark } from '#lib/scoring.ts';
	import { isSubmitted } from '#lib/status.ts';
	import { cn } from '#lib/utils.js';

	let { data } = $props();
	const lb = $derived(data.leaderboard);
	const tied = $derived(lb.rows.filter((r) => r.tied));
	const required = $derived(lb.criteria * lb.judges.length);

	let refreshing = $state(false);
	async function refresh() {
		refreshing = true;
		await invalidate('judge:leaderboard');
		refreshing = false;
	}
	onMount(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') void refresh();
		}, 30_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><title>{t('leaderboard.title')} – {data.event.name}</title></svelte:head>

<div class="grid grid-cols-1 gap-4">
	<div>
		<Button href="/judge/events/{data.event.id}" variant="ghost" size="sm" class="-ml-2"
			><ArrowLeft />{t('leaderboard.back')}</Button
		>
		<div class="mt-1 flex items-start justify-between gap-3">
			<div class="min-w-0">
				<p class="text-muted-foreground text-sm font-medium">{data.group.name}</p>
				<h1 class="text-2xl font-bold tracking-tight">{t('leaderboard.title')}</h1>
				<p class="text-muted-foreground text-sm">{data.event.name}</p>
			</div>
			<Button variant="outline" size="sm" onclick={refresh} disabled={refreshing}>
				<RefreshCw class={refreshing ? 'animate-spin' : ''} />{t('leaderboard.refresh')}
			</Button>
		</div>
	</div>

	<div class="flex flex-wrap gap-2 text-xs">
		{#each lb.judges as j (j.n)}
			<Badge variant={isSubmitted(j.status) ? 'success' : 'neutral'}>
				{t('report.judge_n', { n: j.n })}{j.is_me ? ` (${t('leaderboard.you')})` : ''} ·
				{isSubmitted(j.status) ? t('leaderboard.submitted') : t('leaderboard.in_progress')}
			</Badge>
		{/each}
	</div>

	{#if tied.length}
		<Alert.Root variant="warning" role="status">
			<Scale />
			<Alert.Title>{t('leaderboard.ties_title')}</Alert.Title>
			<Alert.Description>{t('leaderboard.ties_body')}</Alert.Description>
		</Alert.Root>
	{/if}

	<Card.Root class="gap-0 py-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-12 text-center">#</Table.Head>
					<Table.Head>{t('score.reg_no')}</Table.Head>
					{#each lb.judges as j (j.n)}
						<Table.Head class="text-right">{t('leaderboard.judge_short', { n: j.n })}</Table.Head>
					{/each}
					<Table.Head class="text-right">{t('score.total')}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each lb.rows as r (r.participant_id)}
					<Table.Row class={cn(r.tied && 'bg-warning/15 hover:bg-warning/20')}>
						<Table.Cell class="text-center font-bold tabular-nums">{r.rank ?? '–'}</Table.Cell>
						<Table.Cell class="whitespace-normal">
							<span class="font-mono font-semibold">{r.label}</span>
							{#if r.tied}<Badge variant="warning" class="ml-1">{t('leaderboard.tie')}</Badge>{/if}
							{#if r.filled < required}
								<div class="text-muted-foreground text-xs">
									{t('leaderboard.marks_pending', { n: required - r.filled })}
								</div>
							{/if}
						</Table.Cell>
						{#each r.judges as j (j.n)}
							<Table.Cell class="text-right tabular-nums">{formatMark(j.total) || '–'}</Table.Cell>
						{/each}
						<Table.Cell class="text-right text-base font-bold tabular-nums">
							{formatMark(r.total) || '–'}
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row
						><Table.Cell colspan={lb.judges.length + 3} class="text-muted-foreground p-6"
							>{t('leaderboard.empty')}</Table.Cell
						></Table.Row
					>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>
	<p class="text-muted-foreground text-xs">
		{t('leaderboard.footnote', { max: formatMark(lb.max) })}
	</p>
</div>

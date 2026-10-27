<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Lock from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import ConfirmForm from '#lib/components/app/ConfirmForm.svelte';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import StatCard from '#lib/components/app/StatCard.svelte';
	import AppSelect from '#lib/components/app/AppSelect.svelte';
	import { all } from '#lib/options.ts';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatTime } from '#lib/i18n/index.ts';
	import { LiveRefresh } from '#lib/realtime.svelte.ts';
	import { cn } from '#lib/utils.js';

	let { data, form } = $props();

	const live = new LiveRefresh(untrack(() => data.token));
	onMount(() => {
		live.start();
		return () => live.stop();
	});

	const s = $derived(data.stats);

	function setFilter(key: string, value: string) {
		const u = new URL(page.url.href);
		if (value) u.searchParams.set(key, value);
		else u.searchParams.delete(key);
		if (key === 'group') u.searchParams.delete('event');
		void goto(u.pathname + u.search, { reset: false, replace: true });
	}
</script>

<svelte:head><title>{t('admin.dashboard.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-8">
	<PageHeader title={t('admin.dashboard.title')}>
		{#snippet actions()}
			<span class="text-muted-foreground inline-flex items-center gap-2 text-sm" role="status">
				<span
					class={cn(
						'size-2 rounded-full',
						live.live ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'
					)}
				></span>
				{live.live
					? t('admin.dashboard.live')
					: t('admin.dashboard.polling', { s: live.pollSeconds })} · {formatTime(
					locale(),
					data.loadedAt
				)}
			</span>
		{/snippet}
	</PageHeader>

	<FormFeedback {form} />

	<section
		class={cn(
			'flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4',
			data.scoringOpen ? 'border-success/40 bg-success/5' : 'border-warning/60 bg-warning/10'
		)}
		data-testid="scoring-lock"
	>
		<div class="flex items-center gap-3">
			<span
				class={cn(
					'grid size-10 place-items-center rounded-full',
					data.scoringOpen
						? 'bg-success text-success-foreground'
						: 'bg-warning text-warning-foreground'
				)}
			>
				{#if data.scoringOpen}<LockOpen class="size-5" />{:else}<Lock class="size-5" />{/if}
			</span>
			<div>
				<p class="font-semibold">{t('lock.admin_title')}</p>
				<p class="text-muted-foreground text-sm">
					{data.scoringOpen ? t('lock.admin_state_open') : t('lock.admin_state_locked')}
				</p>
			</div>
		</div>
		<ConfirmForm
			action="?/scoring"
			label={data.scoringOpen ? t('lock.admin_close') : t('lock.admin_open')}
			title={data.scoringOpen ? t('lock.admin_close') : t('lock.admin_open')}
			message={data.scoringOpen ? t('lock.admin_state_locked') : t('lock.admin_state_open')}
			variant={data.scoringOpen ? 'outline' : 'default'}
			danger={data.scoringOpen}
		>
			{#snippet fields()}<input
					type="hidden"
					name="open"
					value={data.scoringOpen ? 'false' : 'true'}
				/>{/snippet}
		</ConfirmForm>
	</section>

	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="stats">
		<StatCard label={t('admin.dashboard.overview_events')} value={s.complete} of={s.events} />
		<StatCard
			label={t('admin.dashboard.overview_submissions')}
			value={s.submitted}
			of={s.assigned}
		/>
		<StatCard label={t('admin.dashboard.overview_not_started')} value={s.not_started} />
		<StatCard
			label={t('admin.dashboard.overview_requests')}
			value={s.reopen + s.corrections}
			href="/admin/requests"
			highlight={s.reopen + s.corrections > 0}
		/>
	</div>

	<section class="bg-card rounded-xl border">
		<div class="flex flex-wrap items-center justify-between gap-3 border-b p-4">
			<h2 class="font-semibold">{t('admin.dashboard.events')}</h2>
			<div class="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[26rem]">
				<AppSelect
					id="f-group"
					value={data.filters.group}
					options={[
						all(t('common.group') + ': ' + t('common.all')),
						...data.groupsOptions.map(([id, name]) => ({ value: id, label: name }))
					]}
					onValueChange={(v) => setFilter('group', v)}
				/>
				<AppSelect
					id="f-judge"
					value={data.filters.judge}
					options={[
						all(t('common.judge') + ': ' + t('common.all')),
						...data.judges.map((j) => ({ value: j.id, label: j.display_name }))
					]}
					onValueChange={(v) => setFilter('judge', v)}
				/>
			</div>
		</div>
		<Table.Root>
			<Table.Header>
				<Table.Row class="hover:bg-transparent">
					<Table.Head class="pl-4">{t('common.event')}</Table.Head>
					<Table.Head class="hidden w-48 sm:table-cell">{t('report.judges_submitted')}</Table.Head>
					<Table.Head>{t('common.status')}</Table.Head>
					<Table.Head class="w-10"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.rows as r (r.event_id)}
					<Table.Row data-testid="event-progress">
						<Table.Cell class="py-3 pl-4 whitespace-normal">
							<a href="/admin/events/{r.event_id}" class="font-medium hover:underline"
								>{r.event_name}</a
							>
							<div class="text-muted-foreground text-xs">
								{r.group_name}{#if r.venue}
									· {r.venue}{/if}
							</div>
						</Table.Cell>
						<Table.Cell class="hidden sm:table-cell">
							<div class="flex items-center gap-3">
								<span class="w-10 text-sm tabular-nums">{r.submitted}/{r.required_judges}</span>
								<Progress
									value={r.submitted}
									max={Math.max(1, r.required_judges)}
									class="h-1.5 flex-1"
								/>
							</div>
						</Table.Cell>
						<Table.Cell class="whitespace-normal">
							<div class="flex flex-wrap items-center gap-1.5">
								{#if r.finalized}
									<Badge variant="success">{t('result_status.finalized')}</Badge>
								{:else if r.required_judges === 0}
									<Badge variant="destructive">{t('admin.dashboard.no_judges')}</Badge>
								{:else if r.complete}
									<Badge variant="info">{t('admin.dashboard.complete')}</Badge>
								{:else}
									<span class="text-muted-foreground text-sm"
										>{t('admin.dashboard.waiting_for', {
											n: r.required_judges - r.submitted
										})}</span
									>
								{/if}
								{#if r.reopening_pending + r.corrections_open > 0}
									<Badge variant="warning" href="/admin/requests"
										>{t('nav.requests')} · {r.reopening_pending + r.corrections_open}</Badge
									>
								{/if}
								{#if r.incomplete_submissions > 0}
									<Badge variant="destructive"
										>{t('admin.dashboard.needs_fix', { n: r.incomplete_submissions })}</Badge
									>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell class="pr-3 text-right">
							<a
								href={r.complete
									? `/admin/results/${r.event_id}`
									: `/admin/submissions?event=${r.event_id}`}
								class="text-muted-foreground hover:text-foreground hover:bg-accent inline-grid size-8 place-items-center rounded-md"
								aria-label={r.event_name}><ChevronRight class="size-4" /></a
							>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row
						><Table.Cell colspan={4} class="text-muted-foreground p-6 text-center"
							>{t('common.none')}</Table.Cell
						></Table.Row
					>
				{/each}
			</Table.Body>
		</Table.Root>
	</section>
</div>

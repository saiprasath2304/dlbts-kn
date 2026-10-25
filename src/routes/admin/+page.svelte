<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import CalendarCheck from '@lucide/svelte/icons/calendar-check';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Radio from '@lucide/svelte/icons/radio';
	import Filter from '@lucide/svelte/icons/filter';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Collapsible from '#lib/components/ui/collapsible/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import StatCard from '#lib/components/app/StatCard.svelte';
	import NativeSelect from '#lib/components/app/NativeSelect.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatTime } from '#lib/i18n/index.ts';
	import { LiveRefresh } from '#lib/realtime.svelte.ts';

	let { data } = $props();

	const live = new LiveRefresh(untrack(() => data.token));
	onMount(() => {
		live.start();
		return () => live.stop();
	});

	const s = $derived(data.stats);
	const groups = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt on every change, never mutated after
		const map = new Map<string, { name: string; rows: typeof data.rows }>();
		for (const r of data.rows) {
			const g = map.get(r.group_id) ?? { name: r.group_name, rows: [] };
			g.rows.push(r);
			map.set(r.group_id, g);
		}
		return [...map.entries()];
	});
	const filtered = $derived(!!(data.filters.group || data.filters.event || data.filters.judge));
</script>

<svelte:head><title>{t('admin.dashboard.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.dashboard.title')}>
		{#snippet actions()}
			<Badge variant={live.live ? 'success' : 'neutral'} class="gap-1.5 text-sm" role="status">
				<Radio class={live.live ? 'animate-pulse' : ''} />
				{live.live
					? t('admin.dashboard.live')
					: t('admin.dashboard.polling', { s: live.pollSeconds })}
				· {formatTime(locale(), data.loadedAt)}
			</Badge>
		{/snippet}
	</PageHeader>

	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="stats">
		<StatCard
			label={t('admin.dashboard.overview_events')}
			value={s.complete}
			of={s.events}
			icon={CalendarCheck}
		/>
		<StatCard
			label={t('admin.dashboard.overview_submissions')}
			value={s.submitted}
			of={s.assigned}
			icon={ClipboardCheck}
		/>
		<StatCard
			label={t('admin.dashboard.overview_not_started')}
			value={s.not_started}
			icon={Hourglass}
		/>
		<StatCard
			label={t('admin.dashboard.overview_requests')}
			value={s.reopen + s.corrections}
			icon={Inbox}
			href="/admin/requests"
			tone={s.reopen + s.corrections ? 'warning' : 'default'}
		/>
	</div>

	<Collapsible.Root open={filtered}>
		<Collapsible.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline" size="sm"><Filter />{t('common.filter')}</Button>
			{/snippet}
		</Collapsible.Trigger>
		<Collapsible.Content>
			<Card.Root class="mt-3">
				<Card.Content>
					<form method="GET" class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div class="grid gap-2">
							<Label for="f-group">{t('common.group')}</Label>
							<NativeSelect id="f-group" name="group" value={data.filters.group}>
								<option value="">{t('common.all')}</option>
								{#each data.groupsOptions as [id, name] (id)}<option value={id}>{name}</option
									>{/each}
							</NativeSelect>
						</div>
						<div class="grid gap-2">
							<Label for="f-event">{t('common.event')}</Label>
							<NativeSelect id="f-event" name="event" value={data.filters.event}>
								<option value="">{t('common.all')}</option>
								{#each data.eventOptions as e (e.id)}<option value={e.id}
										>{e.group} – {e.name}</option
									>{/each}
							</NativeSelect>
						</div>
						<div class="grid gap-2">
							<Label for="f-judge">{t('common.judge')}</Label>
							<NativeSelect id="f-judge" name="judge" value={data.filters.judge}>
								<option value="">{t('common.all')}</option>
								{#each data.judges as j (j.id)}<option value={j.id}>{j.display_name}</option>{/each}
							</NativeSelect>
						</div>
						<div class="flex gap-2">
							<Button type="submit">{t('common.filter')}</Button>
							{#if filtered}<Button href="/admin" variant="ghost">{t('common.all')}</Button>{/if}
						</div>
					</form>
				</Card.Content>
			</Card.Root>
		</Collapsible.Content>
	</Collapsible.Root>

	{#each groups as [id, g] (id)}
		<Card.Root class="gap-0 py-0">
			<Card.Header class="border-b py-4"
				><Card.Title class="text-lg">{g.name}</Card.Title></Card.Header
			>
			<Table.Root>
				<Table.Body>
					{#each g.rows as r (r.event_id)}
						<Table.Row data-testid="event-progress">
							<Table.Cell class="w-[40%] py-3 whitespace-normal">
								<a
									href="/admin/submissions?event={r.event_id}"
									class="font-semibold hover:underline">{r.event_name}</a
								>
								<div class="text-muted-foreground text-sm">
									{t('admin.dashboard.judges_submitted', { a: r.submitted, b: r.required_judges })}
								</div>
							</Table.Cell>
							<Table.Cell class="hidden w-[20%] sm:table-cell">
								<Progress value={r.submitted} max={Math.max(1, r.required_judges)} class="h-2" />
							</Table.Cell>
							<Table.Cell class="whitespace-normal">
								<div class="flex flex-wrap gap-1.5">
									{#if r.finalized}
										<Badge variant="success">{t('result_status.finalized')}</Badge>
									{:else if r.required_judges === 0}
										<Badge variant="destructive">{t('admin.dashboard.no_judges')}</Badge>
									{:else if r.complete}
										<Badge variant="info">{t('admin.dashboard.complete')}</Badge>
									{:else}
										<Badge variant="neutral"
											>{t('admin.dashboard.waiting_for', {
												n: r.required_judges - r.submitted
											})}</Badge
										>
									{/if}
									{#if r.reopening_pending + r.corrections_open > 0}
										<Badge variant="warning" href="/admin/requests"
											>{t('nav.requests')}: {r.reopening_pending + r.corrections_open}</Badge
										>
									{/if}
									{#if r.incomplete_submissions > 0}
										<Badge variant="destructive"
											>{t('admin.dashboard.needs_fix', { n: r.incomplete_submissions })}</Badge
										>
									{/if}
								</div>
							</Table.Cell>
							<Table.Cell class="w-10 text-right">
								<Button
									href={r.complete
										? `/admin/results/${r.event_id}`
										: `/admin/submissions?event=${r.event_id}`}
									variant="ghost"
									size="icon-sm"
									aria-label={r.event_name}
								>
									<ChevronRight />
								</Button>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Root>
	{/each}
</div>

<script lang="ts">
	import { page } from '$app/state';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Collapsible from '#lib/components/ui/collapsible/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import AppSelect from '#lib/components/app/AppSelect.svelte';
	import { eventOptions, all } from '#lib/options.ts';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';

	let { data } = $props();
	const who = (id: string | null) => {
		const p = data.people.find((x) => x.id === id);
		return p ? p.display_name : id ? id.slice(0, 8) : '–';
	};
	const eventName = (id: string | null) =>
		data.groups.flatMap((g) => g.events).find((e) => e.id === id)?.name ?? '';
	const nextHref = $derived.by(() => {
		const u = new URL(page.url.href);
		if (data.next) u.searchParams.set('before', String(data.next));
		return u.pathname + u.search;
	});
</script>

<svelte:head><title>{t('admin.audit.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.audit.title')} />
	<Card.Root>
		<Card.Content>
			<form method="GET" class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<div class="grid gap-2">
					<Label for="a-from">{t('common.from')}</Label><Input
						id="a-from"
						name="from"
						type="date"
						value={data.filters.from}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="a-to">{t('common.to')}</Label><Input
						id="a-to"
						name="to"
						type="date"
						value={data.filters.to}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="a-actor">{t('admin.audit.actor')}</Label>
					<AppSelect
						id="a-actor"
						name="actor"
						value={data.filters.actor}
						options={[
							all(t('common.all')),
							...data.people.map((p) => ({
								value: p.id,
								label: `${p.display_name} (${p.username})`
							}))
						]}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="a-event">{t('common.event')}</Label>
					<AppSelect
						id="a-event"
						name="event"
						value={data.filters.event}
						options={[all(t('common.all')), ...eventOptions(data.groups)]}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="a-part">{t('common.participant')} ({t('common.code')})</Label><Input
						id="a-part"
						name="participant"
						value={data.filters.participant}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="a-action">{t('admin.audit.action')}</Label>
					<AppSelect
						id="a-action"
						name="action"
						value={data.filters.action}
						options={[all(t('common.all')), ...data.actions.map((a) => ({ value: a, label: a }))]}
					/>
				</div>
				<div><Button type="submit" variant="secondary">{t('common.filter')}</Button></div>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root class="py-0">
		{#if data.rows.length === 0}
			<p class="text-muted-foreground p-6">{t('admin.audit.none')}</p>
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row
						><Table.Head>{t('admin.audit.time')}</Table.Head><Table.Head
							>{t('admin.audit.action')}</Table.Head
						><Table.Head>{t('admin.audit.actor')}</Table.Head><Table.Head
							>{t('admin.audit.details')}</Table.Head
						></Table.Row
					>
				</Table.Header>
				<Table.Body>
					{#each data.rows as r (r.id)}
						<Table.Row>
							<Table.Cell class="text-muted-foreground align-top text-xs whitespace-nowrap"
								>{formatDateTime(locale(), r.created_at)}</Table.Cell
							>
							<Table.Cell class="align-top"
								><Badge variant="outline" class="font-mono">{r.action}</Badge></Table.Cell
							>
							<Table.Cell class="align-top text-sm whitespace-normal"
								>{who(r.actor_id)}
								<div class="text-muted-foreground text-xs">{r.actor_role}</div></Table.Cell
							>
							<Table.Cell class="align-top text-sm whitespace-normal">
								{#if r.event_id}<div>{t('common.event')}: {eventName(r.event_id)}</div>{/if}
								{#if r.judge_id}<div>{t('common.judge')}: {who(r.judge_id)}</div>{/if}
								{#if r.reason}<div><strong>{t('common.reason')}:</strong> {r.reason}</div>{/if}
								{#if r.old_value || r.new_value || Object.keys(r.metadata ?? {}).length}
									<Collapsible.Root>
										<Collapsible.Trigger
											class="text-primary text-sm underline-offset-4 hover:underline"
											>{t('admin.audit.details')}</Collapsible.Trigger
										>
										<Collapsible.Content>
											{#if r.old_value}<pre
													class="bg-muted mt-1 max-h-64 overflow-auto rounded p-2 text-xs">- {JSON.stringify(
														r.old_value,
														null,
														1
													)}</pre>{/if}
											{#if r.new_value}<pre
													class="bg-muted mt-1 max-h-64 overflow-auto rounded p-2 text-xs">+ {JSON.stringify(
														r.new_value,
														null,
														1
													)}</pre>{/if}
											{#if Object.keys(r.metadata ?? {}).length}<pre
													class="bg-muted mt-1 max-h-64 overflow-auto rounded p-2 text-xs">{JSON.stringify(
														r.metadata,
														null,
														1
													)}</pre>{/if}
										</Collapsible.Content>
									</Collapsible.Root>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</Card.Root>
	{#if data.next}<div>
			<Button href={nextHref} variant="outline">{t('admin.audit.older')}</Button>
		</div>{/if}
</div>

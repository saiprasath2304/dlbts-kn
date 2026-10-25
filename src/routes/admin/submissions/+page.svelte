<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Radio from '@lucide/svelte/icons/radio';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import StatusBadge from '#lib/components/app/StatusBadge.svelte';
	import NativeSelect from '#lib/components/app/NativeSelect.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { LiveRefresh } from '#lib/realtime.svelte.ts';

	let { data } = $props();
	const statuses = [
		'not_started',
		'in_progress',
		'submitted',
		'reopening_requested',
		'correction_requested',
		'reopened',
		'resubmitted'
	];
	const live = new LiveRefresh(untrack(() => data.token));
	onMount(() => {
		live.start();
		return () => live.stop();
	});
</script>

<svelte:head><title>{t('admin.submissions.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.submissions.title')}>
		{#snippet actions()}
			<Badge variant={live.live ? 'success' : 'neutral'} class="gap-1.5 text-sm">
				<Radio class={live.live ? 'animate-pulse' : ''} />{live.live
					? t('admin.dashboard.live')
					: t('admin.dashboard.polling', { s: live.pollSeconds })}
			</Badge>
		{/snippet}
	</PageHeader>

	<Card.Root>
		<Card.Content>
			<form
				method="GET"
				class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
			>
				<div class="grid gap-2">
					<Label for="s-group">{t('common.group')}</Label>
					<NativeSelect id="s-group" name="group" value={data.filters.group}>
						<option value="">{t('common.all')}</option>
						{#each data.groups as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
					</NativeSelect>
				</div>
				<div class="grid gap-2">
					<Label for="s-event">{t('common.event')}</Label>
					<NativeSelect id="s-event" name="event" value={data.filters.event}>
						<option value="">{t('common.all')}</option>
						{#each data.groups as g (g.id)}
							<optgroup label={g.name}
								>{#each g.events as e (e.id)}<option value={e.id}>{e.name}</option>{/each}</optgroup
							>
						{/each}
					</NativeSelect>
				</div>
				<div class="grid gap-2">
					<Label for="s-judge">{t('common.judge')}</Label>
					<NativeSelect id="s-judge" name="judge" value={data.filters.judge}>
						<option value="">{t('common.all')}</option>
						{#each data.judges as j (j.id)}<option value={j.id}>{j.display_name}</option>{/each}
					</NativeSelect>
				</div>
				<div class="grid gap-2">
					<Label for="s-status">{t('common.status')}</Label>
					<NativeSelect id="s-status" name="status" value={data.filters.status}>
						<option value="">{t('common.all')}</option>
						{#each statuses as s (s)}<option value={s}>{t(`status.${s}`)}</option>{/each}
					</NativeSelect>
				</div>
				<Button type="submit" variant="secondary">{t('common.filter')}</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root class="py-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{t('common.event')}</Table.Head>
					<Table.Head>{t('common.judge')}</Table.Head>
					<Table.Head>{t('common.status')}</Table.Head>
					<Table.Head class="hidden lg:table-cell">{t('admin.submissions.last_saved')}</Table.Head>
					<Table.Head class="hidden lg:table-cell">{t('admin.submissions.submitted_at')}</Table.Head
					>
					<Table.Head></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.rows as s (s.id)}
					<Table.Row class={s.required ? '' : 'opacity-60'}>
						<Table.Cell class="py-3 whitespace-normal">
							<div class="text-muted-foreground text-xs">{s.events?.groups?.name}</div>
							<div class="font-semibold">{s.events?.name}</div>
						</Table.Cell>
						<Table.Cell class="whitespace-normal">
							<div>{s.profiles?.display_name}</div>
							<div class="text-muted-foreground font-mono text-xs">{s.profiles?.username}</div>
						</Table.Cell>
						<Table.Cell><StatusBadge status={s.status} /></Table.Cell>
						<Table.Cell class="text-muted-foreground hidden text-sm lg:table-cell"
							>{formatDateTime(locale(), s.last_saved_at)}</Table.Cell
						>
						<Table.Cell class="text-muted-foreground hidden text-sm lg:table-cell"
							>{formatDateTime(locale(), s.submitted_at)}</Table.Cell
						>
						<Table.Cell class="w-10 text-right">
							<Button
								href="/admin/submissions/{s.id}"
								variant="ghost"
								size="icon-sm"
								aria-label={t('common.open')}><ChevronRight /></Button
							>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>
</div>

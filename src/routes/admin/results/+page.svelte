<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data } = $props();
	const variant = (s: string) =>
		s === 'finalized'
			? 'success'
			: s === 'ready_for_finalization'
				? 'info'
				: s === 'awaiting_tie_resolution'
					? 'warning'
					: 'neutral';
	const groups = $derived([...new Set(data.events.map((e) => e.group))]);
</script>

<svelte:head><title>{t('admin.results.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.results.title')} description={t('admin.results.hidden')} />
	{#each groups as g (g)}
		<Card.Root class="gap-0 py-0">
			<Card.Header class="border-b py-4"><Card.Title class="text-lg">{g}</Card.Title></Card.Header>
			<Table.Root>
				<Table.Body>
					{#each data.events.filter((e) => e.group === g) as e (e.id)}
						<Table.Row>
							<Table.Cell class="py-3 font-semibold whitespace-normal"
								><a href="/admin/results/{e.id}" class="hover:underline">{e.name}</a></Table.Cell
							>
							<Table.Cell class="text-muted-foreground hidden text-sm sm:table-cell"
								>{t('report.judges_submitted')}: {t('common.of', {
									a: e.submitted,
									b: e.required
								})}</Table.Cell
							>
							<Table.Cell class="whitespace-normal">
								<Badge variant={variant(e.status)}>{t(`result_status.${e.status}`)}</Badge>
								{#if e.unresolved}<Badge variant="warning"
										>{t('admin.results.ties')}: {e.unresolved}</Badge
									>{/if}
							</Table.Cell>
							<Table.Cell class="w-10 text-right"
								><Button
									href="/admin/results/{e.id}"
									variant="ghost"
									size="icon-sm"
									aria-label={e.name}><ChevronRight /></Button
								></Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Root>
	{/each}
</div>

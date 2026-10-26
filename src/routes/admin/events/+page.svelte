<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { enhance } from '$app/forms';
	import { withProgress } from '#lib/progress.svelte.ts';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import FormDialog from '#lib/components/app/FormDialog.svelte';
	import GroupForm from '#lib/components/app/GroupForm.svelte';
	import EventForm from '#lib/components/app/EventForm.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data, form } = $props();
	let tab = $state('');
	$effect.pre(() => {
		if (!tab || !data.groups.some((g) => g.id === tab)) tab = data.tab;
	});
</script>

<svelte:head><title>{t('admin.events.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.events.title')}>
		{#snippet actions()}
			<FormDialog action="?/saveGroup" title={t('admin.groups.new')} variant="outline">
				{#snippet trigger()}<FolderPlus />{t('admin.groups.new')}{/snippet}
				<GroupForm />
			</FormDialog>
			<FormDialog action="?/saveEvent" title={t('admin.events.new')} wide>
				{#snippet trigger()}<Plus />{t('admin.events.new')}{/snippet}
				<EventForm groups={data.groups} groupId={tab} />
			</FormDialog>
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />

	{#if data.groups.length}
		<Tabs.Root bind:value={tab} class="min-w-0">
			<div>
				<Tabs.List variant="line" class="h-auto flex-wrap justify-start">
					{#each data.groups as g (g.id)}
						<Tabs.Trigger value={g.id} class="px-4 py-2 text-[0.95rem]">
							{g.name}<Badge variant="neutral" class="ml-1.5">{g.events.length}</Badge>
						</Tabs.Trigger>
					{/each}
				</Tabs.List>
			</div>
			{#each data.groups as g (g.id)}
				<Tabs.Content value={g.id} class="mt-4">
					<Card.Root class="gap-0 py-0">
						<Card.Header
							class="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4"
						>
							<div>
								<Card.Title class="flex items-center gap-2 text-lg">
									{g.name}
									<span class="text-muted-foreground font-mono text-sm font-normal">{g.code}</span>
									{#if !g.is_active}<Badge variant="neutral">{t('common.inactive')}</Badge>{/if}
								</Card.Title>
								{#if g.description}<Card.Description>{g.description}</Card.Description>{/if}
							</div>
							<div class="flex gap-2">
								<FormDialog action="?/saveGroup" title={g.name} variant="ghost" size="sm">
									{#snippet trigger()}<Pencil />{t('common.edit')}{/snippet}
									<GroupForm group={g} />
								</FormDialog>
								{#if g.events.length === 0}
									<form method="POST" action="?/deleteGroup" use:enhance={withProgress()}>
										<input type="hidden" name="id" value={g.id} />
										<Button type="submit" variant="destructive" size="sm"
											>{t('common.delete')}</Button
										>
									</form>
								{/if}
							</div>
						</Card.Header>
						{#if g.events.length === 0}
							<p class="text-muted-foreground p-6">{t('common.none')}</p>
						{:else}
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>{t('common.event')}</Table.Head>
										<Table.Head class="hidden text-right sm:table-cell"
											>{t('admin.events.tab_judges')}</Table.Head
										>
										<Table.Head class="hidden text-right sm:table-cell"
											>{t('admin.events.tab_participants')}</Table.Head
										>
										<Table.Head class="hidden text-right md:table-cell"
											>{t('admin.events.tab_criteria')}</Table.Head
										>
										<Table.Head></Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each g.events as e (e.id)}
										{@const st = data.stats[e.id]}
										<Table.Row>
											<Table.Cell class="py-3 whitespace-normal">
												<a href="/admin/events/{e.id}" class="font-semibold hover:underline"
													>{e.name}</a
												>
												<span class="text-muted-foreground ml-1 font-mono text-xs">{e.code}</span>
												{#if e.venue}<div
														class="text-muted-foreground inline-flex items-center gap-1 text-xs"
													>
														<MapPin class="size-3" />{e.venue}
													</div>{/if}
												{#if !e.is_active}<Badge variant="neutral" class="ml-1"
														>{t('common.inactive')}</Badge
													>{/if}
												{#if st?.finalized}<Badge variant="success" class="ml-1"
														>{t('result_status.finalized')}</Badge
													>{/if}
											</Table.Cell>
											<Table.Cell class="hidden text-right tabular-nums sm:table-cell"
												>{st?.judges ?? 0}</Table.Cell
											>
											<Table.Cell class="hidden text-right tabular-nums sm:table-cell"
												>{st?.participants ?? 0}</Table.Cell
											>
											<Table.Cell class="hidden text-right tabular-nums md:table-cell"
												>{st?.criteria ?? 0}</Table.Cell
											>
											<Table.Cell class="w-10 text-right">
												<Button
													href="/admin/events/{e.id}"
													variant="ghost"
													size="icon-sm"
													aria-label="{t('admin.events.manage')}: {e.name}"><ChevronRight /></Button
												>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						{/if}
					</Card.Root>
				</Tabs.Content>
			{/each}
		</Tabs.Root>
	{/if}
</div>

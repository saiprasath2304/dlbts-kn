<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Upload from '@lucide/svelte/icons/upload';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { enhance } from '$app/forms';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import FormDialog from '#lib/components/app/FormDialog.svelte';
	import ConfirmForm from '#lib/components/app/ConfirmForm.svelte';
	import EventForm from '#lib/components/app/EventForm.svelte';
	import CriterionForm from '#lib/components/app/CriterionForm.svelte';
	import ReasonField from '#lib/components/app/ReasonField.svelte';
	import NativeSelect from '#lib/components/app/NativeSelect.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';
	import { formatMark } from '#lib/scoring.ts';

	let { data, form } = $props();
	const ev = $derived(data.event);
	const totalMax = $derived(
		data.criteria.filter((c) => c.is_active).reduce((s, c) => s + c.max_marks, 0)
	);
	const assignedIds = $derived(new Set(data.assignments.map((a) => a.judge_id)));
	const freeJudges = $derived(data.judges.filter((j) => !assignedIds.has(j.id)));
	let busy = $state(false);
</script>

<svelte:head><title>{ev.name}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<div>
		<Button href="/admin/events?group={ev.group_id}" variant="ghost" size="sm" class="-ml-2"
			><ArrowLeft />{t('admin.events.title')}</Button
		>
	</div>
	<PageHeader title={ev.name} eyebrow={ev.groups?.name}>
		{#snippet actions()}
			{#if data.scoringStarted}<Badge variant="warning" class="text-sm"
					><TriangleAlert />{t('admin.events.scoring_started')}</Badge
				>{/if}
			<Button href="/admin/submissions?event={ev.id}" variant="outline" size="sm"
				>{t('nav.submissions')}</Button
			>
			<Button href="/admin/results/{ev.id}" variant="outline" size="sm">{t('nav.results')}</Button>
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />

	<Tabs.Root value="criteria">
		<Tabs.List class="h-auto flex-wrap">
			<Tabs.Trigger value="criteria" class="px-4 py-2"
				>{t('admin.events.tab_criteria')}
				<Badge variant="neutral" class="ml-1.5">{data.criteria.length}</Badge></Tabs.Trigger
			>
			<Tabs.Trigger value="judges" class="px-4 py-2"
				>{t('admin.events.tab_judges')}
				<Badge variant="neutral" class="ml-1.5"
					>{data.assignments.filter((a) => a.is_active).length}</Badge
				></Tabs.Trigger
			>
			<Tabs.Trigger value="participants" class="px-4 py-2"
				>{t('admin.events.tab_participants')}
				<Badge variant="neutral" class="ml-1.5"
					>{data.entries.filter((e) => e.is_active).length}</Badge
				></Tabs.Trigger
			>
			<Tabs.Trigger value="details" class="px-4 py-2">{t('admin.audit.details')}</Tabs.Trigger>
		</Tabs.List>

		<!-- Criteria -->
		<Tabs.Content value="criteria" class="mt-4">
			<Card.Root class="gap-0 py-0">
				<Card.Header class="flex flex-row items-center justify-between gap-3 border-b py-4">
					<Card.Title>{t('admin.criteria.total_max', { max: formatMark(totalMax) })}</Card.Title>
					<FormDialog action="?/saveCriterion" title={t('admin.criteria.new')} size="sm">
						{#snippet trigger()}<Plus />{t('admin.criteria.new')}{/snippet}
						<CriterionForm
							nextOrder={data.criteria.length + 1}
							scoringStarted={data.scoringStarted}
						/>
					</FormDialog>
				</Card.Header>
				{#if data.criteria.length === 0}
					<p class="text-muted-foreground p-6">{t('admin.criteria.none')}</p>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-12">#</Table.Head>
								<Table.Head>{t('common.name')}</Table.Head>
								<Table.Head class="text-right">{t('admin.criteria.max')}</Table.Head>
								<Table.Head></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each data.criteria as c (c.id)}
								<Table.Row class={c.is_active ? '' : 'opacity-60'}>
									<Table.Cell class="text-muted-foreground">{c.display_order}</Table.Cell>
									<Table.Cell class="whitespace-normal">
										<span class="font-medium">{c.name}</span>
										{#if !c.is_active}<Badge variant="neutral" class="ml-1"
												>{t('common.inactive')}</Badge
											>{/if}
										{#if c.description}<div class="text-muted-foreground text-sm">
												{c.description}
											</div>{/if}
									</Table.Cell>
									<Table.Cell class="text-right font-semibold tabular-nums"
										>{formatMark(c.max_marks)}</Table.Cell
									>
									<Table.Cell class="w-24 text-right">
										<FormDialog action="?/saveCriterion" title={c.name} variant="ghost" size="sm">
											{#snippet trigger()}<Pencil />{t('common.edit')}{/snippet}
											<CriterionForm criterion={c} scoringStarted={data.scoringStarted} />
										</FormDialog>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}
			</Card.Root>
		</Tabs.Content>

		<!-- Judges -->
		<Tabs.Content value="judges" class="mt-4">
			<Card.Root class="gap-0 py-0">
				<Card.Header class="flex flex-row items-center justify-between gap-3 border-b py-4">
					<Card.Title>{t('admin.events.tab_judges')}</Card.Title>
					{#if freeJudges.length}
						<FormDialog action="?/setAssignment" title={t('admin.assignments.add')} size="sm">
							{#snippet trigger()}<Plus />{t('admin.assignments.add')}{/snippet}
							<input type="hidden" name="active" value="true" />
							<div class="grid gap-2">
								<Label for="add-judge">{t('admin.assignments.select_judge')}</Label>
								<NativeSelect id="add-judge" name="judge_id" required>
									{#each freeJudges as j (j.id)}<option value={j.id}
											>{j.display_name} ({j.username}){j.is_active
												? ''
												: ' – ' + t('common.inactive')}</option
										>{/each}
								</NativeSelect>
							</div>
							<ReasonField show={data.scoringStarted} id="aj-reason" />
						</FormDialog>
					{/if}
				</Card.Header>
				{#if data.assignments.length === 0}
					<p class="text-muted-foreground p-6">{t('admin.assignments.none')}</p>
				{:else}
					<Table.Root>
						<Table.Body>
							{#each data.assignments as a (a.id)}
								<Table.Row class={a.is_active ? '' : 'opacity-60'}>
									<Table.Cell class="py-3 whitespace-normal">
										<div class="font-medium">{a.profiles?.display_name}</div>
										<div class="text-muted-foreground font-mono text-xs">
											{a.profiles?.username}
										</div>
									</Table.Cell>
									<Table.Cell>
										{#if !a.is_active}<Badge variant="neutral">{t('common.inactive')}</Badge>{/if}
										{#if !a.profiles?.is_active}<Badge variant="destructive"
												>{t('common.inactive')}</Badge
											>{/if}
									</Table.Cell>
									<Table.Cell class="text-right">
										<ConfirmForm
											action="?/setAssignment"
											label={a.is_active
												? t('admin.assignments.remove')
												: t('admin.assignments.restore')}
											title={`${a.is_active ? t('admin.assignments.remove') : t('admin.assignments.restore')}: ${a.profiles?.display_name}`}
											message={data.scoringStarted ? t('common.confirm_reason_body') : ''}
											requireReason={data.scoringStarted}
											danger={a.is_active}
											variant={a.is_active ? 'ghost' : 'outline'}
											size="sm"
										>
											{#snippet fields()}
												<input type="hidden" name="judge_id" value={a.judge_id} />
												<input type="hidden" name="active" value={a.is_active ? 'false' : 'true'} />
											{/snippet}
										</ConfirmForm>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}
			</Card.Root>
		</Tabs.Content>

		<!-- Participants -->
		<Tabs.Content value="participants" class="mt-4">
			<Card.Root class="gap-0 py-0">
				<Card.Header
					class="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4"
				>
					<Card.Title>{t('admin.events.tab_participants')}</Card.Title>
					<div class="flex gap-2">
						<Button href="/admin/participants/import" variant="outline" size="sm"
							><Upload />{t('nav.import')}</Button
						>
						{#if data.available.length}
							<FormDialog
								action="?/setParticipant"
								title={t('admin.participants.add_to_event')}
								size="sm"
							>
								{#snippet trigger()}<Plus />{t('admin.participants.add_to_event')}{/snippet}
								<input type="hidden" name="active" value="true" />
								<div class="grid gap-2">
									<Label for="add-part">{t('common.participant')}</Label>
									<NativeSelect id="add-part" name="participant_id" required>
										{#each data.available as p (p.id)}<option value={p.id}
												>{p.code} – {p.name}</option
											>{/each}
									</NativeSelect>
								</div>
								<ReasonField show={data.scoringStarted} id="ap-reason" />
							</FormDialog>
						{/if}
					</div>
				</Card.Header>
				{#if data.entries.length === 0}
					<p class="text-muted-foreground p-6">{t('admin.participants.none')}</p>
				{:else}
					<Table.Root>
						<Table.Body>
							{#each data.entries as e (e.id)}
								<Table.Row class={e.is_active ? '' : 'opacity-60'}>
									<Table.Cell class="py-3 whitespace-normal">
										<div class="font-medium">{e.participants?.name}</div>
										<div class="text-muted-foreground font-mono text-xs">
											{e.participants
												?.code}{#if e.participants?.affiliation}{` · ${e.participants.affiliation}`}{/if}
										</div>
									</Table.Cell>
									<Table.Cell
										>{#if !e.is_active}<Badge variant="neutral">{t('common.inactive')}</Badge
											>{/if}</Table.Cell
									>
									<Table.Cell class="text-right">
										<ConfirmForm
											action="?/setParticipant"
											label={e.is_active
												? t('admin.participants.remove_from_event')
												: t('admin.assignments.restore')}
											title={`${e.is_active ? t('admin.participants.remove_from_event') : t('admin.assignments.restore')}: ${e.participants?.name}`}
											message={data.scoringStarted ? t('common.confirm_reason_body') : ''}
											requireReason={data.scoringStarted}
											danger={e.is_active}
											variant={e.is_active ? 'ghost' : 'outline'}
											size="sm"
										>
											{#snippet fields()}
												<input type="hidden" name="participant_id" value={e.participants?.id} />
												<input type="hidden" name="active" value={e.is_active ? 'false' : 'true'} />
											{/snippet}
										</ConfirmForm>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}
			</Card.Root>
		</Tabs.Content>

		<!-- Details -->
		<Tabs.Content value="details" class="mt-4">
			<Card.Root>
				<Card.Content>
					<form
						method="POST"
						action="?/saveEvent"
						class="grid gap-5"
						use:enhance={() => {
							busy = true;
							return async ({ update }) => {
								busy = false;
								await update({ reset: false });
							};
						}}
					>
						<EventForm event={ev} groups={data.groups} />
						<ReasonField show={data.scoringStarted} id="e-reason" />
						<div><Button type="submit" disabled={busy}>{t('common.save')}</Button></div>
					</form>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>

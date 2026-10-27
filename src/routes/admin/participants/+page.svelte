<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Upload from '@lucide/svelte/icons/upload';
	import Download from '@lucide/svelte/icons/download';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Gift from '@lucide/svelte/icons/gift';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';
	import { enhance } from '$app/forms';
	import { withProgress } from '#lib/progress.svelte.ts';
	import Search from '@lucide/svelte/icons/search';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import FormDialog from '#lib/components/app/FormDialog.svelte';
	import ConfirmForm from '#lib/components/app/ConfirmForm.svelte';
	import ParticipantForm from '#lib/components/app/ParticipantForm.svelte';
	import AppSelect from '#lib/components/app/AppSelect.svelte';
	import { groupOptions, eventOptions, all } from '#lib/options.ts';
	import AddEventDialog from '#lib/components/app/AddEventDialog.svelte';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import { t } from '#lib/i18n/t.svelte.ts';
	import { formatDob } from '#lib/i18n/index.ts';

	let { data, form } = $props();
	const allEvents = $derived(
		data.groups.flatMap((g) => g.events.map((e) => ({ ...e, group: g.name })))
	);
	const exportQuery = $derived(
		new URLSearchParams({ group: data.filters.group, event: data.filters.event }).toString()
	);
	let inactive = $derived(data.filters.inactive);
</script>

<svelte:head><title>{t('admin.participants.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.participants.title')}>
		{#snippet actions()}
			<Button href="/admin/participants/import" variant="outline"
				><Upload />{t('nav.import')}</Button
			>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class={buttonVariants({ variant: 'outline' })}
					><Download />{t('admin.participants.export')}</DropdownMenu.Trigger
				>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item>
						{#snippet child({ props })}<a
								{...props}
								href="/admin/participants/export?format=csv&{exportQuery}"
								download>{t('common.download_csv')}</a
							>{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						{#snippet child({ props })}<a
								{...props}
								href="/admin/participants/export?format=xlsx&{exportQuery}"
								download>{t('common.download_xlsx')}</a
							>{/snippet}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<FormDialog action="?/save" title={t('admin.participants.new')} wide>
				{#snippet trigger()}<Plus />{t('admin.participants.new')}{/snippet}
				<ParticipantForm groups={data.groups} events={allEvents} />
			</FormDialog>
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />

	<Card.Root>
		<Card.Content>
			<form
				method="GET"
				class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]"
			>
				<div class="grid gap-2">
					<Label for="f-q">{t('common.search')}</Label>
					<div class="relative">
						<Search
							class="text-muted-foreground pointer-events-none absolute top-3 left-3 size-5"
						/>
						<Input id="f-q" name="q" type="search" value={data.filters.q} class="pl-10" />
					</div>
				</div>
				<div class="grid gap-2">
					<Label for="f-group">{t('common.group')}</Label>
					<AppSelect
						id="f-group"
						name="group"
						value={data.filters.group}
						options={[all(t('common.all')), ...groupOptions(data.groups)]}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="f-event">{t('common.event')}</Label>
					<AppSelect
						id="f-event"
						name="event"
						value={data.filters.event}
						options={[all(t('common.all')), ...eventOptions(data.groups)]}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="f-samithi">{t('admin.participants.affiliation')}</Label>
					<AppSelect
						id="f-samithi"
						name="samithi"
						value={data.filters.samithi}
						options={[all(t('common.all')), ...data.samithis.map((s) => ({ value: s, label: s }))]}
					/>
				</div>
				<div class="flex h-11 items-center gap-2">
					<Checkbox id="f-inactive" name="inactive" value="1" bind:checked={inactive} />
					<Label for="f-inactive" class="font-normal">{t('common.inactive')}</Label>
				</div>
				<Button type="submit" variant="secondary">{t('common.filter')}</Button>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root class="py-0">
		{#if data.participants.length === 0}
			<p class="text-muted-foreground p-6">{t('admin.participants.none')}</p>
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{t('common.participant')}</Table.Head>
						<Table.Head class="hidden md:table-cell">{t('common.group')}</Table.Head>
						<Table.Head class="hidden lg:table-cell">{t('admin.participants.events')}</Table.Head>
						<Table.Head class="text-right">{t('common.actions')}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.participants as p (p.id)}
						<Table.Row class={p.is_active ? '' : 'opacity-60'}>
							<Table.Cell class="py-3 whitespace-normal">
								<div class="font-semibold">{p.name}</div>
								<div class="text-muted-foreground text-sm">
									<span class="font-mono">{p.code}</span>
									· {p.kind === 'team'
										? t('admin.participants.kind_team')
										: t('admin.participants.kind_individual')}
									{#if p.affiliation}· {p.affiliation}{/if}
								</div>
								{#if p.members}<div class="text-muted-foreground mt-0.5 text-xs">
										{t('score.members')}: {p.members}
									</div>{/if}
								{#if p.registration_no || p.dob}
									<div class="text-muted-foreground mt-0.5 text-xs">
										{#if p.registration_no}{t('score.reg_no')}: {p.registration_no}{/if}
										{#if p.registration_no && p.dob}·{/if}
										{#if p.dob}{t('dob.label')}: {formatDob(p.dob)}{/if}
									</div>
								{/if}
								<div class="mt-1.5 flex flex-wrap gap-1.5">
									<form method="POST" action="?/dobVerified" use:enhance={withProgress()}>
										<input type="hidden" name="id" value={p.id} />
										<input
											type="hidden"
											name="verified"
											value={p.dob_verified ? 'false' : 'true'}
										/>
										<button
											type="submit"
											class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs {p.dob_verified
												? 'border-success/40 bg-success/10 text-success'
												: 'text-muted-foreground hover:bg-muted'}"
											aria-pressed={p.dob_verified}
										>
											<BadgeCheck class="size-3" />{p.dob_verified
												? t('dob.verified')
												: t('dob.mark_verified')}
										</button>
									</form>
									<form method="POST" action="?/memento" use:enhance={withProgress()}>
										<input type="hidden" name="id" value={p.id} />
										<input type="hidden" name="given" value={p.memento_given ? 'false' : 'true'} />
										<button
											type="submit"
											class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs {p.memento_given
												? 'border-success/40 bg-success/10 text-success'
												: 'text-muted-foreground hover:bg-muted'}"
											aria-pressed={p.memento_given}
										>
											<Gift class="size-3" />{p.memento_given
												? t('memento.given')
												: t('memento.mark_given')}
										</button>
									</form>
								</div>
								{#if !p.is_active}<Badge variant="neutral" class="mt-1"
										>{t('common.inactive')}</Badge
									>{/if}
							</Table.Cell>
							<Table.Cell class="hidden md:table-cell">{p.groups?.name}</Table.Cell>
							<Table.Cell class="hidden whitespace-normal lg:table-cell">
								<div class="flex flex-wrap gap-1">
									{#each p.event_participants.filter((l) => l.is_active) as l (l.event_id)}
										<span
											class="bg-secondary inline-flex items-center gap-0.5 rounded-full py-0.5 pr-0.5 pl-2.5 text-xs font-medium"
										>
											{l.events?.name}
											<ConfirmForm
												action="?/removeEvent"
												label="✕"
												title={t('admin.participants.remove_event', {
													event: l.events?.name ?? ''
												})}
												message={p.name}
												optionalNote
												reasonLabel={t('common.reason')}
												danger
												variant="ghost"
												size="icon-xs"
											>
												{#snippet fields()}
													<input type="hidden" name="id" value={p.id} />
													<input type="hidden" name="event_id" value={l.event_id} />
												{/snippet}
											</ConfirmForm>
										</span>
									{:else}<span class="text-muted-foreground text-sm">{t('common.none')}</span
										>{/each}
								</div>
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex flex-wrap justify-end gap-1">
									<AddEventDialog
										participant={{
											id: p.id,
											name: p.name,
											group_id: p.group_id,
											eventIds: p.event_participants
												.filter((l) => l.is_active)
												.map((l) => l.event_id)
										}}
										groups={data.groups}
									/>
									<Button
										href="/admin/feedback/pdf?participant={p.id}"
										variant="ghost"
										size="sm"
										download
										title={t('admin.participants.feedback_pdf')}
										><MessageSquareText /><span class="sr-only xl:not-sr-only"
											>{t('admin.participants.feedback_pdf')}</span
										></Button
									>
									<FormDialog action="?/save" title={p.name} variant="ghost" size="sm" wide>
										{#snippet trigger()}<Pencil /><span class="sr-only sm:not-sr-only"
												>{t('common.edit')}</span
											>{/snippet}
										<ParticipantForm participant={p} groups={data.groups} />
									</FormDialog>
									<ConfirmForm
										action="?/setActive"
										label={p.is_active ? t('common.deactivate') : t('common.activate')}
										title={`${p.is_active ? t('common.deactivate') : t('common.activate')}: ${p.name}`}
										optionalNote
										reasonLabel={t('common.reason')}
										danger={p.is_active}
										variant="ghost"
										size="sm"
									>
										{#snippet fields()}
											<input type="hidden" name="id" value={p.id} />
											<input type="hidden" name="active" value={p.is_active ? 'false' : 'true'} />
										{/snippet}
									</ConfirmForm>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</Card.Root>
</div>

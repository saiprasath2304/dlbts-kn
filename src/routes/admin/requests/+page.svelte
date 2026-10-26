<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import ConfirmForm from '#lib/components/app/ConfirmForm.svelte';
	import FormDialog from '#lib/components/app/FormDialog.svelte';
	import AppSelect from '#lib/components/app/AppSelect.svelte';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';

	let { data, form } = $props();
	const pendingPart = $derived(data.participantRequests.filter((r) => r.status === 'pending'));
	const pendingReopen = $derived(data.reopenings.filter((r) => r.status === 'pending'));
	const openCorr = $derived(
		data.corrections.filter((c) => c.status === 'open' || c.status === 'responded')
	);
	const closed = $derived(
		[
			...data.reopenings
				.filter((r) => r.status !== 'pending')
				.map((r) => ({ kind: 'reopen' as const, at: r.resolved_at ?? r.created_at, r })),
			...data.corrections
				.filter((c) => c.status === 'resolved' || c.status === 'cancelled')
				.map((c) => ({ kind: 'corr' as const, at: c.resolved_at ?? c.created_at, c }))
		].sort((a, b) => b.at.localeCompare(a.at))
	);
</script>

<svelte:head><title>{t('admin.requests.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.requests.title')} />
	<FormFeedback {form} />

	<Tabs.Root value="reopen">
		<Tabs.List variant="line" class="h-auto flex-wrap">
			<Tabs.Trigger value="reopen" class="px-4 py-2"
				>{t('admin.requests.reopening')}<Badge
					variant={pendingReopen.length ? 'warning' : 'neutral'}
					class="ml-1.5">{pendingReopen.length}</Badge
				></Tabs.Trigger
			>
			<Tabs.Trigger value="corr" class="px-4 py-2"
				>{t('admin.requests.corrections')}<Badge
					variant={openCorr.length ? 'warning' : 'neutral'}
					class="ml-1.5">{openCorr.length}</Badge
				></Tabs.Trigger
			>
			<Tabs.Trigger value="history" class="px-4 py-2"
				>{t('request.history')}<Badge variant="neutral" class="ml-1.5">{closed.length}</Badge
				></Tabs.Trigger
			>
			<Tabs.Trigger value="participants" class="px-4 py-2"
				>{t('admin.requests.participants')}<Badge
					variant={pendingPart.length ? 'warning' : 'neutral'}
					class="ml-1.5">{pendingPart.length}</Badge
				></Tabs.Trigger
			>
		</Tabs.List>

		<Tabs.Content value="participants" class="mt-4 grid gap-4">
			{#each pendingPart as r (r.id)}
				<Card.Root>
					<Card.Header>
						<div class="flex flex-wrap items-start justify-between gap-2">
							<div>
								<Card.Title class="text-lg">
									{t(`preq.type_${r.request_type}`)}{#if r.name}: {r.name}{:else if r.participants}: {r
											.participants.name} ({r.participants.code}){/if}
								</Card.Title>
								<Card.Description>
									{r.events?.groups?.name} – {r.events?.name} · {t('admin.requests.requested_by', {
										name: r.profiles?.display_name ?? ''
									})} · {formatDateTime(locale(), r.created_at)}
								</Card.Description>
							</div>
							<Badge variant="warning">{t('request.pending')}</Badge>
						</div>
					</Card.Header>
					<Card.Content class="grid gap-2">
						<blockquote class="border-primary/40 border-l-4 pl-3">{r.details}</blockquote>
						{#if r.request_type === 'change'}<p class="text-muted-foreground text-sm">
								{t('admin.requests.change_hint')}
							</p>{/if}
					</Card.Content>
					<Card.Footer class="flex flex-wrap gap-2">
						{#if r.request_type === 'add'}
							<FormDialog
								action="?/resolveParticipant"
								title={t('admin.requests.approve_add')}
								submitLabel={t('admin.requests.approve_add')}
								wide
							>
								{#snippet trigger()}{t('admin.requests.approve_add')}{/snippet}
								<input type="hidden" name="id" value={r.id} />
								<input type="hidden" name="approve" value="true" />
								<div class="grid gap-4 sm:grid-cols-2">
									<div class="grid gap-2 sm:col-span-2">
										<Label for="pa-name-{r.id}">{t('common.name')}</Label>
										<Input id="pa-name-{r.id}" name="name" required value={r.name ?? ''} />
									</div>
									<div class="grid gap-2">
										<Label for="pa-code-{r.id}">{t('common.code')}</Label>
										<Input id="pa-code-{r.id}" name="code" required />
										<p class="text-muted-foreground text-xs">{t('admin.participants.code_help')}</p>
									</div>
									<div class="grid gap-2">
										<Label for="pa-kind-{r.id}">{t('admin.participants.kind')}</Label>
										<AppSelect
											id="pa-kind-{r.id}"
											name="kind"
											value="individual"
											options={[
												{ value: 'individual', label: t('admin.participants.kind_individual') },
												{ value: 'team', label: t('admin.participants.kind_team') }
											]}
										/>
									</div>
									<div class="grid gap-2">
										<Label for="pa-aff-{r.id}">{t('admin.participants.affiliation')}</Label>
										<Input id="pa-aff-{r.id}" name="affiliation" />
									</div>
									<div class="grid gap-2">
										<Label for="pa-mem-{r.id}">{t('admin.participants.members')}</Label>
										<Input id="pa-mem-{r.id}" name="members" />
									</div>
									<div class="grid gap-2 sm:col-span-2">
										<Label for="pa-note-{r.id}">{t('common.note_optional')}</Label>
										<Textarea id="pa-note-{r.id}" name="reason" />
									</div>
								</div>
							</FormDialog>
						{:else}
							<ConfirmForm
								action="?/resolveParticipant"
								label={r.request_type === 'remove'
									? t('admin.requests.approve_remove')
									: t('admin.requests.approve_change')}
								title={r.request_type === 'remove'
									? t('admin.requests.approve_remove')
									: t('admin.requests.approve_change')}
								optionalNote
								variant="default"
							>
								{#snippet fields()}<input type="hidden" name="id" value={r.id} /><input
										type="hidden"
										name="approve"
										value="true"
									/>{/snippet}
							</ConfirmForm>
						{/if}
						<ConfirmForm
							action="?/resolveParticipant"
							label={t('admin.requests.reject')}
							title={t('admin.requests.reject')}
							requireReason
							danger
						>
							{#snippet fields()}<input type="hidden" name="id" value={r.id} /><input
									type="hidden"
									name="approve"
									value="false"
								/>{/snippet}
						</ConfirmForm>
					</Card.Footer>
				</Card.Root>
			{:else}
				<p class="text-muted-foreground">{t('admin.requests.none')}</p>
			{/each}
			{#if data.participantRequests.some((r) => r.status !== 'pending')}
				<Card.Root class="py-0">
					<Table.Root>
						<Table.Body>
							{#each data.participantRequests.filter((r) => r.status !== 'pending') as r (r.id)}
								<Table.Row>
									<Table.Cell class="text-muted-foreground text-xs"
										>{formatDateTime(locale(), r.resolved_at ?? r.created_at)}</Table.Cell
									>
									<Table.Cell class="whitespace-normal">
										<strong>{t(`preq.type_${r.request_type}`)}</strong>{#if r.name}: {r.name}{:else if r.participants}:
											{r.participants.name}{/if}
										· {r.events?.name}<br /><span class="text-sm">{r.details}</span>
									</Table.Cell>
									<Table.Cell
										><Badge variant={r.status === 'approved' ? 'success' : 'neutral'}
											>{t(`request.${r.status}`)}</Badge
										></Table.Cell
									>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Root>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="reopen" class="mt-4 grid gap-4">
			{#each pendingReopen as r (r.id)}
				<Card.Root data-testid="reopen-request">
					<Card.Header>
						<Card.Title class="text-lg">{r.submissions?.profiles?.display_name}</Card.Title>
						<Card.Description
							>{r.submissions?.events?.groups?.name} – {r.submissions?.events?.name} · {formatDateTime(
								locale(),
								r.created_at
							)}</Card.Description
						>
					</Card.Header>
					<Card.Content
						><blockquote class="border-primary/40 border-l-4 pl-3 text-base">
							{r.reason}
						</blockquote></Card.Content
					>
					<Card.Footer class="flex flex-wrap gap-2">
						<ConfirmForm
							action="?/resolveReopen"
							label={t('admin.requests.approve')}
							title={t('admin.requests.approve')}
							optionalNote
							variant="default"
						>
							{#snippet fields()}<input type="hidden" name="id" value={r.id} /><input
									type="hidden"
									name="approve"
									value="true"
								/>{/snippet}
						</ConfirmForm>
						<ConfirmForm
							action="?/resolveReopen"
							label={t('admin.requests.reject')}
							title={t('admin.requests.reject')}
							requireReason
							danger
						>
							{#snippet fields()}<input type="hidden" name="id" value={r.id} /><input
									type="hidden"
									name="approve"
									value="false"
								/>{/snippet}
						</ConfirmForm>
						<Button href="/admin/submissions/{r.submission_id}" variant="ghost"
							><ExternalLink />{t('common.open')}</Button
						>
					</Card.Footer>
				</Card.Root>
			{:else}
				<p class="text-muted-foreground">{t('admin.requests.none')}</p>
			{/each}
		</Tabs.Content>

		<Tabs.Content value="corr" class="mt-4 grid gap-4">
			{#each openCorr as c (c.id)}
				<Card.Root>
					<Card.Header>
						<div class="flex flex-wrap items-start justify-between gap-2">
							<div>
								<Card.Title class="text-lg">{c.submissions?.profiles?.display_name}</Card.Title>
								<Card.Description>
									{c.submissions?.events?.groups?.name} – {c.submissions?.events
										?.name}{#if c.participants}
										· {c.participants.name} ({c.participants.code}){/if}
								</Card.Description>
							</div>
							<Badge variant={c.status === 'responded' ? 'info' : 'warning'}
								>{t(`request.${c.status}`)}</Badge
							>
						</div>
					</Card.Header>
					<Card.Content class="grid gap-2">
						<blockquote class="border-primary/40 border-l-4 pl-3">{c.message}</blockquote>
						{#if c.judge_response}<p>
								<strong>{t('admin.requests.judge_reply')}:</strong>
								{c.judge_response}
							</p>{/if}
					</Card.Content>
					<Card.Footer class="flex flex-wrap gap-2">
						<ConfirmForm
							action="?/resolveCorrection"
							label={t('admin.requests.resolve')}
							title={t('admin.requests.resolve')}
							optionalNote
							variant="default"
						>
							{#snippet fields()}<input type="hidden" name="id" value={c.id} /><input
									type="hidden"
									name="cancel"
									value="false"
								/>{/snippet}
						</ConfirmForm>
						<ConfirmForm
							action="?/resolveCorrection"
							label={t('admin.requests.cancel')}
							title={t('admin.requests.cancel')}
							optionalNote
						>
							{#snippet fields()}<input type="hidden" name="id" value={c.id} /><input
									type="hidden"
									name="cancel"
									value="true"
								/>{/snippet}
						</ConfirmForm>
						<Button href="/admin/submissions/{c.submission_id}" variant="ghost"
							><ExternalLink />{t('common.open')}</Button
						>
					</Card.Footer>
				</Card.Root>
			{:else}
				<p class="text-muted-foreground">{t('admin.requests.none')}</p>
			{/each}
		</Tabs.Content>

		<Tabs.Content value="history" class="mt-4">
			<Card.Root class="py-0">
				<Table.Root>
					<Table.Body>
						{#each closed as item, i (i)}
							<Table.Row>
								<Table.Cell class="text-muted-foreground text-xs"
									>{formatDateTime(locale(), item.at)}</Table.Cell
								>
								{#if item.kind === 'reopen'}
									<Table.Cell class="whitespace-normal"
										><strong>{item.r.submissions?.profiles?.display_name}</strong> · {item.r
											.submissions?.events?.name}<br /><span class="text-sm"
											>{t('request.reopen_title')}: “{item.r.reason}”</span
										></Table.Cell
									>
									<Table.Cell
										><Badge variant={item.r.status === 'approved' ? 'success' : 'neutral'}
											>{t(`request.${item.r.status}`)}</Badge
										></Table.Cell
									>
								{:else}
									<Table.Cell class="whitespace-normal"
										><strong>{item.c.submissions?.profiles?.display_name}</strong> · {item.c
											.submissions?.events?.name}<br /><span class="text-sm"
											>“{item.c.message}”</span
										></Table.Cell
									>
									<Table.Cell
										><Badge variant={item.c.status === 'resolved' ? 'success' : 'neutral'}
											>{t(`request.${item.c.status}`)}</Badge
										></Table.Cell
									>
								{/if}
							</Table.Row>
						{:else}
							<Table.Row
								><Table.Cell class="text-muted-foreground">{t('admin.requests.none')}</Table.Cell
								></Table.Row
							>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>

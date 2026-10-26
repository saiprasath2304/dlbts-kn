<script lang="ts">
	import { enhance } from '$app/forms';
	import { withProgress } from '#lib/progress.svelte.ts';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Medal from '@lucide/svelte/icons/medal';
	import Lock from '@lucide/svelte/icons/lock';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import ConfirmForm from '#lib/components/app/ConfirmForm.svelte';
	import StatusBadge from '#lib/components/app/StatusBadge.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { formatMark, ordinal, podium } from '#lib/scoring.ts';
	import type { SubmissionStatus } from '#lib/types.ts';

	let { data, form } = $props();
	const r = $derived(data.results);
	const byId = $derived(new Map((r.participants ?? []).map((p) => [p.participant_id, p])));
	const winners = $derived(podium(r.participants ?? []));
	const variant = $derived(
		r.status === 'finalized'
			? 'success'
			: r.status === 'ready_for_finalization'
				? 'info'
				: r.status === 'awaiting_tie_resolution'
					? 'warning'
					: 'neutral'
	);
	const medal = ['text-amber-500', 'text-slate-400', 'text-orange-700'];
</script>

<svelte:head><title>{data.event.name} – {t('admin.results.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<div>
		<Button href="/admin/results" variant="ghost" size="sm" class="-ml-2"
			><ArrowLeft />{t('admin.results.title')}</Button
		>
	</div>
	<PageHeader title={data.event.name} eyebrow={data.event.groups?.name}>
		{#snippet actions()}
			<Badge {variant} class="text-sm" data-testid="result-status"
				>{t(`result_status.${r.status}`)}</Badge
			>
			{#if r.status === 'ready_for_finalization'}
				<ConfirmForm
					action="?/finalize"
					label={t('admin.results.finalize')}
					title={t('admin.results.finalize')}
					message={t('admin.results.finalize_confirm', { event: data.event.name })}
					variant="default"
				/>
			{:else if r.status === 'finalized'}
				<ConfirmForm
					action="?/unfinalize"
					label={t('admin.results.unfinalize')}
					title={t('admin.results.unfinalize')}
					requireReason
					danger
					variant="ghost"
				/>
			{/if}
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />

	<Card.Root>
		<Card.Header
			><Card.Title
				>{t('report.judges_submitted')}: {t('common.of', {
					a: r.submitted_judges,
					b: r.required_judges
				})}</Card.Title
			></Card.Header
		>
		<Card.Content class="flex flex-wrap gap-3">
			{#each r.judges as j (j.judge_id)}
				<div class="flex items-center gap-2 rounded-lg border px-3 py-2">
					<span class="font-medium">{j.display_name}</span>
					{#if j.status}<StatusBadge status={j.status as SubmissionStatus} />{/if}
					{#if j.missing}<Badge variant="destructive"
							>{t('admin.submissions.missing', { n: j.missing })}</Badge
						>{/if}
				</div>
			{/each}
		</Card.Content>
	</Card.Root>

	{#if !r.complete && data.provisionalTies.length}
		<Alert.Root variant="warning">
			<TriangleAlert />
			<Alert.Title>{t('ties.admin_title')}</Alert.Title>
			<Alert.Description>
				{#each data.provisionalTies as tie (tie.place)}
					<p>{ordinal(tie.place, locale())}: {tie.participants.map((p) => p.name).join(', ')}</p>
				{/each}
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if !r.complete || !r.participants}
		<Alert.Root variant="info" data-testid="results-hidden"
			><EyeOff /><Alert.Title>{t('admin.results.hidden')}</Alert.Title></Alert.Root
		>
	{:else}
		{#if r.status !== 'finalized'}
			<Alert.Root variant="warning"
				><TriangleAlert /><Alert.Title>{t('admin.results.provisional')}</Alert.Title></Alert.Root
			>
		{:else if r.finalization}
			<Alert.Root variant="success"
				><Lock /><Alert.Title
					>{t('admin.results.finalized_at', {
						time: formatDateTime(locale(), r.finalization.finalized_at)
					})}</Alert.Title
				></Alert.Root
			>
		{/if}

		{#if winners.length}
			<div class="grid gap-3 sm:grid-cols-3">
				{#each winners as w (w.participant_id)}
					<Card.Root class="gap-2 py-4">
						<Card.Content class="flex items-center gap-3 px-4">
							<Medal
								class="size-9 shrink-0 {medal[(w.final_rank ?? 1) - 1] ?? 'text-muted-foreground'}"
							/>
							<div class="min-w-0">
								<div class="text-muted-foreground text-sm font-medium">
									{ordinal(w.final_rank!, locale())}
								</div>
								<div class="truncate font-bold">{w.name}</div>
								{#if data.teams[w.participant_id]?.members}<div
										class="text-muted-foreground truncate text-xs"
									>
										{data.teams[w.participant_id].members}
									</div>{/if}
								<div class="text-muted-foreground text-sm">
									{w.code} · {formatMark(w.aggregate)}
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		{/if}

		<Card.Root class="py-0">
			<Table.Root data-testid="results-table">
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-16">{t('admin.results.rank')}</Table.Head>
						<Table.Head>{t('common.participant')}</Table.Head>
						{#each r.judges as j (j.judge_id)}<Table.Head class="text-right whitespace-normal"
								>{j.display_name}</Table.Head
							>{/each}
						<Table.Head class="text-right">{t('admin.results.aggregate')}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each r.participants as p (p.participant_id)}
						<Table.Row>
							<Table.Cell>
								<span class="text-lg font-bold">{p.final_rank ?? '–'}</span>
								{#if p.tied}<Badge variant="warning" class="ml-1">{t('admin.results.tied')}</Badge
									>{/if}
							</Table.Cell>
							<Table.Cell class="whitespace-normal">
								<div class="font-semibold">
									{p.name}
									{#if data.teams[p.participant_id]?.kind === 'team'}<Badge
											variant="secondary"
											class="ml-1">{t('score.team')}</Badge
										>{/if}
								</div>
								{#if data.teams[p.participant_id]?.members}<div
										class="text-muted-foreground text-xs"
									>
										{data.teams[p.participant_id].members}
									</div>{/if}
								<div class="text-muted-foreground text-sm">
									<span class="font-mono">{p.code}</span>{#if p.affiliation}
										· {p.affiliation}{/if}
								</div>
							</Table.Cell>
							{#each r.judges as j (j.judge_id)}<Table.Cell class="text-right tabular-nums"
									>{formatMark(Number(p.judge_totals[j.judge_id] ?? 0))}</Table.Cell
								>{/each}
							<Table.Cell class="text-right text-lg font-bold tabular-nums"
								>{formatMark(p.aggregate)}</Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Root>

		{#if r.ties.length}
			<div class="grid gap-4">
				<h2 class="flex items-center gap-2 text-xl font-semibold">
					<Trophy class="text-primary" />{t('admin.results.ties')}
				</h2>
				{#each r.ties as tie (tie.participant_ids.join())}
					<Card.Root data-testid="tie-form">
						<Card.Header>
							<Card.Title class="flex items-center gap-2">
								{t('admin.results.tie_group', {
									aggregate: formatMark(tie.aggregate),
									from: tie.start_rank,
									to: tie.start_rank + tie.participant_ids.length - 1
								})}
								{#if tie.resolved}<Badge variant="success"><CircleCheck />✓</Badge>{/if}
							</Card.Title>
							{#if tie.resolved && tie.reason}<Card.Description
									>{t('admin.results.tie_resolved', { reason: tie.reason })}</Card.Description
								>{/if}
						</Card.Header>
						{#if r.status !== 'finalized'}
							<Card.Content>
								<form
									method="POST"
									action="?/resolveTie"
									use:enhance={withProgress()}
									class="grid gap-4"
								>
									<div class="grid gap-3 sm:grid-cols-2">
										{#each tie.participant_ids as pid (pid)}
											<div class="grid gap-2">
												<input type="hidden" name="pid" value={pid} />
												<Label for="rank-{pid}">{byId.get(pid)?.name} ({byId.get(pid)?.code})</Label
												>
												<Input
													id="rank-{pid}"
													name="rank_{pid}"
													type="number"
													min={tie.start_rank}
													max={tie.start_rank + tie.participant_ids.length - 1}
													required
													value={tie.ranks?.[pid] ?? ''}
													class="max-w-28"
												/>
											</div>
										{/each}
									</div>
									{#if data.corrections.length}
										<fieldset class="grid gap-2">
											<legend class="mb-1 text-sm font-medium"
												>{t('admin.requests.corrections')} ({t('common.optional')})</legend
											>
											{#each data.corrections as c (c.id)}
												<label class="flex items-center gap-2 text-sm"
													><input
														type="checkbox"
														name="correction_ids"
														value={c.id}
														class="accent-primary size-5"
													/>{c.message} ({t(`request.${c.status}`)})</label
												>
											{/each}
										</fieldset>
									{/if}
									<div class="grid gap-2">
										<Label for="tie-reason-{tie.start_rank}">{t('common.reason')}</Label>
										<Textarea
											id="tie-reason-{tie.start_rank}"
											name="reason"
											required
											minlength={3}
										/>
									</div>
									<div class="flex flex-wrap gap-2">
										<Button type="submit">{t('admin.results.resolve_tie')}</Button>
										<Button href="/admin/submissions?event={r.event_id}" variant="ghost"
											>{t('admin.results.request_review')}</Button
										>
									</div>
								</form>
							</Card.Content>
						{/if}
					</Card.Root>
				{/each}
			</div>
		{/if}
	{/if}
</div>

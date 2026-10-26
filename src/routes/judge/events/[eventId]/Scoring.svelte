<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { withProgress } from '#lib/progress.svelte.ts';
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Clock from '@lucide/svelte/icons/clock';
	import History from '@lucide/svelte/icons/history';
	import Info from '@lucide/svelte/icons/info';
	import Lock from '@lucide/svelte/icons/lock';
	import Search from '@lucide/svelte/icons/search';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Collapsible from '#lib/components/ui/collapsible/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { cn } from '#lib/utils.js';
	import StatusBadge from '#lib/components/app/StatusBadge.svelte';
	import SaveIndicator from '#lib/components/app/SaveIndicator.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { formatMark, parseMark, participantTotal, type MarkError } from '#lib/scoring.ts';
	import { isEditable, isSubmitted } from '#lib/status.ts';
	import { ScoreSync, type Conflict } from '#lib/offline/score-sync.svelte.ts';
	import type { SubmissionStatus } from '#lib/types.ts';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// The parent page re-creates this component per event ({#key}), so the event,
	// submission and autosave controller are fixed for the component's lifetime.
	const initial = untrack(() => ({
		precision: data.event.score_precision,
		userId: data.profile!.id,
		submissionId: data.submission.id,
		delayMs: data.autosaveDelay,
		scores: data.scores,
		lastSavedAt: data.submission.last_saved_at
	}));
	const precision = initial.precision;
	const sync = new ScoreSync(
		{ userId: initial.userId, submissionId: initial.submissionId, delayMs: initial.delayMs },
		initial.scores,
		initial.lastSavedAt
	);

	const key = (p: string, c: string) => `${p}|${c}`;
	let inputs = $state<Record<string, string>>(
		Object.fromEntries(
			initial.scores.map((s) => [
				key(s.participant_id, s.criterion_id),
				formatMark(s.value, precision)
			])
		)
	);
	let errors = $state<Record<string, MarkError | null>>({});
	let query = $state('');
	let busy = $state(false);

	// A first autosave moves not_started -> in_progress; otherwise trust the server.
	const status = $derived(
		(data.submission.status === 'not_started' && sync.submissionStatus
			? sync.submissionStatus
			: data.submission.status) as SubmissionStatus
	);
	const editable = $derived(isEditable(status));
	const criteriaMax = $derived(data.criteria.reduce((s, c) => s + c.max_marks, 0));

	function marksFor(participantId: string) {
		const out: Record<string, number | null> = {};
		for (const c of data.criteria) {
			const r = parseMark(inputs[key(participantId, c.id)] ?? '', c.max_marks, precision);
			out[c.id] = r.ok ? r.value : null;
		}
		return out;
	}
	const totals = $derived(
		Object.fromEntries(
			data.participants.map((p) => [p.id, participantTotal(data.criteria, marksFor(p.id))])
		)
	);
	const completeCount = $derived(Object.values(totals).filter((x) => x.complete).length);
	const visible = $derived(
		query.trim()
			? data.participants.filter((p) =>
					`${p.name} ${p.code}`.toLowerCase().includes(query.trim().toLowerCase())
				)
			: data.participants
	);

	onMount(() => {
		let alive = true;
		sync.init().then((overlay) => {
			if (!alive) return;
			for (const [k, v] of overlay) inputs[k] = formatMark(v, precision);
		});
		const warn = (e: BeforeUnloadEvent) => {
			if (sync.pending > 0) e.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => {
			alive = false;
			window.removeEventListener('beforeunload', warn);
			void sync.flush();
			sync.destroy();
		};
	});

	beforeNavigate(() => {
		void sync.flush();
	});

	function onInput(participantId: string, criterionId: string, max: number, text: string) {
		const k = key(participantId, criterionId);
		inputs[k] = text;
		const r = parseMark(text, max, precision);
		if (!r.ok) {
			errors[k] = r.error;
			return;
		}
		errors[k] = null;
		void sync.setMark(participantId, criterionId, r.value);
	}

	function onBlur(participantId: string, criterionId: string, max: number) {
		const k = key(participantId, criterionId);
		const r = parseMark(inputs[k] ?? '', max, precision);
		if (r.ok) inputs[k] = formatMark(r.value, precision);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const all = [...document.querySelectorAll<HTMLInputElement>('input[data-score]')];
		const i = all.indexOf(e.currentTarget as HTMLInputElement);
		all[i + 1]?.focus();
	}

	function errorText(code: MarkError, max: number) {
		if (code === 'ABOVE_MAX') return t('score.err.ABOVE_MAX', { max });
		if (code === 'TOO_MANY_DECIMALS')
			return precision === 0
				? t('score.err.TOO_MANY_DECIMALS_0')
				: t('score.err.TOO_MANY_DECIMALS', { precision });
		return t(`score.err.${code}`);
	}

	async function resolve(c: Conflict, keep: 'mine' | 'server') {
		const v = await sync.resolve(c, keep);
		inputs[key(c.participant_id, c.criterion_id)] = formatMark(v, precision);
		errors[key(c.participant_id, c.criterion_id)] = null;
	}

	const nameOf = (id: string) => data.participants.find((p) => p.id === id)?.name ?? id;
	const criterionName = (id: string) => data.criteria.find((c) => c.id === id)?.name ?? id;
	const shown = (v: number | null) => (v === null ? t('save.empty') : formatMark(v, precision));
	const openCorrections = $derived(
		data.corrections.filter((c) => c.status === 'open' || c.status === 'responded')
	);
	const pendingReopen = $derived(data.reopenings.find((r) => r.status === 'pending'));
	const lastDecision = $derived(
		data.reopenings.find((r) => r.status === 'rejected' || r.status === 'approved')
	);
</script>

<svelte:head><title>{data.event.name} – {t('score.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-5 pb-4">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<p class="text-muted-foreground text-sm font-medium">{data.group.name}</p>
			<h1 class="text-2xl font-bold tracking-tight">{data.event.name}</h1>
		</div>
		<StatusBadge {status} />
	</div>

	<FormFeedback {form} />

	{#if sync.recovered > 0}
		<Alert.Root variant="info" role="status"
			><History /><Alert.Title>{t('save.recovered', { n: sync.recovered })}</Alert.Title
			></Alert.Root
		>
	{/if}

	{#each sync.conflicts as c (c.key)}
		<Alert.Root variant="warning" role="alert">
			<TriangleAlert />
			<Alert.Title>{t('save.conflict_title')}</Alert.Title>
			<Alert.Description>
				<p>
					{t('save.conflict_body', {
						participant: nameOf(c.participant_id),
						criterion: criterionName(c.criterion_id),
						mine: shown(c.mine),
						theirs: shown(c.theirs),
						time: formatDateTime(locale(), c.theirs_at)
					})}
				</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<Button onclick={() => resolve(c, 'mine')}
						>{t('save.keep_mine', { value: shown(c.mine) })}</Button
					>
					<Button variant="outline" onclick={() => resolve(c, 'server')}
						>{t('save.keep_server', { value: shown(c.theirs) })}</Button
					>
				</div>
			</Alert.Description>
		</Alert.Root>
	{/each}

	{#each openCorrections as c (c.id)}
		<Alert.Root variant="warning">
			<BellRing />
			<Alert.Title>{t('judge.action_required')}</Alert.Title>
			<Alert.Description class="w-full">
				<p>{t('request.correction_from_admin', { message: c.message })}</p>
				{#if c.participant_id || c.criterion_ids.length}
					<p class="text-sm">
						{t('request.correction_scope', {
							participant: c.participant_id ? nameOf(c.participant_id) : t('common.all'),
							criteria: c.criterion_ids.length
								? c.criterion_ids.map(criterionName).join(', ')
								: t('common.all')
						})}
					</p>
				{/if}
				{#if c.judge_response}
					<p class="text-sm">
						<strong>{t('admin.requests.judge_reply')}:</strong>
						{c.judge_response}
					</p>
				{/if}
				<form
					method="POST"
					action="?/respondCorrection"
					use:enhance={withProgress()}
					class="mt-2 grid w-full gap-2"
				>
					<input type="hidden" name="request_id" value={c.id} />
					<Label for="resp-{c.id}">{t('request.respond')}</Label>
					<Textarea
						id="resp-{c.id}"
						name="response"
						required
						placeholder={t('request.respond_placeholder')}
						class="bg-background"
					/>
					<div><Button type="submit" variant="outline">{t('request.respond')}</Button></div>
				</form>
			</Alert.Description>
		</Alert.Root>
	{/each}

	<Collapsible.Root open={status === 'not_started'}>
		<Card.Root class="gap-0 py-0">
			<Collapsible.Trigger
				class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-semibold"
			>
				<span class="inline-flex items-center gap-2"
					><Info class="text-primary size-5" />{t('judge.about_event')}</span
				>
				<span class="text-muted-foreground text-sm font-normal"
					>{t('judge.total_max', { max: formatMark(criteriaMax) })}</span
				>
			</Collapsible.Trigger>
			<Collapsible.Content>
				<div class="grid gap-3 border-t px-5 py-4">
					{#if data.event.description}<p class="text-muted-foreground">
							{data.event.description}
						</p>{/if}
					{#if data.event.instructions}<p class="whitespace-pre-wrap">
							{data.event.instructions}
						</p>{/if}
					<ul class="divide-y rounded-lg border">
						{#each data.criteria as c (c.id)}
							<li class="flex items-center justify-between gap-3 px-3 py-2">
								<span
									>{c.name}{#if c.description}<span class="text-muted-foreground text-sm"
											>&nbsp;– {c.description}</span
										>{/if}</span
								>
								<Badge variant="secondary" class="text-sm">{formatMark(c.max_marks)}</Badge>
							</li>
						{/each}
					</ul>
				</div>
			</Collapsible.Content>
		</Card.Root>
	</Collapsible.Root>

	{#if !editable}
		<Card.Root data-testid="locked-notice" class="border-primary/30">
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-lg"
					><Lock class="text-primary size-5" />{t('score.locked')}</Card.Title
				>
				{#if data.submission.submitted_at && isSubmitted(status)}
					<Card.Description class="text-base">
						{t('submit.success_body', {
							event: data.event.name,
							time: formatDateTime(locale(), data.submission.submitted_at)
						})}
					</Card.Description>
				{/if}
			</Card.Header>
			<Card.Content class="grid gap-4">
				{#if lastDecision?.status === 'rejected' && !pendingReopen}
					<Alert.Root variant="warning" data-testid="reopen-rejected">
						<Alert.Title>{t('request.reopen_title')}: {t('request.rejected')}</Alert.Title>
						{#if lastDecision.resolution_note}<Alert.Description
								>{lastDecision.resolution_note}</Alert.Description
							>{/if}
					</Alert.Root>
				{/if}
				{#if pendingReopen}
					<Alert.Root variant="info">
						<Clock />
						<Alert.Title>{t('request.pending')}</Alert.Title>
						<Alert.Description>{pendingReopen.reason}</Alert.Description>
					</Alert.Root>
				{:else if isSubmitted(status)}
					<form
						method="POST"
						action="?/requestReopen"
						class="grid gap-3"
						use:enhance={() => {
							busy = true;
							return async ({ update }) => {
								busy = false;
								await update();
								await invalidateAll();
							};
						}}
					>
						<div>
							<h2 class="font-semibold">{t('request.reopen_title')}</h2>
							<p class="text-muted-foreground text-sm">{t('request.reopen_help')}</p>
						</div>
						<Label for="reopen-reason">{t('common.reason')}</Label>
						<Textarea id="reopen-reason" name="reason" required minlength={3} />
						<div>
							<Button type="submit" variant="outline" disabled={busy}
								>{t('request.reopen_button')}</Button
							>
						</div>
					</form>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if data.criteria.length === 0}
		<Alert.Root variant="info"><Alert.Title>{t('score.no_criteria')}</Alert.Title></Alert.Root>
	{:else if data.participants.length === 0}
		<Alert.Root variant="info"><Alert.Title>{t('score.no_participants')}</Alert.Title></Alert.Root>
	{:else}
		{#if editable}
			<div class="bg-background/95 sticky top-14 z-20 -mx-1 px-1 py-1 backdrop-blur">
				<SaveIndicator
					state={sync.state}
					lastSavedAt={sync.lastSavedAt}
					pending={sync.pending}
					onretry={() => sync.flush()}
				/>
			</div>
		{/if}

		{#if data.participants.length > 6}
			<div class="relative">
				<Search class="text-muted-foreground pointer-events-none absolute top-3 left-3 size-5" />
				<Label for="find" class="sr-only">{t('score.search')}</Label>
				<Input
					id="find"
					type="search"
					bind:value={query}
					autocomplete="off"
					placeholder={t('score.search')}
					class="pl-10"
				/>
			</div>
		{/if}

		<ol class="grid gap-4" role="list">
			{#each visible as p, idx (p.id)}
				{@const total = totals[p.id]}
				<li>
					<Card.Root
						data-testid="participant-card"
						class={cn('gap-4 border-2 transition-colors', total.complete && 'border-success/50')}
					>
						<Card.Header class="flex flex-row items-start justify-between gap-3">
							<div class="flex min-w-0 items-start gap-3">
								<span
									class="bg-secondary text-secondary-foreground grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold"
									>{idx + 1}</span
								>
								<div class="min-w-0">
									<h2 class="text-xl leading-tight font-bold">{p.name}</h2>
									<p class="text-muted-foreground text-sm">
										{t('score.participant_code', {
											code: p.code
										})}{#if p.affiliation}{` · ${p.affiliation}`}{/if}
									</p>
								</div>
							</div>
							<div
								class="shrink-0 text-right"
								data-testid="participant-total"
								aria-label="{t('score.total')} {total.total} / {total.max}"
							>
								<div class="text-muted-foreground text-xs font-medium uppercase">
									{t('score.total')}
								</div>
								<div class="text-2xl font-bold tabular-nums">
									{formatMark(total.total)}<span
										class="text-muted-foreground text-base font-semibold"
										>&nbsp;/&nbsp;{formatMark(total.max)}</span
									>
								</div>
							</div>
						</Card.Header>
						<Card.Content class="grid grid-cols-2 gap-x-3 gap-y-4">
							{#each data.criteria as c (c.id)}
								{@const k = key(p.id, c.id)}
								{@const err = errors[k]}
								<div class="grid gap-1.5">
									<Label for="m-{k}" class="text-base">{c.name}</Label>
									<div class="flex items-center gap-2">
										<Input
											id="m-{k}"
											data-score
											type="text"
											inputmode={precision === 0 ? 'numeric' : 'decimal'}
											enterkeyhint="next"
											autocomplete="off"
											aria-label={t('score.input_label', {
												criterion: c.name,
												participant: p.name,
												max: formatMark(c.max_marks)
											})}
											aria-invalid={err ? 'true' : undefined}
											aria-describedby={err ? `e-${k}` : undefined}
											value={inputs[k] ?? ''}
											readonly={!editable}
											oninput={(e) => onInput(p.id, c.id, c.max_marks, e.currentTarget.value)}
											onblur={() => onBlur(p.id, c.id, c.max_marks)}
											onkeydown={onKeydown}
											class="h-14 w-full max-w-28 text-center text-2xl font-bold tabular-nums read-only:bg-muted read-only:border-dashed"
										/>
										<span
											class="text-muted-foreground text-lg font-semibold whitespace-nowrap"
											aria-hidden="true">/ {formatMark(c.max_marks)}</span
										>
									</div>
									{#if err}
										<p class="text-destructive text-sm font-semibold" id="e-{k}" role="alert">
											{errorText(err, c.max_marks)}
										</p>
									{/if}
								</div>
							{/each}
						</Card.Content>
						<Card.Footer>
							{#if total.complete}
								<Badge variant="success" class="text-sm"><CircleCheck />{t('score.complete')}</Badge
								>
							{:else}
								<span class="text-muted-foreground text-sm"
									>{t('score.incomplete', { n: total.required - total.filled })}</span
								>
							{/if}
						</Card.Footer>
					</Card.Root>
				</li>
			{/each}
		</ol>

		<div class="bg-background/95 sticky bottom-0 z-20 -mx-4 border-t px-4 py-3 backdrop-blur">
			<div class="flex items-center justify-between gap-4">
				<div class="min-w-0 flex-1">
					<p class="text-sm font-medium">
						{t('judge.progress', { done: completeCount, total: data.participants.length })}
					</p>
					<Progress
						value={completeCount}
						max={Math.max(1, data.participants.length)}
						class="mt-1.5 h-2.5"
					/>
				</div>
				{#if editable}
					<Button href="/judge/events/{data.event.id}/review" size="lg" data-testid="review-link"
						>{t('score.review_submit')}<ArrowRight /></Button
					>
				{/if}
			</div>
		</div>
	{/if}
</div>

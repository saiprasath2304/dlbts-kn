<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { withProgress } from '#lib/progress.svelte.ts';
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Clock from '@lucide/svelte/icons/clock';
	import Gift from '@lucide/svelte/icons/gift';
	import History from '@lucide/svelte/icons/history';
	import Info from '@lucide/svelte/icons/info';
	import Lock from '@lucide/svelte/icons/lock';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Scale from '@lucide/svelte/icons/scale';
	import Search from '@lucide/svelte/icons/search';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Users from '@lucide/svelte/icons/users';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Collapsible from '#lib/components/ui/collapsible/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
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
	import FormDialog from '#lib/components/app/FormDialog.svelte';
	import AppSelect from '#lib/components/app/AppSelect.svelte';
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
		eventId: data.event.id,
		delayMs: data.autosaveDelay,
		scores: data.scores,
		lastSavedAt: data.submission.last_saved_at,
		remarks: data.remarks,
		memento: Object.fromEntries(Object.entries(data.context).map(([id, c]) => [id, c.memento]))
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
	let filter = $state<'all' | 'pending' | 'done'>('all');
	let busy = $state(false);
	/** Cards the judge opened for editing (evaluated cards are collapsed otherwise). */
	let editing = $state<Record<string, boolean>>({});

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
		data.participants.filter((p) => {
			const q = query.trim().toLowerCase();
			if (q && !`${p.name} ${p.code} ${p.members ?? ''}`.toLowerCase().includes(q)) return false;
			if (filter === 'pending') return !totals[p.id].complete;
			if (filter === 'done') return totals[p.id].complete;
			return true;
		})
	);

	// ---------------------------------------------------------------- remarks
	const REMARK_KEY = (pid: string) => `remark|${initial.submissionId}|${pid}`;
	let remarks = $state<Record<string, string>>({ ...initial.remarks });
	let remarkState = $state<Record<string, 'saving' | 'saved' | 'error'>>({});
	const remarkTimers: Record<string, ReturnType<typeof setTimeout>> = {};
	const dirty: Record<string, boolean> = {};

	function storeLocal(pid: string, text: string | null) {
		try {
			if (text === null) localStorage.removeItem(REMARK_KEY(pid));
			else localStorage.setItem(REMARK_KEY(pid), text);
		} catch {
			/* storage unavailable */
		}
	}

	async function saveRemark(pid: string) {
		clearTimeout(remarkTimers[pid]);
		const text = remarks[pid] ?? '';
		remarkState[pid] = 'saving';
		try {
			const res = await fetch('/api/judge/remark', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					submission_id: initial.submissionId,
					participant_id: pid,
					remark: text
				})
			});
			if (!res.ok) throw new Error(String(res.status));
			if ((remarks[pid] ?? '') === text) {
				dirty[pid] = false;
				remarkState[pid] = 'saved';
				storeLocal(pid, null);
			}
		} catch {
			remarkState[pid] = 'error';
			remarkTimers[pid] = setTimeout(() => saveRemark(pid), 5000);
		}
	}

	function onRemark(pid: string, text: string) {
		remarks[pid] = text;
		dirty[pid] = true;
		storeLocal(pid, text);
		clearTimeout(remarkTimers[pid]);
		remarkTimers[pid] = setTimeout(() => saveRemark(pid), 1200);
	}

	// ---------------------------------------------------------------- memento
	let memento = $state(initial.memento);
	let mementoBusy = $state<Record<string, boolean>>({});

	async function toggleMemento(pid: string, given: boolean) {
		mementoBusy[pid] = true;
		try {
			const res = await fetch('/api/judge/memento', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ participant_id: pid, given })
			});
			if (res.ok) memento[pid] = await res.json();
		} finally {
			mementoBusy[pid] = false;
		}
	}

	// ---------------------------------------------------------------- tie alerts
	type Tie = {
		place: number;
		participants: { participant_id: string; name: string; code: string }[];
	};
	let ties = $state<Tie[]>([]);
	async function loadTies() {
		try {
			const res = await fetch(`/api/judge/ties?event=${initial.eventId}`);
			if (res.ok) ties = await res.json();
		} catch {
			/* offline: keep the last known alerts */
		}
	}
	let tieTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		void sync.lastSavedAt;
		clearTimeout(tieTimer);
		tieTimer = setTimeout(loadTies, 1500);
	});

	onMount(() => {
		let alive = true;
		sync.init().then((overlay) => {
			if (!alive) return;
			for (const [k, v] of overlay) inputs[k] = formatMark(v, precision);
		});
		// Restore remarks typed on this device that never reached the server.
		for (const p of data.participants) {
			try {
				const local = localStorage.getItem(REMARK_KEY(p.id));
				if (local !== null && local !== (remarks[p.id] ?? '') && editable) {
					remarks[p.id] = local;
					void saveRemark(p.id);
				}
			} catch {
				/* storage unavailable */
			}
		}
		const poll = setInterval(loadTies, 45_000);
		const warn = (e: BeforeUnloadEvent) => {
			if (sync.pending > 0 || Object.values(remarkState).includes('saving')) e.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => {
			alive = false;
			clearInterval(poll);
			clearTimeout(tieTimer);
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
		editing[participantId] = true;
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

	function goTo(pid: string) {
		filter = 'all';
		query = '';
		editing[pid] = true;
		requestAnimationFrame(() =>
			document.getElementById(`p-${pid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		);
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

	let reqType = $state('add');
	const reqTone = (s: string) =>
		s === 'approved' ? 'success' : s === 'rejected' ? 'neutral' : 'warning';
</script>

<svelte:head><title>{data.event.name} – {t('score.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-5 pb-4">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<p class="text-muted-foreground text-sm font-medium">{data.group.name}</p>
			<h1 class="text-2xl font-bold tracking-tight">{data.event.name}</h1>
			{#if data.event.venue}
				<p class="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-sm">
					<MapPin class="size-4" />{t('score.room')}:
					<span class="text-foreground font-medium">{data.event.venue}</span>
				</p>
			{/if}
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

	{#each ties as tie (tie.place + tie.participants.map((p) => p.participant_id).join())}
		<Alert.Root variant="warning" role="status" data-testid="tie-alert">
			<Scale />
			<Alert.Title>{t('ties.title')}</Alert.Title>
			<Alert.Description>
				<p>
					{t('ties.body', {
						place: tie.place,
						names: tie.participants.map((p) => p.name).join(', ')
					})}
				</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each tie.participants as p (p.participant_id)}
						<Button size="sm" variant="outline" onclick={() => goTo(p.participant_id)}
							>{p.name}</Button
						>
					{/each}
				</div>
			</Alert.Description>
		</Alert.Root>
	{/each}

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

		<div class="grid gap-3">
			<Tabs.Root bind:value={filter}>
				<Tabs.List class="grid h-auto w-full grid-cols-3">
					<Tabs.Trigger value="all" class="py-2"
						>{t('score.filter_all')} · {data.participants.length}</Tabs.Trigger
					>
					<Tabs.Trigger value="pending" class="py-2"
						>{t('score.filter_pending')} · {data.participants.length - completeCount}</Tabs.Trigger
					>
					<Tabs.Trigger value="done" class="py-2"
						>{t('score.filter_done')} · {completeCount}</Tabs.Trigger
					>
				</Tabs.List>
			</Tabs.Root>
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
						class="h-11 pl-10"
					/>
				</div>
			{/if}
		</div>

		<ol class="grid gap-4" role="list">
			{#each visible as p (p.id)}
				{@const total = totals[p.id]}
				{@const ctx = data.context[p.id]}
				{@const m = memento[p.id]}
				{@const collapsed = total.complete && !editing[p.id]}
				{@const number = data.participants.indexOf(p) + 1}
				<li id="p-{p.id}" class="scroll-mt-32">
					<Card.Root
						data-testid="participant-card"
						data-evaluated={total.complete || undefined}
						class={cn(
							'gap-4 border-2 transition-colors',
							total.complete && 'border-success/40 bg-success/[0.03]'
						)}
					>
						<Card.Header class="flex flex-row items-start justify-between gap-3">
							<div class="flex min-w-0 items-start gap-3">
								<span
									class={cn(
										'grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold',
										total.complete
											? 'bg-success text-success-foreground'
											: 'bg-secondary text-secondary-foreground'
									)}
								>
									{#if total.complete}<CircleCheck class="size-5" />{:else}{number}{/if}
								</span>
								<div class="min-w-0">
									<h2 class="text-xl leading-tight font-bold">{p.name}</h2>
									<p class="text-muted-foreground text-sm">
										{t('score.participant_code', {
											code: p.code
										})}{#if p.affiliation}{` · ${p.affiliation}`}{/if}
									</p>
									{#if p.kind === 'team'}
										<p class="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
											<Badge variant="secondary"><Users />{t('score.team')}</Badge>
											{#if p.members}<span class="text-muted-foreground">{p.members}</span>{/if}
										</p>
									{/if}
								</div>
							</div>
							<div
								class="shrink-0 text-right"
								data-testid="participant-total"
								aria-label="{t('score.total')} {total.total} / {total.max}"
							>
								<div class="text-2xl font-bold tabular-nums">
									{formatMark(total.total)}<span
										class="text-muted-foreground text-base font-semibold"
										>&nbsp;/&nbsp;{formatMark(total.max)}</span
									>
								</div>
								{#if total.complete}
									<Badge variant="success" class="mt-1"><CircleCheck />{t('score.evaluated')}</Badge
									>
								{:else}
									<span class="text-muted-foreground text-xs"
										>{t('score.incomplete', { n: total.required - total.filled })}</span
									>
								{/if}
							</div>
						</Card.Header>

						<Card.Content class="grid gap-2 text-sm">
							{#if ctx?.other_events.length}
								<div class="bg-muted/60 rounded-lg px-3 py-2">
									<span class="text-muted-foreground font-medium">{t('score.also_in')}:</span>
									<ul class="mt-1 grid gap-0.5">
										{#each ctx.other_events as e (e.event_id)}
											<li class="flex flex-wrap items-center gap-x-2">
												<span class="font-medium">{e.name}</span>
												<span class="text-muted-foreground text-xs">{e.group}</span>
												{#if e.venue}<span
														class="text-muted-foreground inline-flex items-center gap-1 text-xs"
														><MapPin class="size-3" />{e.venue}</span
													>{/if}
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							<div class="flex flex-wrap items-center gap-2">
								{#if m?.given}
									<Badge variant="success" class="text-sm"><Gift />{t('memento.given')}</Badge>
									<span class="text-muted-foreground text-xs">
										{t('memento.given_by', {
											name: m.by ?? '',
											time: formatDateTime(locale(), m.at)
										})}
									</span>
									<Button
										size="sm"
										variant="ghost"
										disabled={mementoBusy[p.id]}
										onclick={() => toggleMemento(p.id, false)}>{t('memento.undo')}</Button
									>
								{:else}
									<Button
										size="sm"
										variant="outline"
										disabled={mementoBusy[p.id]}
										onclick={() => toggleMemento(p.id, true)}
									>
										<Gift />{t('memento.mark_given')}
									</Button>
								{/if}
							</div>
						</Card.Content>

						{#if collapsed}
							<Card.Content>
								<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
									{#each data.criteria as c (c.id)}
										<span
											><span class="text-muted-foreground">{c.name}</span>
											<strong class="tabular-nums">{inputs[key(p.id, c.id)]}</strong></span
										>
									{/each}
								</div>
							</Card.Content>
						{:else}
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
						{/if}

						<Card.Content class="grid gap-1.5">
							<div class="flex items-center justify-between gap-2">
								<Label for="r-{p.id}" class="text-sm">{t('score.remarks')}</Label>
								<span class="text-muted-foreground text-xs" aria-live="polite">
									{#if remarkState[p.id] === 'saving'}{t(
											'score.remarks_saving'
										)}{:else if remarkState[p.id] === 'saved'}{t(
											'score.remarks_saved'
										)}{:else if remarkState[p.id] === 'error'}<span class="text-destructive"
											>{t('score.remarks_failed')}</span
										>{/if}
								</span>
							</div>
							{#if editable}
								<Textarea
									id="r-{p.id}"
									rows={2}
									maxlength={2000}
									value={remarks[p.id] ?? ''}
									oninput={(e) => onRemark(p.id, e.currentTarget.value)}
									onblur={() => dirty[p.id] && saveRemark(p.id)}
									placeholder={t('score.remarks_placeholder')}
									class="min-h-16 text-base"
								/>
							{:else}
								<p id="r-{p.id}" class="text-muted-foreground text-sm whitespace-pre-wrap">
									{remarks[p.id] || '–'}
								</p>
							{/if}
						</Card.Content>

						{#if editable && total.complete}
							<Card.Footer class="justify-end">
								{#if collapsed}
									<Button variant="outline" size="sm" onclick={() => (editing[p.id] = true)}
										><Pencil />{t('score.edit_marks')}</Button
									>
								{:else}
									<Button variant="secondary" size="sm" onclick={() => (editing[p.id] = false)}
										><CircleCheck />{t('score.done_editing')}</Button
									>
								{/if}
							</Card.Footer>
						{/if}
					</Card.Root>
				</li>
			{/each}
		</ol>

		<Card.Root class="gap-3">
			<Card.Header class="flex flex-row flex-wrap items-center justify-between gap-3">
				<div>
					<Card.Title class="text-base">{t('preq.mine')}</Card.Title>
					<Card.Description>{t('preq.help')}</Card.Description>
				</div>
				<FormDialog
					action="?/requestParticipant"
					title={t('preq.title')}
					description={t('preq.help')}
					submitLabel={t('request.reopen_button')}
					variant="outline"
					size="sm"
				>
					{#snippet trigger()}<UserPlus />{t('preq.button')}{/snippet}
					<div class="grid gap-4">
						<div class="grid gap-2">
							<Label for="preq-type">{t('preq.type')}</Label>
							<AppSelect
								id="preq-type"
								name="request_type"
								bind:value={reqType}
								options={[
									{ value: 'add', label: t('preq.type_add') },
									{ value: 'change', label: t('preq.type_change') },
									{ value: 'remove', label: t('preq.type_remove') }
								]}
							/>
						</div>
						{#if reqType === 'add'}
							<div class="grid gap-2">
								<Label for="preq-name">{t('preq.name')}</Label>
								<Input id="preq-name" name="name" required />
							</div>
						{:else}
							<div class="grid gap-2">
								<Label for="preq-p">{t('preq.participant')}</Label>
								<AppSelect
									id="preq-p"
									name="participant_id"
									value={data.participants[0]?.id ?? ''}
									options={data.participants.map((p) => ({
										value: p.id,
										label: `${p.code} – ${p.name}`
									}))}
								/>
							</div>
						{/if}
						<div class="grid gap-2">
							<Label for="preq-details">{t('preq.details')}</Label>
							<Textarea
								id="preq-details"
								name="details"
								required
								minlength={3}
								placeholder={t('preq.details_help')}
							/>
						</div>
					</div>
				</FormDialog>
			</Card.Header>
			{#if data.participantRequests.length}
				<Card.Content class="grid gap-2">
					{#each data.participantRequests as r (r.id)}
						<div
							class="flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
						>
							<div class="min-w-0">
								<div class="font-medium">
									{t(`preq.type_${r.request_type}`)}{#if r.name}: {r.name}{:else if r.participant_id}:
										{nameOf(r.participant_id)}{/if}
								</div>
								<div class="text-muted-foreground">{r.details}</div>
								{#if r.resolution_note}<div class="text-muted-foreground text-xs">
										{r.resolution_note}
									</div>{/if}
							</div>
							<Badge variant={reqTone(r.status)}>{t(`request.${r.status}`)}</Badge>
						</div>
					{/each}
				</Card.Content>
			{/if}
		</Card.Root>

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

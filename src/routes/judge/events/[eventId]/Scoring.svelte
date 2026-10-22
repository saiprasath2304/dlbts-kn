<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { beforeNavigate, invalidateAll } from '$app/navigation';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import SaveIndicator from '#lib/components/SaveIndicator.svelte';
	import Flash from '#lib/components/Flash.svelte';
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

<div class="stack">
	<div class="row between">
		<div>
			<div class="muted">{data.group.name}</div>
			<h1 style="margin: 0">{data.event.name}</h1>
		</div>
		<StatusBadge {status} />
	</div>

	<Flash {form} />

	{#if sync.recovered > 0}
		<div class="alert info" role="status">{t('save.recovered', { n: sync.recovered })}</div>
	{/if}

	{#each sync.conflicts as c (c.key)}
		<div class="alert warning stack" role="alert">
			<strong>{t('save.conflict_title')}</strong>
			<p>
				{t('save.conflict_body', {
					participant: nameOf(c.participant_id),
					criterion: criterionName(c.criterion_id),
					mine: shown(c.mine),
					theirs: shown(c.theirs),
					time: formatDateTime(locale(), c.theirs_at)
				})}
			</p>
			<div class="row">
				<button class="btn" type="button" onclick={() => resolve(c, 'mine')}
					>{t('save.keep_mine', { value: shown(c.mine) })}</button
				>
				<button class="btn secondary" type="button" onclick={() => resolve(c, 'server')}
					>{t('save.keep_server', { value: shown(c.theirs) })}</button
				>
			</div>
		</div>
	{/each}

	{#each openCorrections as c (c.id)}
		<div class="alert warning stack">
			<strong>{t('judge.action_required')}</strong>
			<p>{t('request.correction_from_admin', { message: c.message })}</p>
			{#if c.participant_id || c.criterion_ids.length}
				<p class="small">
					{t('request.correction_scope', {
						participant: c.participant_id ? nameOf(c.participant_id) : t('common.all'),
						criteria: c.criterion_ids.length
							? c.criterion_ids.map(criterionName).join(', ')
							: t('common.all')
					})}
				</p>
			{/if}
			{#if c.judge_response}
				<p class="small"><strong>{t('admin.requests.judge_reply')}:</strong> {c.judge_response}</p>
			{/if}
			<form method="POST" action="?/respondCorrection" use:enhance class="stack">
				<input type="hidden" name="request_id" value={c.id} />
				<label for="resp-{c.id}">{t('request.respond')}</label>
				<textarea
					id="resp-{c.id}"
					name="response"
					required
					placeholder={t('request.respond_placeholder')}></textarea>
				<button class="btn secondary" type="submit">{t('request.respond')}</button>
			</form>
		</div>
	{/each}

	<details class="card about" open={status === 'not_started'}>
		<summary><strong>{t('judge.about_event')}</strong></summary>
		{#if data.event.description}<p class="muted">{data.event.description}</p>{/if}
		{#if data.event.instructions}<p class="pre">{data.event.instructions}</p>{/if}
		<p class="small muted">{t('judge.total_max', { max: formatMark(criteriaMax) })}</p>
		<ul class="crit-list">
			{#each data.criteria as c (c.id)}
				<li>
					<span
						>{c.name}{#if c.description}<span class="muted small">&nbsp;– {c.description}</span
							>{/if}</span
					><strong>{formatMark(c.max_marks)}</strong>
				</li>
			{/each}
		</ul>
	</details>

	{#if !editable}
		<div class="alert info stack" data-testid="locked-notice">
			<p>{t('score.locked')}</p>
			{#if data.submission.submitted_at && isSubmitted(status)}
				<p class="small">
					{t('submit.success_body', {
						event: data.event.name,
						time: formatDateTime(locale(), data.submission.submitted_at)
					})}
				</p>
			{/if}
			{#if lastDecision?.status === 'rejected' && !pendingReopen}
				<p class="alert warning" data-testid="reopen-rejected">
					{t('request.reopen_title')}: <strong>{t('request.rejected')}</strong>
					{#if lastDecision.resolution_note}– {lastDecision.resolution_note}{/if}
				</p>
			{/if}
			{#if pendingReopen}
				<p><span class="badge warning">{t('request.pending')}</span> {pendingReopen.reason}</p>
			{:else if isSubmitted(status)}
				<form
					method="POST"
					action="?/requestReopen"
					class="stack"
					use:enhance={() => {
						busy = true;
						return async ({ update }) => {
							busy = false;
							await update();
							await invalidateAll();
						};
					}}
				>
					<h2>{t('request.reopen_title')}</h2>
					<p class="small">{t('request.reopen_help')}</p>
					<label for="reopen-reason">{t('common.reason')}</label>
					<textarea id="reopen-reason" name="reason" required minlength="3"></textarea>
					<button class="btn secondary" type="submit" disabled={busy}
						>{t('request.reopen_button')}</button
					>
				</form>
			{/if}
		</div>
	{/if}

	{#if data.criteria.length === 0}
		<div class="alert info">{t('score.no_criteria')}</div>
	{:else if data.participants.length === 0}
		<div class="alert info">{t('score.no_participants')}</div>
	{:else}
		{#if editable}
			<div class="sticky-status">
				<SaveIndicator
					state={sync.state}
					lastSavedAt={sync.lastSavedAt}
					pending={sync.pending}
					onretry={() => sync.flush()}
				/>
			</div>
		{/if}

		{#if data.participants.length > 6}
			<div class="field">
				<label for="find">{t('score.search')}</label>
				<input id="find" type="search" bind:value={query} autocomplete="off" />
			</div>
		{/if}

		<ol class="participants" role="list">
			{#each visible as p (p.id)}
				{@const total = totals[p.id]}
				<li class="card participant" class:complete={total.complete} data-testid="participant-card">
					<div class="row between">
						<div>
							<h2 class="pname">{p.name}</h2>
							<div class="muted small">
								{t('score.participant_code', {
									code: p.code
								})}{#if p.affiliation}{` · ${p.affiliation}`}{/if}
							</div>
						</div>
						<div
							class="total"
							aria-label="{t('score.total')} {total.total} / {total.max}"
							data-testid="participant-total"
						>
							<span class="small muted">{t('score.total')}</span>
							<span class="big"
								>{formatMark(total.total)}&nbsp;<span class="muted"
									>/&nbsp;{formatMark(total.max)}</span
								></span
							>
						</div>
					</div>
					<div class="marks">
						{#each data.criteria as c (c.id)}
							{@const k = key(p.id, c.id)}
							{@const err = errors[k]}
							<div class="mark">
								<label for="m-{k}">{c.name}</label>
								<div class="input-row">
									<input
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
									/>
									<span class="max" aria-hidden="true">/ {formatMark(c.max_marks)}</span>
								</div>
								{#if err}
									<div class="field-error" id="e-{k}" role="alert">
										{errorText(err, c.max_marks)}
									</div>
								{/if}
							</div>
						{/each}
					</div>
					<div class="small" class:muted={!total.complete}>
						{total.complete
							? '✓ ' + t('score.complete')
							: t('score.incomplete', { n: total.required - total.filled })}
					</div>
				</li>
			{/each}
		</ol>

		<div class="bottom-bar">
			<div class="container row between">
				<div>
					<div class="small">
						{t('judge.progress', { done: completeCount, total: data.participants.length })}
					</div>
					<div class="progress" aria-hidden="true">
						<span style="width: {(completeCount / Math.max(1, data.participants.length)) * 100}%"
						></span>
					</div>
				</div>
				{#if editable}
					<a class="btn large" href="/judge/events/{data.event.id}/review" data-testid="review-link"
						>{t('score.review_submit')}</a
					>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.pre {
		white-space: pre-wrap;
	}
	.crit-list {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
	}
	.crit-list li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.4rem 0;
		border-top: 1px dashed var(--border);
	}
	summary {
		cursor: pointer;
		min-height: 44px;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: wrap;
	}
	.sticky-status {
		position: sticky;
		top: 0;
		z-index: 5;
		background: var(--bg);
		padding: 0.25rem 0;
	}
	.participants {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 1rem;
	}
	.participant {
		border-width: 2px;
	}
	.participant.complete {
		border-color: var(--success);
	}
	.pname {
		font-size: 1.35rem;
		margin: 0;
	}
	.total {
		text-align: right;
		display: flex;
		flex-direction: column;
	}
	.marks {
		display: grid;
		gap: 0.85rem;
		margin: 1rem 0 0.5rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
	}
	.mark label {
		font-size: 1rem;
	}
	.input-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.input-row input {
		font-size: 1.35rem;
		font-weight: 700;
		text-align: center;
		min-height: 56px;
		max-width: 8rem;
	}
	.max {
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--muted);
		white-space: nowrap;
	}
	.field-error {
		color: var(--danger);
		font-weight: 600;
		font-size: 0.95rem;
		margin-top: 0.25rem;
	}
	.bottom-bar {
		position: sticky;
		bottom: 0;
		background: var(--surface);
		border-top: 2px solid var(--border);
		margin: 1rem -1rem -1rem;
		padding: 0.5rem 0;
	}
	.bottom-bar .progress {
		width: 12rem;
		margin-top: 0.25rem;
	}
	input[readonly] {
		background: var(--neutral-bg);
		border-style: dashed;
	}
</style>

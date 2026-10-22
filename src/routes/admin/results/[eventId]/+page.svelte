<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import ConfirmForm from '#lib/components/ConfirmForm.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { formatMark, ordinal, podium } from '#lib/scoring.ts';
	import type { SubmissionStatus } from '#lib/types.ts';

	let { data, form } = $props();
	const r = $derived(data.results);
	const byId = $derived(new Map((r.participants ?? []).map((p) => [p.participant_id, p])));
	const winners = $derived(podium(r.participants ?? []));
	const tone = $derived(
		r.status === 'finalized'
			? 'success'
			: r.status === 'ready_for_finalization'
				? 'info'
				: r.status === 'awaiting_tie_resolution'
					? 'warning'
					: 'neutral'
	);
</script>

<svelte:head><title>{data.event.name} – {t('admin.results.title')}</title></svelte:head>

<div class="stack">
	<a href="/admin/results">← {t('admin.results.title')}</a>
	<div class="row between">
		<div>
			<div class="muted">{data.event.groups?.name}</div>
			<h1 style="margin: 0">{data.event.name}</h1>
		</div>
		<span class="badge {tone}" data-testid="result-status">{t(`result_status.${r.status}`)}</span>
	</div>
	<Flash {form} />

	<section class="card stack">
		<h2>
			{t('report.judges_submitted')}: {t('common.of', {
				a: r.submitted_judges,
				b: r.required_judges
			})}
		</h2>
		<ul>
			{#each r.judges as j (j.judge_id)}
				<li>
					{j.display_name} <span class="mono small">{j.username}</span>
					{#if j.status}<StatusBadge status={j.status as SubmissionStatus} />{/if}
					{#if j.missing}<span class="badge danger"
							>{t('admin.submissions.missing', { n: j.missing })}</span
						>{/if}
				</li>
			{/each}
		</ul>
	</section>

	{#if !r.complete || !r.participants}
		<div class="alert info" data-testid="results-hidden">{t('admin.results.hidden')}</div>
	{:else}
		{#if r.status !== 'finalized'}
			<div class="alert warning">{t('admin.results.provisional')}</div>
		{:else if r.finalization}
			<div class="alert success">
				{t('admin.results.finalized_at', {
					time: formatDateTime(locale(), r.finalization.finalized_at)
				})}
			</div>
		{/if}

		{#if winners.length}
			<section class="card stack">
				<h2>{t('admin.results.winners')}</h2>
				<ol class="podium">
					{#each winners as w (w.participant_id)}
						<li>
							<span class="badge success">{ordinal(w.final_rank!, locale())}</span>
							<strong>{w.name}</strong>
							({w.code}) – {formatMark(w.aggregate)}
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		<div class="table-wrap">
			<table data-testid="results-table">
				<thead>
					<tr>
						<th>{t('admin.results.rank')}</th>
						<th>{t('common.participant')}</th>
						{#each r.judges as j (j.judge_id)}<th class="num">{j.display_name}</th>{/each}
						<th class="num">{t('admin.results.aggregate')}</th>
					</tr>
				</thead>
				<tbody>
					{#each r.participants as p (p.participant_id)}
						<tr>
							<td>
								{#if p.final_rank}<strong>{p.final_rank}</strong>{:else}–{/if}
								{#if p.tied}<span class="badge warning">{t('admin.results.tied')}</span>{/if}
							</td>
							<td
								><strong>{p.name}</strong><br /><span class="mono small">{p.code}</span
								>{#if p.affiliation}
									· <span class="small">{p.affiliation}</span>{/if}</td
							>
							{#each r.judges as j (j.judge_id)}<td class="num"
									>{formatMark(Number(p.judge_totals[j.judge_id] ?? 0))}</td
								>{/each}
							<td class="num big">{formatMark(p.aggregate)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if r.ties.length}
			<section class="stack">
				<h2>{t('admin.results.ties')}</h2>
				{#each r.ties as tie (tie.participant_ids.join())}
					<form
						method="POST"
						action="?/resolveTie"
						use:enhance
						class="card stack"
						data-testid="tie-form"
					>
						<h3>
							{t('admin.results.tie_group', {
								aggregate: formatMark(tie.aggregate),
								from: tie.start_rank,
								to: tie.start_rank + tie.participant_ids.length - 1
							})}
							{#if tie.resolved}<span class="badge success">✓</span>{/if}
						</h3>
						{#if tie.resolved && tie.reason}<p class="small">
								{t('admin.results.tie_resolved', { reason: tie.reason })}
							</p>{/if}
						{#if r.status !== 'finalized'}
							<div class="form-grid">
								{#each tie.participant_ids as pid (pid)}
									<div>
										<input type="hidden" name="pid" value={pid} />
										<label for="rank-{pid}">{byId.get(pid)?.name} ({byId.get(pid)?.code})</label>
										<input
											id="rank-{pid}"
											name="rank_{pid}"
											type="number"
											min={tie.start_rank}
											max={tie.start_rank + tie.participant_ids.length - 1}
											required
											value={tie.ranks?.[pid] ?? ''}
										/>
									</div>
								{/each}
							</div>
							{#if data.corrections.length}
								<fieldset>
									<legend>{t('admin.requests.corrections')} ({t('common.optional')})</legend>
									{#each data.corrections as c (c.id)}
										<label class="checkbox"
											><input type="checkbox" name="correction_ids" value={c.id} />
											{c.message} ({t(`request.${c.status}`)})</label
										>
									{/each}
								</fieldset>
							{/if}
							<div>
								<label for="tie-reason-{tie.start_rank}">{t('common.reason')}</label>
								<textarea id="tie-reason-{tie.start_rank}" name="reason" required minlength="3"
								></textarea>
							</div>
							<div class="row">
								<button class="btn" type="submit">{t('admin.results.resolve_tie')}</button>
								<a class="btn ghost" href="/admin/submissions?event={r.event_id}"
									>{t('admin.results.request_review')}</a
								>
							</div>
						{/if}
					</form>
				{/each}
			</section>
		{/if}

		<div class="row">
			{#if r.status === 'ready_for_finalization'}
				<ConfirmForm
					action="?/finalize"
					label={t('admin.results.finalize')}
					title={t('admin.results.finalize')}
					message={t('admin.results.finalize_confirm', { event: data.event.name })}
					buttonClass="btn large"
				/>
			{:else if r.status === 'finalized'}
				<ConfirmForm
					action="?/unfinalize"
					label={t('admin.results.unfinalize')}
					title={t('admin.results.unfinalize')}
					requireReason
					danger
					buttonClass="btn ghost"
				/>
			{/if}
		</div>
	{/if}
</div>

<style>
	.podium {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
		font-size: 1.1rem;
	}
</style>

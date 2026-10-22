<script lang="ts">
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { formatMark } from '#lib/scoring.ts';

	let { data } = $props();
	const totals = $derived((data.latest?.totals ?? {}) as Record<string, number>);
	const max = $derived(data.criteria.reduce((s, c) => s + c.max_marks, 0));
</script>

<svelte:head><title>{t('submit.receipt')}</title></svelte:head>

<div class="stack">
	{#if data.justSubmitted}
		<div class="alert success" role="status" data-testid="submit-success">
			<h1 style="margin: 0">✓ {t('submit.success_title')}</h1>
		</div>
	{/if}
	<div class="card stack">
		<h2>{t('submit.receipt')}</h2>
		<div class="row"><StatusBadge status={data.submission.status} /></div>
		<p><strong>{data.event.name}</strong> – {data.group.name}</p>
		{#if data.latest}
			<p>
				{t('submit.success_body', {
					event: data.event.name,
					time: formatDateTime(locale(), data.latest.submitted_at)
				})}
			</p>
			<p>{t('submit.round', { n: data.latest.round })}</p>
		{/if}
		<p>{t('submit.participant_count', { n: data.participants.length })}</p>
	</div>

	{#if data.latest}
		<div class="table-wrap">
			<table>
				<thead>
					<tr><th>{t('common.participant')}</th><th class="num">{t('score.total')}</th></tr>
				</thead>
				<tbody>
					{#each data.participants as p (p.id)}
						<tr>
							<td>{p.name} <span class="small muted">({p.code})</span></td>
							<td class="num">{formatMark(Number(totals[p.id] ?? 0))} / {formatMark(max)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<div class="row">
		<a class="btn secondary" href="/judge/events/{data.event.id}">{t('judge.view_submission')}</a>
		<a class="btn ghost" href="/judge">{t('nav.my_events')}</a>
	</div>
</div>

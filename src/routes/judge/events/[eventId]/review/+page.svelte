<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';
	import { formatMark, participantTotal } from '#lib/scoring.ts';
	import { clearDrafts, pendingDraftCount } from '#lib/offline/score-sync.svelte.ts';

	let { data, form } = $props();

	let pending = $state<number | null>(null);
	let confirmed = $state(false);
	let busy = $state(false);

	const rows = $derived(
		data.participants.map((p) => {
			const marks: Record<string, number | null> = {};
			for (const s of data.scores) if (s.participant_id === p.id) marks[s.criterion_id] = s.value;
			return { p, total: participantTotal(data.criteria, marks) };
		})
	);
	const incomplete = $derived(rows.filter((r) => !r.total.complete).length);

	onMount(async () => {
		pending = await pendingDraftCount(data.profile!.id, data.submission.id);
	});

	const canSubmit = $derived(confirmed && pending === 0 && incomplete === 0 && !busy);
</script>

<svelte:head><title>{t('submit.title')}</title></svelte:head>

<div class="stack">
	<a href="/judge/events/{data.event.id}">← {t('submit.go_back_edit')}</a>
	<h1>{t('submit.title')}</h1>
	<Flash {form} />

	<div class="card stack">
		<p class="big">{t('submit.summary', { event: data.event.name, group: data.group.name })}</p>
		<p>{t('submit.participant_count', { n: data.participants.length })}</p>
		<p>{t('submit.criteria_count', { n: data.criteria.length })}</p>
	</div>

	{#if pending !== null && pending > 0}
		<div class="alert warning" role="alert">
			{t('submit.unsynced')}
			<a href="/judge/events/{data.event.id}">{t('submit.go_back_edit')}</a>
		</div>
	{/if}
	{#if incomplete > 0}
		<div class="alert error" role="alert">{t('submit.incomplete')}</div>
	{/if}

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>{t('common.participant')}</th>
					<th class="num">{t('score.total')}</th>
					<th>{t('common.status')}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as { p, total } (p.id)}
					<tr>
						<td><strong>{p.name}</strong><br /><span class="small muted">{p.code}</span></td>
						<td class="num big">{formatMark(total.total)} / {formatMark(total.max)}</td>
						<td>
							{#if total.complete}
								<span class="badge success">✓ {t('score.complete')}</span>
							{:else}
								<span class="badge danger"
									>{t('score.incomplete', { n: total.required - total.filled })}</span
								>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<form
		method="POST"
		class="card stack"
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				if (result.type === 'redirect') await clearDrafts(data.profile!.id, data.submission.id);
				busy = false;
				await update();
			};
		}}
	>
		<div class="alert warning">{t('submit.warning')}</div>
		<input type="hidden" name="expected_version" value={data.submission.version} />
		<label class="checkbox">
			<input type="checkbox" name="confirm" value="yes" bind:checked={confirmed} required />
			{t('submit.confirm_check')}
		</label>
		<button class="btn large block" type="submit" disabled={!canSubmit} data-testid="final-submit">
			{busy ? t('submit.submitting') : t('submit.button')}
		</button>
	</form>
</div>

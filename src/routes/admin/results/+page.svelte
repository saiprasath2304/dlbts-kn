<script lang="ts">
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data } = $props();
	const tone = (s: string) =>
		s === 'finalized'
			? 'success'
			: s === 'ready_for_finalization'
				? 'info'
				: s === 'awaiting_tie_resolution'
					? 'warning'
					: 'neutral';
</script>

<svelte:head><title>{t('admin.results.title')}</title></svelte:head>

<div class="stack">
	<h1>{t('admin.results.title')}</h1>
	<p class="muted">{t('admin.results.hidden')}</p>
	<div class="table-wrap">
		<table>
			<thead>
				<tr
					><th>{t('common.event')}</th><th>{t('report.judges_submitted')}</th><th
						>{t('common.status')}</th
					><th></th></tr
				>
			</thead>
			<tbody>
				{#each data.events as e (e.id)}
					<tr>
						<td>{e.group} – <strong>{e.name}</strong></td>
						<td>{t('common.of', { a: e.submitted, b: e.required })}</td>
						<td>
							<span class="badge {tone(e.status)}">{t(`result_status.${e.status}`)}</span>
							{#if e.unresolved}<span class="badge warning"
									>{t('admin.results.ties')}: {e.unresolved}</span
								>{/if}
						</td>
						<td
							><a class="btn small secondary" href="/admin/results/{e.id}">{t('common.open')}</a
							></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

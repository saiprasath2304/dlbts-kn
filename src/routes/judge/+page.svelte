<script lang="ts">
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { isSubmitted } from '#lib/status.ts';

	let { data } = $props();
</script>

<svelte:head><title>{t('judge.my_events')}</title></svelte:head>

<div class="stack">
	<h1>{t('judge.welcome', { name: data.profile?.display_name ?? '' })}</h1>
	<h2>{t('judge.my_events')}</h2>

	{#if data.events.length === 0}
		<div class="alert info">{t('judge.no_events')}</div>
	{:else}
		<ul class="events" role="list">
			{#each data.events as ev (ev.id)}
				<li class="card stack">
					<div class="row between">
						<div>
							<div class="muted small">{ev.group}</div>
							<h3 class="title">{ev.name}</h3>
						</div>
						<StatusBadge status={ev.status} />
					</div>
					{#if ev.openCorrections > 0 || ev.status === 'reopened' || ev.status === 'correction_requested'}
						<div class="alert warning">{t('judge.action_required')}</div>
					{/if}
					<p class="muted">
						{t('judge.participants_count', { n: ev.participants })} · {t('judge.criteria_count', {
							n: ev.criteria
						})}
					</p>
					{#if ev.submitted_at && isSubmitted(ev.status)}
						<p class="small">
							{t('submit.success_body', {
								event: ev.name,
								time: formatDateTime(locale(), ev.submitted_at)
							})}
						</p>
					{/if}
					<a class="btn large block" href="/judge/events/{ev.id}">
						{isSubmitted(ev.status) || ev.status === 'reopening_requested'
							? t('judge.view_submission')
							: ev.status === 'not_started'
								? t('judge.start_scoring')
								: t('judge.continue_scoring')}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.events {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
	}
	.title {
		font-size: 1.3rem;
		margin: 0;
	}
</style>

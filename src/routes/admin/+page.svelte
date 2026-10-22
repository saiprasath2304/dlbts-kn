<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatTime } from '#lib/i18n/index.ts';
	import { LiveRefresh } from '#lib/realtime.svelte.ts';

	let { data } = $props();

	const live = new LiveRefresh(untrack(() => data.token));
	onMount(() => {
		live.start();
		return () => live.stop();
	});

	const s = $derived(data.stats);
	const groups = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt on every change, never mutated after
		const map = new Map<string, { name: string; rows: typeof data.rows }>();
		for (const r of data.rows) {
			const g = map.get(r.group_id) ?? { name: r.group_name, rows: [] };
			g.rows.push(r);
			map.set(r.group_id, g);
		}
		return [...map.entries()];
	});
	const filtered = $derived(!!(data.filters.group || data.filters.event || data.filters.judge));
</script>

<svelte:head><title>{t('admin.dashboard.title')}</title></svelte:head>

<div class="stack">
	<div class="page-head">
		<h1>{t('admin.dashboard.title')}</h1>
		<span class="badge {live.live ? 'success' : 'neutral'}" role="status">
			{live.live
				? '● ' + t('admin.dashboard.live')
				: t('admin.dashboard.polling', { s: live.pollSeconds })}
			· {formatTime(locale(), data.loadedAt)}
		</span>
	</div>

	<div class="stats" data-testid="stats">
		<div class="stat">
			<div class="value">{s.complete}<small> / {s.events}</small></div>
			<div class="label">{t('admin.dashboard.overview_events')}</div>
		</div>
		<div class="stat">
			<div class="value">{s.submitted}<small> / {s.assigned}</small></div>
			<div class="label">{t('admin.dashboard.overview_submissions')}</div>
		</div>
		<div class="stat">
			<div class="value">{s.not_started}</div>
			<div class="label">{t('admin.dashboard.overview_not_started')}</div>
		</div>
		<a class="stat link" href="/admin/requests">
			<div class="value">{s.reopen + s.corrections}</div>
			<div class="label">{t('admin.dashboard.overview_requests')}</div>
		</a>
	</div>

	<details class="card" open={filtered}>
		<summary><strong>{t('common.filter')}</strong></summary>
		<form method="GET" class="form-grid" style="margin-top: 0.75rem">
			<div>
				<label for="f-group">{t('common.group')}</label>
				<select id="f-group" name="group" value={data.filters.group}>
					<option value="">{t('common.all')}</option>
					{#each data.groupsOptions as [id, name] (id)}<option value={id}>{name}</option>{/each}
				</select>
			</div>
			<div>
				<label for="f-event">{t('common.event')}</label>
				<select id="f-event" name="event" value={data.filters.event}>
					<option value="">{t('common.all')}</option>
					{#each data.eventOptions as e (e.id)}<option value={e.id}>{e.group} – {e.name}</option
						>{/each}
				</select>
			</div>
			<div>
				<label for="f-judge">{t('common.judge')}</label>
				<select id="f-judge" name="judge" value={data.filters.judge}>
					<option value="">{t('common.all')}</option>
					{#each data.judges as j (j.id)}<option value={j.id}>{j.display_name}</option>{/each}
				</select>
			</div>
			<div class="row">
				<button class="btn secondary" type="submit">{t('common.filter')}</button>
				{#if filtered}<a class="btn ghost" href="/admin">{t('common.all')}</a>{/if}
			</div>
		</form>
	</details>

	{#each groups as [id, g] (id)}
		<section class="card group">
			<h2>{g.name}</h2>
			<ul class="events" role="list">
				{#each g.rows as r (r.event_id)}
					<li data-testid="event-progress">
						<div class="ev-name">
							<a href="/admin/submissions?event={r.event_id}">{r.event_name}</a>
							<div class="small muted">
								{t('admin.dashboard.judges_submitted', { a: r.submitted, b: r.required_judges })}
							</div>
						</div>
						<div class="ev-bar">
							<div class="progress" aria-hidden="true">
								<span
									style="width: {r.required_judges ? (r.submitted / r.required_judges) * 100 : 0}%"
								></span>
							</div>
						</div>
						<div class="ev-status">
							{#if r.finalized}
								<span class="badge success">{t('result_status.finalized')}</span>
							{:else if r.required_judges === 0}
								<span class="badge danger">{t('admin.dashboard.no_judges')}</span>
							{:else if r.complete}
								<a class="badge info" href="/admin/results/{r.event_id}"
									>{t('admin.dashboard.complete')}</a
								>
							{:else}
								<span class="badge neutral"
									>{t('admin.dashboard.waiting_for', { n: r.required_judges - r.submitted })}</span
								>
							{/if}
							{#if r.reopening_pending + r.corrections_open > 0}
								<a class="badge warning" href="/admin/requests"
									>{t('nav.requests')}: {r.reopening_pending + r.corrections_open}</a
								>
							{/if}
							{#if r.incomplete_submissions > 0}
								<span class="badge danger"
									>{t('admin.dashboard.needs_fix', { n: r.incomplete_submissions })}</span
								>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.stat.link {
		text-decoration: none;
		color: inherit;
	}
	.stat.link:hover {
		border-color: var(--primary);
	}
	summary {
		min-height: 32px;
	}
	.events {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.events li {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.4rem;
		padding: 0.7rem 0;
		border-top: 1px solid var(--border);
	}
	.events li:first-child {
		border-top: 0;
	}
	.ev-name a {
		font-weight: 700;
		text-decoration: none;
		color: var(--text);
	}
	.ev-name a:hover {
		color: var(--primary);
	}
	.ev-status {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.ev-status a.badge {
		text-decoration: none;
	}
	@media (min-width: 720px) {
		.events li {
			grid-template-columns: minmax(0, 2fr) minmax(6rem, 1fr) minmax(0, 2fr);
			align-items: center;
			gap: 1rem;
		}
	}
</style>

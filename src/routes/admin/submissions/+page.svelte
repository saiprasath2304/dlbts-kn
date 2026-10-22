<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { LiveRefresh } from '#lib/realtime.svelte.ts';

	let { data } = $props();
	const statuses = [
		'not_started',
		'in_progress',
		'submitted',
		'reopening_requested',
		'correction_requested',
		'reopened',
		'resubmitted'
	];
	const live = new LiveRefresh(untrack(() => data.token));
	onMount(() => {
		live.start();
		return () => live.stop();
	});
</script>

<svelte:head><title>{t('admin.submissions.title')}</title></svelte:head>

<div class="stack">
	<div class="row between">
		<h1>{t('admin.submissions.title')}</h1>
		<span class="badge {live.live ? 'success' : 'neutral'}"
			>{live.live
				? t('admin.dashboard.live')
				: t('admin.dashboard.polling', { s: live.pollSeconds })}</span
		>
	</div>
	<form method="GET" class="card form-grid">
		<div>
			<label for="s-group">{t('common.group')}</label>
			<select id="s-group" name="group" value={data.filters.group}>
				<option value="">{t('common.all')}</option>
				{#each data.groups as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
			</select>
		</div>
		<div>
			<label for="s-event">{t('common.event')}</label>
			<select id="s-event" name="event" value={data.filters.event}>
				<option value="">{t('common.all')}</option>
				{#each data.groups as g (g.id)}
					<optgroup label={g.name}
						>{#each g.events as e (e.id)}<option value={e.id}>{e.name}</option>{/each}</optgroup
					>
				{/each}
			</select>
		</div>
		<div>
			<label for="s-judge">{t('common.judge')}</label>
			<select id="s-judge" name="judge" value={data.filters.judge}>
				<option value="">{t('common.all')}</option>
				{#each data.judges as j (j.id)}<option value={j.id}>{j.display_name} ({j.username})</option
					>{/each}
			</select>
		</div>
		<div>
			<label for="s-status">{t('common.status')}</label>
			<select id="s-status" name="status" value={data.filters.status}>
				<option value="">{t('common.all')}</option>
				{#each statuses as s (s)}<option value={s}>{t(`status.${s}`)}</option>{/each}
			</select>
		</div>
		<button class="btn secondary" type="submit">{t('common.filter')}</button>
	</form>

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>{t('common.event')}</th>
					<th>{t('common.judge')}</th>
					<th>{t('common.status')}</th>
					<th>{t('admin.submissions.last_saved')}</th>
					<th>{t('admin.submissions.submitted_at')}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as s (s.id)}
					<tr class:muted={!s.required}>
						<td>{s.events?.groups?.name} – <strong>{s.events?.name}</strong></td>
						<td
							>{s.profiles?.display_name}<br /><span class="mono small">{s.profiles?.username}</span
							>{#if !s.required}<br /><span class="badge neutral">{t('common.inactive')}</span
								>{/if}</td
						>
						<td><StatusBadge status={s.status} /></td>
						<td class="small">{formatDateTime(locale(), s.last_saved_at)}</td>
						<td class="small">{formatDateTime(locale(), s.submitted_at)}</td>
						<td
							><a class="btn small secondary" href="/admin/submissions/{s.id}">{t('common.open')}</a
							></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

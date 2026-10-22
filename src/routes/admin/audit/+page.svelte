<script lang="ts">
	import { page } from '$app/state';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';

	let { data } = $props();
	const who = (id: string | null) => {
		const p = data.people.find((x) => x.id === id);
		return p ? `${p.display_name} (${p.username})` : id ? id.slice(0, 8) : '–';
	};
	const eventName = (id: string | null) =>
		data.groups.flatMap((g) => g.events).find((e) => e.id === id)?.name ?? '';
	const nextHref = $derived.by(() => {
		const u = new URL(page.url.href);
		if (data.next) u.searchParams.set('before', String(data.next));
		return u.pathname + u.search;
	});
</script>

<svelte:head><title>{t('admin.audit.title')}</title></svelte:head>

<div class="stack">
	<h1>{t('admin.audit.title')}</h1>
	<form method="GET" class="card form-grid">
		<div>
			<label for="a-from">{t('common.from')}</label><input
				id="a-from"
				name="from"
				type="date"
				value={data.filters.from}
			/>
		</div>
		<div>
			<label for="a-to">{t('common.to')}</label><input
				id="a-to"
				name="to"
				type="date"
				value={data.filters.to}
			/>
		</div>
		<div>
			<label for="a-actor">{t('admin.audit.actor')}</label>
			<select id="a-actor" name="actor" value={data.filters.actor}>
				<option value="">{t('common.all')}</option>
				{#each data.people as p (p.id)}<option value={p.id}>{p.display_name} ({p.username})</option
					>{/each}
			</select>
		</div>
		<div>
			<label for="a-event">{t('common.event')}</label>
			<select id="a-event" name="event" value={data.filters.event}>
				<option value="">{t('common.all')}</option>
				{#each data.groups as g (g.id)}<optgroup label={g.name}
						>{#each g.events as e (e.id)}<option value={e.id}>{e.name}</option>{/each}</optgroup
					>{/each}
			</select>
		</div>
		<div>
			<label for="a-part">{t('common.participant')} ({t('common.code')})</label><input
				id="a-part"
				name="participant"
				value={data.filters.participant}
			/>
		</div>
		<div>
			<label for="a-action">{t('admin.audit.action')}</label>
			<select id="a-action" name="action" value={data.filters.action}>
				<option value="">{t('common.all')}</option>
				{#each data.actions as a (a)}<option value={a}>{a}</option>{/each}
			</select>
		</div>
		<button class="btn secondary" type="submit">{t('common.filter')}</button>
	</form>

	{#if data.rows.length === 0}<p class="muted">{t('admin.audit.none')}</p>{/if}
	<div class="table-wrap">
		<table>
			<thead
				><tr
					><th>{t('admin.audit.time')}</th><th>{t('admin.audit.action')}</th><th
						>{t('admin.audit.actor')}</th
					><th>{t('admin.audit.details')}</th></tr
				></thead
			>
			<tbody>
				{#each data.rows as r (r.id)}
					<tr>
						<td class="small nowrap">{formatDateTime(locale(), r.created_at)}</td>
						<td class="mono small">{r.action}</td>
						<td class="small">{who(r.actor_id)}<br /><span class="muted">{r.actor_role}</span></td>
						<td class="small">
							{#if r.event_id}<div>{t('common.event')}: {eventName(r.event_id)}</div>{/if}
							{#if r.judge_id}<div>{t('common.judge')}: {who(r.judge_id)}</div>{/if}
							{#if r.reason}<div><strong>{t('common.reason')}:</strong> {r.reason}</div>{/if}
							{#if r.old_value || r.new_value || Object.keys(r.metadata ?? {}).length}
								<details>
									<summary>{t('admin.audit.details')}</summary>
									{#if r.old_value}<pre class="json">- {JSON.stringify(
												r.old_value,
												null,
												1
											)}</pre>{/if}
									{#if r.new_value}<pre class="json">+ {JSON.stringify(
												r.new_value,
												null,
												1
											)}</pre>{/if}
									{#if Object.keys(r.metadata ?? {}).length}<pre class="json">{JSON.stringify(
												r.metadata,
												null,
												1
											)}</pre>{/if}
								</details>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if data.next}<a class="btn secondary" href={nextHref}>{t('admin.audit.older')}</a>{/if}
</div>

<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data, form } = $props();
	const allEvents = $derived(
		data.groups.flatMap((g) => g.events.map((e) => ({ ...e, group: g.name })))
	);
	const exportQuery = $derived(
		new URLSearchParams({ group: data.filters.group, event: data.filters.event }).toString()
	);
</script>

<svelte:head><title>{t('admin.participants.title')}</title></svelte:head>

{#snippet participantFields(p?: (typeof data.participants)[number])}
	{@const sfx = p?.id ?? 'new'}
	<div class="form-grid">
		<div>
			<label for="p-code-{sfx}">{t('common.code')}</label><input
				id="p-code-{sfx}"
				name="code"
				required
				value={p?.code ?? ''}
			/>
		</div>
		<div>
			<label for="p-name-{sfx}">{t('common.name')}</label><input
				id="p-name-{sfx}"
				name="name"
				required
				value={p?.name ?? ''}
			/>
		</div>
		<div>
			<label for="p-kind-{sfx}">{t('admin.participants.kind')}</label>
			<select id="p-kind-{sfx}" name="kind" value={p?.kind ?? 'individual'}>
				<option value="individual">{t('admin.participants.kind_individual')}</option>
				<option value="team">{t('admin.participants.kind_team')}</option>
			</select>
		</div>
		<div>
			<label for="p-group-{sfx}">{t('common.group')}</label>
			<select id="p-group-{sfx}" name="group_id" value={p?.group_id ?? ''} required>
				{#each data.groups as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
			</select>
		</div>
		<div>
			<label for="p-aff-{sfx}">{t('admin.participants.affiliation')}</label><input
				id="p-aff-{sfx}"
				name="affiliation"
				value={p?.affiliation ?? ''}
			/>
		</div>
		<div>
			<label for="p-reg-{sfx}">{t('admin.participants.registration_no')}</label><input
				id="p-reg-{sfx}"
				name="registration_no"
				value={p?.registration_no ?? ''}
			/>
		</div>
		<div>
			<label for="p-notes-{sfx}">{t('admin.participants.notes')}</label><input
				id="p-notes-{sfx}"
				name="notes"
				value={p?.notes ?? ''}
			/>
		</div>
	</div>
{/snippet}

<div class="stack">
	<div class="row between">
		<h1>{t('admin.participants.title')}</h1>
		<div class="row">
			<a class="btn secondary" href="/admin/participants/import">{t('nav.import')}</a>
			<a class="btn ghost" href="/admin/participants/export?format=csv&{exportQuery}" download
				>{t('common.download_csv')}</a
			>
			<a class="btn ghost" href="/admin/participants/export?format=xlsx&{exportQuery}" download
				>{t('common.download_xlsx')}</a
			>
		</div>
	</div>
	<Flash {form} />

	<form method="GET" class="card form-grid">
		<div>
			<label for="f-q">{t('common.search')}</label>
			<input id="f-q" name="q" type="search" value={data.filters.q} />
		</div>
		<div>
			<label for="f-group">{t('common.group')}</label>
			<select id="f-group" name="group" value={data.filters.group}>
				<option value="">{t('common.all')}</option>
				{#each data.groups as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
			</select>
		</div>
		<div>
			<label for="f-event">{t('common.event')}</label>
			<select id="f-event" name="event" value={data.filters.event}>
				<option value="">{t('common.all')}</option>
				{#each allEvents as e (e.id)}<option value={e.id}>{e.group} – {e.name}</option>{/each}
			</select>
		</div>
		<label class="checkbox"
			><input type="checkbox" name="inactive" value="1" checked={data.filters.inactive} />
			{t('common.inactive')}</label
		>
		<button class="btn secondary" type="submit">{t('common.filter')}</button>
	</form>

	<details class="card">
		<summary class="btn secondary">{t('admin.participants.new')}</summary>
		<form method="POST" action="?/save" use:enhance class="stack" style="margin-top: 1rem">
			<p class="help">{t('admin.participants.code_help')}</p>
			{@render participantFields()}
			<div>
				<label for="p-event-new"
					>{t('admin.participants.add_to_event')} ({t('common.optional')})</label
				>
				<select id="p-event-new" name="event_id">
					<option value="">{t('common.none')}</option>
					{#each allEvents as e (e.id)}<option value={e.id}>{e.group} – {e.name}</option>{/each}
				</select>
			</div>
			<button class="btn" type="submit">{t('common.create')}</button>
		</form>
	</details>

	{#if data.participants.length === 0}
		<p class="muted">{t('admin.participants.none')}</p>
	{/if}
	<ul class="plist" role="list">
		{#each data.participants as p (p.id)}
			<li class="card stack">
				<div class="row between">
					<div>
						<strong class="big">{p.name}</strong> <span class="mono small">{p.code}</span>
						<div class="small muted">
							{p.groups?.name} · {p.kind === 'team'
								? t('admin.participants.kind_team')
								: t('admin.participants.kind_individual')}
							{#if p.affiliation}
								· {p.affiliation}{/if}
						</div>
						<div class="small">
							{t('admin.participants.events')}: {p.event_participants
								.filter((l) => l.is_active)
								.map((l) => l.events?.name)
								.join(', ') || t('common.none')}
						</div>
					</div>
					<span class="badge {p.is_active ? 'success' : 'neutral'}"
						>{p.is_active ? t('common.active') : t('common.inactive')}</span
					>
				</div>
				<details>
					<summary class="btn small ghost">{t('common.edit')}</summary>
					<form method="POST" action="?/save" use:enhance class="stack" style="margin-top: 1rem">
						<input type="hidden" name="id" value={p.id} />
						{@render participantFields(p)}
						<button class="btn secondary" type="submit">{t('common.update')}</button>
					</form>
					<form method="POST" action="?/setActive" use:enhance class="row" style="margin-top: 1rem">
						<input type="hidden" name="id" value={p.id} />
						<input type="hidden" name="active" value={p.is_active ? 'false' : 'true'} />
						<input
							name="reason"
							placeholder="{t('common.reason')} ({t('common.optional')})"
							aria-label={t('common.reason')}
						/>
						<button class="btn small {p.is_active ? 'danger' : 'secondary'}" type="submit">
							{p.is_active ? t('common.deactivate') : t('common.activate')}
						</button>
					</form>
				</details>
			</li>
		{/each}
	</ul>
</div>

<style>
	.plist {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}
	.plist input[name='reason'] {
		max-width: 18rem;
	}
</style>

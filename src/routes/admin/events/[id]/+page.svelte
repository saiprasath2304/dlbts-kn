<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import ReasonField from '#lib/components/ReasonField.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';
	import { formatMark } from '#lib/scoring.ts';

	let { data, form } = $props();
	const ev = $derived(data.event);
	const totalMax = $derived(
		data.criteria.filter((c) => c.is_active).reduce((s, c) => s + c.max_marks, 0)
	);
	const assignedIds = $derived(new Set(data.assignments.map((a) => a.judge_id)));
</script>

<svelte:head><title>{ev.name}</title></svelte:head>

<div class="stack">
	<a href="/admin/events">← {t('admin.events.title')}</a>
	<div class="row between">
		<div>
			<div class="muted">{ev.groups?.name}</div>
			<h1 style="margin: 0">{ev.name} <span class="mono small muted">{ev.code}</span></h1>
		</div>
		{#if data.scoringStarted}<span class="badge warning">{t('admin.events.scoring_started')}</span
			>{/if}
	</div>
	<Flash {form} />

	<details class="card">
		<summary class="btn small ghost">{t('common.edit')}</summary>
		<form method="POST" action="?/saveEvent" use:enhance class="stack" style="margin-top: 1rem">
			<input type="hidden" name="id" value={ev.id} />
			<div class="form-grid">
				<div>
					<label for="e-group">{t('common.group')}</label>
					<select id="e-group" name="group_id" value={ev.group_id}>
						{#each data.groups as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
					</select>
				</div>
				<div>
					<label for="e-code">{t('common.code')}</label><input
						id="e-code"
						name="code"
						required
						value={ev.code}
					/>
				</div>
				<div>
					<label for="e-name">{t('common.name')}</label><input
						id="e-name"
						name="name"
						required
						value={ev.name}
					/>
				</div>
				<div>
					<label for="e-prec">{t('admin.events.precision')}</label>
					<select id="e-prec" name="score_precision" value={String(ev.score_precision)}>
						<option value="0">{t('admin.events.precision_0')}</option>
						<option value="1">{t('admin.events.precision_1')}</option>
						<option value="2">{t('admin.events.precision_2')}</option>
					</select>
				</div>
				<div>
					<label for="e-order">{t('common.order')}</label><input
						id="e-order"
						name="display_order"
						type="number"
						value={ev.display_order}
					/>
				</div>
				<label class="checkbox"
					><input type="checkbox" name="is_active" checked={ev.is_active} />
					{t('common.active')}</label
				>
			</div>
			<div>
				<label for="e-desc">{t('common.description')}</label><textarea
					id="e-desc"
					name="description">{ev.description ?? ''}</textarea
				>
			</div>
			<div>
				<label for="e-ins">{t('admin.events.instructions')}</label><textarea
					id="e-ins"
					name="instructions">{ev.instructions ?? ''}</textarea
				>
			</div>
			<ReasonField show={data.scoringStarted} id="e-reason" />
			<button class="btn" type="submit">{t('common.update')}</button>
		</form>
	</details>

	<!-- Criteria -->
	<section class="card stack" aria-labelledby="crit-h">
		<div class="row between">
			<h2 id="crit-h">{t('admin.criteria.title')}</h2>
			<strong>{t('admin.criteria.total_max', { max: formatMark(totalMax) })}</strong>
		</div>
		{#if data.criteria.length === 0}<p class="muted">{t('admin.criteria.none')}</p>{/if}
		{#each data.criteria as c (c.id)}
			<form
				method="POST"
				action="?/saveCriterion"
				use:enhance
				class="form-grid crit"
				class:inactive={!c.is_active}
			>
				<input type="hidden" name="id" value={c.id} />
				<div>
					<label for="c-name-{c.id}">{t('common.name')}</label><input
						id="c-name-{c.id}"
						name="name"
						required
						value={c.name}
					/>
				</div>
				<div>
					<label for="c-max-{c.id}">{t('admin.criteria.max')}</label><input
						id="c-max-{c.id}"
						name="max_marks"
						inputmode="decimal"
						required
						value={formatMark(c.max_marks)}
					/>
				</div>
				<div>
					<label for="c-order-{c.id}">{t('common.order')}</label><input
						id="c-order-{c.id}"
						name="display_order"
						type="number"
						value={c.display_order}
					/>
				</div>
				<div>
					<label for="c-desc-{c.id}">{t('common.description')}</label><input
						id="c-desc-{c.id}"
						name="description"
						value={c.description ?? ''}
					/>
				</div>
				<label class="checkbox"
					><input type="checkbox" name="is_active" checked={c.is_active} />
					{t('common.active')}</label
				>
				{#if data.scoringStarted}
					<div>
						<label for="c-reason-{c.id}">{t('common.reason')}</label><input
							id="c-reason-{c.id}"
							name="reason"
							placeholder={t('common.confirm_reason_title')}
						/>
					</div>
				{/if}
				<button class="btn secondary" type="submit">{t('common.update')}</button>
			</form>
		{/each}
		<form method="POST" action="?/saveCriterion" use:enhance class="stack">
			<h3>{t('admin.criteria.new')}</h3>
			<div class="form-grid">
				<div>
					<label for="nc-name">{t('common.name')}</label><input id="nc-name" name="name" required />
				</div>
				<div>
					<label for="nc-max">{t('admin.criteria.max')}</label><input
						id="nc-max"
						name="max_marks"
						inputmode="decimal"
						required
						value="25"
					/>
				</div>
				<div>
					<label for="nc-order">{t('common.order')}</label><input
						id="nc-order"
						name="display_order"
						type="number"
						value={data.criteria.length}
					/>
				</div>
				<div>
					<label for="nc-desc">{t('common.description')}</label><input
						id="nc-desc"
						name="description"
					/>
				</div>
			</div>
			<ReasonField show={data.scoringStarted} id="nc-reason" />
			<button class="btn" type="submit">{t('common.add')}</button>
		</form>
	</section>

	<!-- Judges -->
	<section class="card stack" aria-labelledby="judges-h">
		<h2 id="judges-h">{t('admin.events.tab_judges')}</h2>
		{#if data.assignments.length === 0}<p class="muted">{t('admin.assignments.none')}</p>{/if}
		<ul class="list">
			{#each data.assignments as a (a.id)}
				<li class="row between">
					<span>
						<strong>{a.profiles?.display_name}</strong>
						<span class="mono small">{a.profiles?.username}</span>
						{#if !a.is_active}<span class="badge neutral">{t('common.inactive')}</span>{/if}
						{#if !a.profiles?.is_active}<span class="badge danger">{t('common.inactive')}</span
							>{/if}
					</span>
					<form method="POST" action="?/setAssignment" use:enhance class="row">
						<input type="hidden" name="judge_id" value={a.judge_id} />
						<input type="hidden" name="active" value={a.is_active ? 'false' : 'true'} />
						{#if data.scoringStarted}<input
								name="reason"
								required
								minlength="3"
								placeholder={t('common.reason')}
								aria-label={t('common.reason')}
							/>{/if}
						<button class="btn small {a.is_active ? 'ghost' : 'secondary'}" type="submit">
							{a.is_active ? t('admin.assignments.remove') : t('admin.assignments.restore')}
						</button>
					</form>
				</li>
			{/each}
		</ul>
		<form method="POST" action="?/setAssignment" use:enhance class="stack">
			<input type="hidden" name="active" value="true" />
			<label for="add-judge">{t('admin.assignments.select_judge')}</label>
			<select id="add-judge" name="judge_id" required>
				{#each data.judges.filter((j) => !assignedIds.has(j.id)) as j (j.id)}
					<option value={j.id}
						>{j.display_name} ({j.username}){j.is_active
							? ''
							: ' – ' + t('common.inactive')}</option
					>
				{/each}
			</select>
			<ReasonField show={data.scoringStarted} id="aj-reason" />
			<button class="btn" type="submit">{t('admin.assignments.add')}</button>
		</form>
	</section>

	<!-- Participants -->
	<section class="card stack" aria-labelledby="parts-h">
		<div class="row between">
			<h2 id="parts-h">
				{t('admin.events.tab_participants')} ({data.entries.filter((e) => e.is_active).length})
			</h2>
			<a class="btn small secondary" href="/admin/participants/import">{t('nav.import')}</a>
		</div>
		<ul class="list">
			{#each data.entries as e (e.id)}
				<li class="row between">
					<span>
						<strong>{e.participants?.name}</strong>
						<span class="mono small">{e.participants?.code}</span>
						{#if !e.is_active}<span class="badge neutral">{t('common.inactive')}</span>{/if}
					</span>
					<form method="POST" action="?/setParticipant" use:enhance class="row">
						<input type="hidden" name="participant_id" value={e.participants?.id} />
						<input type="hidden" name="active" value={e.is_active ? 'false' : 'true'} />
						{#if data.scoringStarted}<input
								name="reason"
								required
								minlength="3"
								placeholder={t('common.reason')}
								aria-label={t('common.reason')}
							/>{/if}
						<button class="btn small {e.is_active ? 'ghost' : 'secondary'}" type="submit">
							{e.is_active
								? t('admin.participants.remove_from_event')
								: t('admin.assignments.restore')}
						</button>
					</form>
				</li>
			{/each}
		</ul>
		{#if data.available.length}
			<form method="POST" action="?/setParticipant" use:enhance class="stack">
				<input type="hidden" name="active" value="true" />
				<label for="add-part">{t('admin.participants.add_to_event')}</label>
				<select id="add-part" name="participant_id" required>
					{#each data.available as p (p.id)}<option value={p.id}>{p.code} – {p.name}</option>{/each}
				</select>
				<ReasonField show={data.scoringStarted} id="ap-reason" />
				<button class="btn" type="submit">{t('common.add')}</button>
			</form>
		{/if}
	</section>
</div>

<style>
	.crit {
		border-bottom: 1px solid var(--border);
		padding-bottom: 1rem;
	}
	.crit.inactive {
		opacity: 0.7;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.list li {
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
	}
	.list input[name='reason'] {
		max-width: 14rem;
	}
</style>

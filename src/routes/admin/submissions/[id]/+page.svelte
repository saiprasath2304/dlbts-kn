<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import ConfirmForm from '#lib/components/ConfirmForm.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { formatMark, participantTotal } from '#lib/scoring.ts';
	import { isSubmitted } from '#lib/status.ts';

	let { data, form } = $props();
	const s = $derived(data.sub);
	const mark = (p: string, c: string) =>
		data.scores.find((x) => x.participant_id === p && x.criterion_id === c)?.value ?? null;
	const totalFor = (p: string) => {
		const m: Record<string, number | null> = {};
		for (const c of data.criteria) m[c.id] = mark(p, c.id);
		return participantTotal(data.criteria, m);
	};
	const pName = (id: string | null) => data.participants.find((p) => p.id === id)?.name ?? '';
	const cName = (id: string) => data.allCriteria.find((c) => c.id === id)?.name ?? id;
	const locked = $derived(isSubmitted(s.status) || s.status === 'reopening_requested');
</script>

<svelte:head><title>{t('admin.submissions.title')}</title></svelte:head>

<div class="stack">
	<a href="/admin/submissions?event={s.event_id}">← {t('admin.submissions.title')}</a>
	<div class="row between">
		<div>
			<div class="muted">{s.events?.groups?.name} – {s.events?.name}</div>
			<h1 style="margin: 0">
				{s.profiles?.display_name} <span class="mono small">{s.profiles?.username}</span>
			</h1>
		</div>
		<StatusBadge status={s.status} />
	</div>
	<Flash {form} />
	{#if data.missing > 0}<div class="alert warning">
			{t('admin.submissions.missing', { n: data.missing })}
		</div>{/if}

	<div class="row">
		{#if locked}
			<ConfirmForm
				action="?/reopen"
				label={t('admin.submissions.reopen')}
				title={t('admin.submissions.reopen')}
				requireReason
			/>
		{/if}
	</div>

	<section class="stack">
		<h2>{t('admin.submissions.details')}</h2>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>{t('common.participant')}</th>
						{#each data.criteria as c (c.id)}<th class="num"
								>{c.name}<br /><span class="small muted">/ {formatMark(c.max_marks)}</span></th
							>{/each}
						<th class="num">{t('score.total')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.participants as p (p.id)}
						{@const tot = totalFor(p.id)}
						<tr>
							<td><strong>{p.name}</strong><br /><span class="mono small">{p.code}</span></td>
							{#each data.criteria as c (c.id)}
								{@const v = mark(p.id, c.id)}
								<td class="num"
									>{#if v === null}<span class="badge danger">–</span>{:else}{formatMark(
											v
										)}{/if}</td
								>
							{/each}
							<td class="num"><strong>{formatMark(tot.total)}</strong></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<div class="grid">
		<section class="card stack">
			<h2>{t('admin.submissions.edit_score')}</h2>
			<form method="POST" action="?/setScore" use:enhance class="stack">
				<div>
					<label for="es-p">{t('common.participant')}</label>
					<select id="es-p" name="participant_id" required>
						{#each data.participants as p (p.id)}<option value={p.id}>{p.code} – {p.name}</option
							>{/each}
					</select>
				</div>
				<div>
					<label for="es-c">{t('judge.criteria')}</label>
					<select id="es-c" name="criterion_id" required>
						{#each data.criteria as c (c.id)}<option value={c.id}
								>{c.name} (/ {formatMark(c.max_marks)})</option
							>{/each}
					</select>
				</div>
				<div>
					<label for="es-v">{t('admin.criteria.max')}</label><input
						id="es-v"
						name="value"
						inputmode="decimal"
						required
					/>
				</div>
				<div>
					<label for="es-r">{t('common.reason')}</label><textarea
						id="es-r"
						name="reason"
						required
						minlength="3"></textarea>
				</div>
				<button class="btn" type="submit">{t('common.save')}</button>
			</form>
		</section>

		<section class="card stack">
			<h2>{t('admin.requests.new_correction')}</h2>
			<form method="POST" action="?/correction" use:enhance class="stack">
				<div>
					<label for="cr-p">{t('admin.requests.participant_optional')}</label>
					<select id="cr-p" name="participant_id">
						<option value="">{t('common.all')}</option>
						{#each data.participants as p (p.id)}<option value={p.id}>{p.code} – {p.name}</option
							>{/each}
					</select>
				</div>
				<fieldset>
					<legend>{t('admin.requests.criteria_optional')}</legend>
					{#each data.criteria as c (c.id)}
						<label class="checkbox"
							><input type="checkbox" name="criterion_ids" value={c.id} /> {c.name}</label
						>
					{/each}
				</fieldset>
				<div>
					<label for="cr-m">{t('admin.requests.message')}</label><textarea
						id="cr-m"
						name="message"
						required
						minlength="3"></textarea>
				</div>
				<label class="checkbox"
					><input type="checkbox" name="unlock" checked /> {t('admin.requests.unlock')}</label
				>
				<button class="btn" type="submit">{t('admin.submissions.request_correction')}</button>
			</form>
		</section>
	</div>

	{#if data.corrections.length || data.reopenings.length}
		<section class="card stack">
			<h2>{t('nav.requests')}</h2>
			<ul>
				{#each data.reopenings as r (r.id)}
					<li>
						{formatDateTime(locale(), r.created_at)} – {t('request.reopen_title')}: “{r.reason}” –
						<strong>{t(`request.${r.status}`)}</strong>{#if r.resolution_note}
							({r.resolution_note}){/if}
					</li>
				{/each}
				{#each data.corrections as c (c.id)}
					<li>
						{formatDateTime(locale(), c.created_at)} – {t('admin.submissions.request_correction')}:
						“{c.message}”
						{#if c.participant_id}({pName(c.participant_id)}){/if}
						{#if c.criterion_ids.length}[{c.criterion_ids.map(cName).join(', ')}]{/if}
						– <strong>{t(`request.${c.status}`)}</strong>
						{#if c.judge_response}<br /><em
								>{t('admin.requests.judge_reply')}: {c.judge_response}</em
							>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="card stack">
		<h2>{t('request.history')}</h2>
		<ul>
			{#each data.transitions as tr (tr.id)}
				<li class="small">
					{formatDateTime(locale(), tr.created_at)}:
					{tr.from_status ? t(`status.${tr.from_status}`) : '–'} →
					<strong>{t(`status.${tr.to_status}`)}</strong>
					{#if tr.reason}
						– “{tr.reason}”{/if}
				</li>
			{/each}
		</ul>
		{#if data.rounds.length}
			<p class="small">
				{data.rounds
					.map(
						(r) =>
							`${t('submit.round', { n: r.round })}: ${formatDateTime(locale(), r.submitted_at)}`
					)
					.join(' · ')}
			</p>
		{/if}
		<details>
			<summary>{t('admin.audit.details')} ({data.history.length})</summary>
			<ul class="small">
				{#each data.history as h (h.id)}
					<li>
						{formatDateTime(locale(), h.changed_at)} – {pName(h.participant_id)} / {cName(
							h.criterion_id
						)}:
						{h.old_value ?? '–'} → {h.new_value ?? '–'} ({h.source}){#if h.reason}
							– “{h.reason}”{/if}
					</li>
				{/each}
			</ul>
		</details>
	</section>
</div>

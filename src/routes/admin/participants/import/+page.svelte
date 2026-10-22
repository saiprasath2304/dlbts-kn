<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n/t.svelte.ts';
	import { toCsv, type RowError } from '#lib/import/participants.ts';

	let { form } = $props();
	let busy = $state(false);

	const errors = $derived((form?.errors ?? []) as RowError[]);
	const rows = $derived(form && 'rows' in form ? (form.rows ?? []) : []);
	const scored = $derived(form && 'scoredEvents' in form ? (form.scoredEvents ?? []) : []);

	const problem = (e: RowError) =>
		t(`import.err.${e.code}`, {
			...(e.params ?? {}),
			columns: String(e.params?.columns ?? ''),
			max: String(e.params?.max ?? '')
		});

	function downloadErrors() {
		const csv = toCsv(
			['row', 'field', 'value', 'problem'],
			errors.map((e) => [e.row, e.field ?? '', e.value ?? '', problem(e)])
		);
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const a = Object.assign(document.createElement('a'), {
			href: url,
			download: 'import-errors.csv'
		});
		a.click();
		URL.revokeObjectURL(url);
	}

	const busyEnhance = () => {
		busy = true;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			busy = false;
			await update({ reset: false });
		};
	};
</script>

<svelte:head><title>{t('admin.import.title')}</title></svelte:head>

<div class="stack">
	<a href="/admin/participants">← {t('admin.participants.title')}</a>
	<h1>{t('admin.import.title')}</h1>
	<div class="card stack">
		<p>{t('admin.import.help')}</p>
		<p class="mono small">{t('admin.import.columns')}</p>
		<div class="row">
			<a class="btn ghost small" href="/admin/participants/import/template?format=csv" download
				>{t('admin.import.template')} (CSV)</a
			>
			<a class="btn ghost small" href="/admin/participants/import/template?format=xlsx" download
				>{t('admin.import.template')} (Excel)</a
			>
		</div>
		<form
			method="POST"
			action="?/preview"
			enctype="multipart/form-data"
			use:enhance={busyEnhance}
			class="stack"
		>
			<label for="file">{t('admin.import.file')}</label>
			<input
				id="file"
				name="file"
				type="file"
				accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
				required
			/>
			<button class="btn" type="submit" disabled={busy}>{t('admin.import.preview')}</button>
		</form>
	</div>

	{#if form?.success}
		<div class="alert success" role="status" data-testid="import-success">{form.success}</div>
	{/if}
	{#if form && 'error' in form && form.error}
		<div class="alert error" role="alert">{form.error}</div>
	{/if}

	{#if errors.length}
		<section class="card stack" data-testid="import-errors">
			<div class="row between">
				<h2>{t('admin.import.rows_error', { n: errors.length })}</h2>
				<button class="btn secondary small" type="button" onclick={downloadErrors}
					>{t('admin.import.download_errors')}</button
				>
			</div>
			<p class="alert warning">{t('admin.import.blocked')}</p>
			<div class="table-wrap">
				<table>
					<thead
						><tr
							><th>{t('admin.import.row')}</th><th>{t('common.code')}</th><th
								>{t('admin.import.problem')}</th
							></tr
						></thead
					>
					<tbody>
						{#each errors as e, i (i)}
							<tr
								><td>{e.row || '–'}</td><td class="mono">{e.value ?? ''}</td><td>{problem(e)}</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{:else if rows.length}
		<section class="card stack" data-testid="import-preview">
			<h2>{t('admin.import.rows_ok', { n: rows.length })}</h2>
			<div class="table-wrap">
				<table>
					<thead>
						<tr
							><th>{t('admin.import.row')}</th><th>{t('common.code')}</th><th>{t('common.name')}</th
							><th>{t('common.group')}</th><th>{t('common.event')}</th><th
								>{t('admin.participants.kind')}</th
							></tr
						>
					</thead>
					<tbody>
						{#each rows.slice(0, 200) as r (r.row)}
							<tr
								><td>{r.row}</td><td class="mono">{r.code}</td><td>{r.name}</td><td
									>{r.group_code}</td
								><td>{r.event_code}</td><td>{r.kind}</td></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
			<form method="POST" action="?/confirm" use:enhance={busyEnhance} class="stack">
				<input type="hidden" name="rows" value={JSON.stringify(rows)} />
				<input
					type="hidden"
					name="file_name"
					value={form && 'fileName' in form ? form.fileName : ''}
				/>
				{#if scored.length}
					<div class="alert warning stack">
						<strong>{t('common.confirm_reason_title')}</strong>
						<p>{scored.join(', ')}</p>
						<label for="imp-reason">{t('common.reason')}</label>
						<textarea id="imp-reason" name="reason" required minlength="3"></textarea>
					</div>
				{/if}
				<button class="btn large" type="submit" disabled={busy}
					>{t('admin.import.confirm', { n: rows.length })}</button
				>
			</form>
		</section>
	{/if}
</div>

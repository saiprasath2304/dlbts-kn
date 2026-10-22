<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';

	let { data, form } = $props();
	let kind = $state<'final' | 'progress'>('final');
	let reportLocale = $state<'en' | 'ta'>(locale());
	let breakdown = $state(false);
	let previewUrl = $state<string | null>(null);
	let busy = $state(false);

	const query = $derived(
		new URLSearchParams({ kind, locale: reportLocale, breakdown: breakdown ? '1' : '0' }).toString()
	);
	const tone = (s: string) =>
		s === 'sent' ? 'success' : s === 'failed' ? 'danger' : s === 'pending' ? 'warning' : 'neutral';
</script>

<svelte:head><title>{t('admin.reports.title')}</title></svelte:head>

<div class="stack">
	<h1>{t('admin.reports.title')}</h1>
	<Flash {form} />

	<form
		method="POST"
		action="?/email"
		class="card stack"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update();
			};
		}}
	>
		<fieldset>
			<legend>{t('common.status')}</legend>
			<label class="checkbox"
				><input type="radio" name="kind" value="final" bind:group={kind} />
				<span
					><strong>{t('admin.reports.final')}</strong><br /><span class="small muted"
						>{t('admin.reports.final_help')}</span
					></span
				></label
			>
			<label class="checkbox"
				><input type="radio" name="kind" value="progress" bind:group={kind} />
				<span
					><strong>{t('admin.reports.progress')}</strong><br /><span class="small muted"
						>{t('admin.reports.progress_help')}</span
					></span
				></label
			>
		</fieldset>
		<div class="form-grid">
			<div>
				<label for="r-locale">{t('admin.reports.language')}</label>
				<select id="r-locale" name="locale" bind:value={reportLocale}>
					<option value="en">English</option>
					<option value="ta">தமிழ்</option>
				</select>
			</div>
			{#if kind === 'final'}
				<label class="checkbox"
					><input type="checkbox" name="breakdown" bind:checked={breakdown} />
					{t('admin.reports.breakdown')}</label
				>
			{/if}
		</div>
		<input type="hidden" name="idempotency_key" value={data.idempotencyKey} />
		<div class="row">
			<button
				class="btn secondary"
				type="button"
				onclick={() =>
					(previewUrl = `/admin/reports/pdf?${query}&disposition=inline&t=${Date.now()}`)}
				>{t('admin.reports.preview')}</button
			>
			<a class="btn" href="/admin/reports/pdf?{query}" download data-testid="download-pdf"
				>{t('admin.reports.download')}</a
			>
			{#if data.emailConfigured}
				<button class="btn secondary" type="submit" disabled={busy}
					>{t('admin.reports.email')} ({data.recipient})</button
				>
			{/if}
		</div>
		{#if !data.emailConfigured}<p class="help">{t('admin.reports.email_not_configured')}</p>{/if}
	</form>

	{#if previewUrl}
		<iframe class="preview" src={previewUrl} title={t('admin.reports.preview')}></iframe>
	{/if}

	<section class="stack">
		<h2>{t('admin.reports.history')}</h2>
		<div class="table-wrap">
			<table>
				<thead
					><tr
						><th>{t('common.date')}</th><th>{t('common.status')}</th><th
							>{t('admin.audit.actor')}</th
						><th>Email</th><th></th></tr
					></thead
				>
				<tbody>
					{#each data.history as h (h.id)}
						<tr>
							<td class="small">{formatDateTime(locale(), h.generated_at)}</td>
							<td
								>{h.kind === 'final' ? t('admin.reports.final') : t('admin.reports.progress')} · {h.locale}{h.include_breakdown
									? ' · +'
									: ''}</td
							>
							<td class="small">{h.profiles?.display_name}</td>
							<td>
								<span class="badge {tone(h.email_status)}">{h.email_status}</span>
								{#if h.email_recipient_masked}<span class="small">{h.email_recipient_masked}</span
									>{/if}
								{#if h.email_last_error}<div class="small muted">{h.email_last_error}</div>{/if}
							</td>
							<td>
								{#if data.emailConfigured && h.email_status !== 'not_requested'}
									<form method="POST" action="?/resend" use:enhance>
										<input type="hidden" name="id" value={h.id} />
										<button class="btn small ghost" type="submit"
											>{t('admin.reports.resend')}</button
										>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

<style>
	.preview {
		width: 100%;
		height: 80vh;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: #fff;
	}
</style>

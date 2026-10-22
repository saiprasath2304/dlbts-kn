<script lang="ts">
	import Flash from '#lib/components/Flash.svelte';
	import ConfirmForm from '#lib/components/ConfirmForm.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';

	let { data, form } = $props();
	const pendingReopen = $derived(data.reopenings.filter((r) => r.status === 'pending'));
	const openCorr = $derived(
		data.corrections.filter((c) => c.status === 'open' || c.status === 'responded')
	);
	const closed = $derived(
		[
			...data.reopenings
				.filter((r) => r.status !== 'pending')
				.map((r) => ({ kind: 'reopen' as const, at: r.resolved_at ?? r.created_at, r })),
			...data.corrections
				.filter((c) => c.status === 'resolved' || c.status === 'cancelled')
				.map((c) => ({ kind: 'corr' as const, at: c.resolved_at ?? c.created_at, c }))
		].sort((a, b) => b.at.localeCompare(a.at))
	);
</script>

<svelte:head><title>{t('admin.requests.title')}</title></svelte:head>

<div class="stack">
	<h1>{t('admin.requests.title')}</h1>
	<Flash {form} />

	<section class="stack">
		<h2>{t('admin.requests.reopening')} ({pendingReopen.length})</h2>
		{#if pendingReopen.length === 0}<p class="muted">{t('admin.requests.none')}</p>{/if}
		{#each pendingReopen as r (r.id)}
			<article class="card stack" data-testid="reopen-request">
				<div>
					<strong>{r.submissions?.profiles?.display_name}</strong> ({r.submissions?.profiles
						?.username}) –
					{r.submissions?.events?.groups?.name} / {r.submissions?.events?.name}
				</div>
				<p>“{r.reason}”</p>
				<p class="small muted">{formatDateTime(locale(), r.created_at)}</p>
				<div class="row">
					<ConfirmForm
						action="?/resolveReopen"
						label={t('admin.requests.approve')}
						title={t('admin.requests.approve')}
						reasonLabel={t('common.note_optional')}
						buttonClass="btn"
					>
						{#snippet fields()}<input type="hidden" name="id" value={r.id} /><input
								type="hidden"
								name="approve"
								value="true"
							/>{/snippet}
					</ConfirmForm>
					<ConfirmForm
						action="?/resolveReopen"
						label={t('admin.requests.reject')}
						title={t('admin.requests.reject')}
						requireReason
						danger
						buttonClass="btn ghost"
					>
						{#snippet fields()}<input type="hidden" name="id" value={r.id} /><input
								type="hidden"
								name="approve"
								value="false"
							/>{/snippet}
					</ConfirmForm>
					<a class="btn ghost" href="/admin/submissions/{r.submission_id}">{t('common.open')}</a>
				</div>
			</article>
		{/each}
	</section>

	<section class="stack">
		<h2>{t('admin.requests.corrections')} ({openCorr.length})</h2>
		{#if openCorr.length === 0}<p class="muted">{t('admin.requests.none')}</p>{/if}
		{#each openCorr as c (c.id)}
			<article class="card stack">
				<div class="row between">
					<div>
						<strong>{c.submissions?.profiles?.display_name}</strong> – {c.submissions?.events
							?.groups?.name} / {c.submissions?.events?.name}
						{#if c.participants}
							· {c.participants.name} ({c.participants.code}){/if}
					</div>
					<span class="badge {c.status === 'responded' ? 'info' : 'warning'}"
						>{t(`request.${c.status}`)}</span
					>
				</div>
				<p>“{c.message}”</p>
				{#if c.judge_response}<p>
						<strong>{t('admin.requests.judge_reply')}:</strong>
						{c.judge_response}
					</p>{/if}
				<div class="row">
					<ConfirmForm
						action="?/resolveCorrection"
						label={t('admin.requests.resolve')}
						title={t('admin.requests.resolve')}
						buttonClass="btn"
					>
						{#snippet fields()}<input type="hidden" name="id" value={c.id} /><input
								type="hidden"
								name="cancel"
								value="false"
							/>{/snippet}
					</ConfirmForm>
					<ConfirmForm
						action="?/resolveCorrection"
						label={t('admin.requests.cancel')}
						title={t('admin.requests.cancel')}
						buttonClass="btn ghost"
					>
						{#snippet fields()}<input type="hidden" name="id" value={c.id} /><input
								type="hidden"
								name="cancel"
								value="true"
							/>{/snippet}
					</ConfirmForm>
					<a class="btn ghost" href="/admin/submissions/{c.submission_id}">{t('common.open')}</a>
				</div>
			</article>
		{/each}
	</section>

	<details class="card">
		<summary><strong>{t('request.history')}</strong> ({closed.length})</summary>
		<ul class="small">
			{#each closed as item, i (i)}
				{#if item.kind === 'reopen'}
					<li>
						{formatDateTime(locale(), item.at)} – {item.r.submissions?.profiles?.display_name}, {item
							.r.submissions?.events?.name}: {t('request.reopen_title')} “{item.r.reason}” →
						<strong>{t(`request.${item.r.status}`)}</strong>{#if item.r.resolution_note}
							({item.r.resolution_note}){/if}
					</li>
				{:else}
					<li>
						{formatDateTime(locale(), item.at)} – {item.c.submissions?.profiles?.display_name}, {item
							.c.submissions?.events?.name}: “{item.c.message}” →
						<strong>{t(`request.${item.c.status}`)}</strong>
					</li>
				{/if}
			{/each}
		</ul>
	</details>
</div>

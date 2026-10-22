<script lang="ts">
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatTime } from '#lib/i18n/index.ts';
	import type { SaveState } from '#lib/offline/score-sync.svelte.ts';

	let {
		state,
		lastSavedAt,
		pending,
		onretry
	}: { state: SaveState; lastSavedAt: string | null; pending: number; onretry?: () => void } =
		$props();

	const tone = $derived(
		state === 'offline' || state === 'error' || state === 'locked' || state === 'session'
			? 'warning'
			: state === 'saving'
				? 'info'
				: 'success'
	);
</script>

<div
	class="save alert {tone}"
	role="status"
	aria-live="polite"
	data-testid="save-status"
	data-state={state}
>
	<span class="dot" aria-hidden="true"></span>
	<span class="msg">
		{#if state === 'saving'}
			{t('save.saving')}
		{:else if state === 'offline'}
			{t('save.offline')}
		{:else if state === 'error'}
			{t('save.failed')}
		{:else if state === 'locked'}
			{t('save.locked_error')}
		{:else if state === 'session'}
			{t('error.session')} <a href="/login">{t('login.submit')}</a>
		{:else if lastSavedAt}
			{t('save.saved_at', { time: formatTime(locale(), lastSavedAt) })}
		{:else}
			{t('save.saved')}
		{/if}
		{#if pending > 0 && state !== 'saving'}
			<br /><span class="small">{t('save.pending', { n: pending })}</span>
		{/if}
	</span>
	{#if (state === 'error' || state === 'offline') && onretry}
		<button type="button" class="btn small secondary" onclick={onretry}
			>{t('save.retry_now')}</button
		>
	{/if}
</div>

<style>
	.save {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		padding: 0.6rem 0.85rem;
	}
	.msg {
		flex: 1;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: currentColor;
		flex: none;
	}
</style>

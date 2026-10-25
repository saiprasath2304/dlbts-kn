<script lang="ts">
	import CloudCheck from '@lucide/svelte/icons/cloud-check';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Lock from '@lucide/svelte/icons/lock';
	import { Button } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils.js';
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

	const problem = $derived(
		state === 'offline' || state === 'error' || state === 'locked' || state === 'session'
	);
</script>

<div
	class={cn(
		'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[0.95rem] font-medium shadow-xs',
		problem
			? 'border-warning/50 bg-warning/15 text-warning-foreground'
			: state === 'saving'
				? 'border-chart-2/25 bg-chart-2/8 text-chart-2'
				: 'border-success/30 bg-success/8 text-success'
	)}
	role="status"
	aria-live="polite"
	data-testid="save-status"
	data-state={state}
>
	{#if state === 'saving'}
		<Loader class="size-5 shrink-0 animate-spin" />
	{:else if state === 'offline'}
		<CloudOff class="size-5 shrink-0" />
	{:else if state === 'locked'}
		<Lock class="size-5 shrink-0" />
	{:else if problem}
		<TriangleAlert class="size-5 shrink-0" />
	{:else}
		<CloudCheck class="size-5 shrink-0" />
	{/if}
	<span class="flex-1">
		{#if state === 'saving'}
			{t('save.saving')}
		{:else if state === 'offline'}
			{t('save.offline')}
		{:else if state === 'error'}
			{t('save.failed')}
		{:else if state === 'locked'}
			{t('save.locked_error')}
		{:else if state === 'session'}
			{t('error.session')} <a class="underline" href="/login">{t('login.submit')}</a>
		{:else if lastSavedAt}
			{t('save.saved_at', { time: formatTime(locale(), lastSavedAt) })}
		{:else}
			{t('save.saved')}
		{/if}
		{#if pending > 0 && state !== 'saving'}
			<span class="block text-sm opacity-90">{t('save.pending', { n: pending })}</span>
		{/if}
	</span>
	{#if (state === 'error' || state === 'offline') && onretry}
		<Button size="sm" variant="outline" onclick={onretry}>{t('save.retry_now')}</Button>
	{/if}
</div>

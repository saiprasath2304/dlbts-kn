<script lang="ts">
	import { cn } from '#lib/utils.js';

	let {
		label,
		value,
		of,
		hint,
		href,
		highlight = false
	}: {
		label: string;
		value: number | string;
		of?: number;
		hint?: string;
		href?: string;
		highlight?: boolean;
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class={cn(
		'bg-card block rounded-xl border p-4 transition-colors',
		href && 'hover:bg-muted/50',
		highlight && 'border-warning/60 bg-warning/5'
	)}
>
	<p class="text-muted-foreground text-sm">{label}</p>
	<p class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
		{value}{#if of !== undefined}<span class="text-muted-foreground text-base font-normal">
				/ {of}</span
			>{/if}
	</p>
	{#if hint}<p class="text-muted-foreground mt-0.5 text-xs">{hint}</p>{/if}
</svelte:element>

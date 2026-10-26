<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		eyebrow,
		description,
		actions
	}: { title: string; eyebrow?: string; description?: string; actions?: Snippet } = $props();
</script>

<div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
	<div class="min-w-0 space-y-1">
		{#if eyebrow}<p class="text-muted-foreground text-sm">{eyebrow}</p>{/if}
		<h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
		{#if description}<p class="text-muted-foreground text-sm">{description}</p>{/if}
	</div>
	{#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
</div>

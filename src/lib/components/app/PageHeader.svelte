<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		eyebrow,
		description,
		actions
	}: { title: string; eyebrow?: string; description?: string; actions?: Snippet } = $props();
</script>

<div class="flex flex-wrap items-end justify-between gap-3">
	<div class="min-w-0">
		{#if eyebrow}<p class="text-muted-foreground text-sm font-medium">{eyebrow}</p>{/if}
		<h1 class="text-2xl font-bold tracking-tight">{title}</h1>
		{#if description}<p class="text-muted-foreground mt-1">{description}</p>{/if}
	</div>
	{#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
</div>

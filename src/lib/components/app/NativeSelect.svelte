<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils.js';

	let { class: className, value = $bindable(), children, ...rest }: HTMLSelectAttributes = $props();
</script>

<!-- Native select: the phone's own picker is the easiest for older users. -->
<select
	bind:value
	class={cn(
		'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border px-3 text-base shadow-xs outline-none focus-visible:ring-3 disabled:opacity-50',
		className
	)}
	{...rest}
>
	{@render children?.()}
</select>

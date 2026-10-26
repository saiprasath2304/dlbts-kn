<script lang="ts">
	import { navigating } from '$app/state';
	import { progress } from '#lib/progress.svelte.ts';

	const busy = $derived(!!navigating.to || progress.forms > 0);
</script>

{#if busy}
	<div
		class="bg-primary/15 fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
		role="progressbar"
		aria-busy="true"
		aria-label="Loading"
	>
		<div
			class="bg-primary h-full w-2/5 rounded-full"
			style="animation: nav-progress 0.9s ease-in-out infinite"
		></div>
	</div>
{/if}

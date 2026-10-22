<script lang="ts">
	import Scoring from './Scoring.svelte';

	let { data, form } = $props();
</script>

{#key data.event.id}
	<Scoring {data} {form} />
{/key}

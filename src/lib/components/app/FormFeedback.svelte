<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import * as Alert from '#lib/components/ui/alert/index.js';

	let { form }: { form: { error?: string; success?: string } | null | undefined } = $props();
</script>

{#if form?.error}
	<Alert.Root variant="destructive" role="alert">
		<CircleAlert />
		<Alert.Title>{form.error}</Alert.Title>
	</Alert.Root>
{:else if form?.success}
	<Alert.Root variant="success" role="status">
		<CircleCheck />
		<Alert.Title>{form.success}</Alert.Title>
	</Alert.Root>
{/if}

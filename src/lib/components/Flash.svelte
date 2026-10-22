<script lang="ts">
	let { form }: { form: { error?: string; success?: string } | null | undefined } = $props();
</script>

{#if form?.error}
	<div class="alert error" role="alert">{form.error}</div>
{:else if form?.success}
	<div class="alert success" role="status">{form.success}</div>
{/if}

<script lang="ts">
	import { statusTone } from '#lib/status.ts';
	import { t } from '#lib/i18n/t.svelte.ts';
	import type { SubmissionStatus } from '#lib/types.ts';

	let { status }: { status: SubmissionStatus } = $props();
</script>

<span class="badge {statusTone(status)}">{t(`status.${status}`)}</span>

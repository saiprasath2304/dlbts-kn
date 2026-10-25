<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { statusTone } from '#lib/status.ts';
	import { t } from '#lib/i18n/t.svelte.ts';
	import type { SubmissionStatus } from '#lib/types.ts';

	let { status }: { status: SubmissionStatus } = $props();
	const variant = $derived(
		(
			{
				success: 'success',
				info: 'info',
				warning: 'warning',
				danger: 'destructive',
				neutral: 'neutral'
			} as const
		)[statusTone(status)]
	);
</script>

<Badge {variant} class="text-sm">{t(`status.${status}`)}</Badge>

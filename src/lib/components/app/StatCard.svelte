<script lang="ts">
	import type { Component } from 'svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import { cn } from '#lib/utils.js';

	let {
		label,
		value,
		of,
		icon: Icon,
		href,
		tone = 'default'
	}: {
		label: string;
		value: number | string;
		of?: number;
		icon: Component;
		href?: string;
		tone?: 'default' | 'warning';
	} = $props();
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class={cn('block rounded-xl no-underline', href && 'hover:ring-primary/30 hover:ring-2')}
>
	<Card.Root class="h-full gap-2 py-4">
		<Card.Content class="flex-row items-start justify-between gap-3 px-4">
			<div>
				<div class="text-3xl font-bold tabular-nums">
					{value}{#if of !== undefined}<span class="text-muted-foreground text-lg font-semibold">
							/ {of}</span
						>{/if}
				</div>
				<div class="text-muted-foreground mt-1 text-sm">{label}</div>
			</div>
			<span
				class={cn(
					'grid size-10 place-items-center rounded-lg',
					tone === 'warning' ? 'bg-warning/20 text-warning-foreground' : 'bg-secondary text-primary'
				)}
			>
				<Icon class="size-5" />
			</span>
		</Card.Content>
	</Card.Root>
</svelte:element>

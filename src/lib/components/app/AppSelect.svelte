<script lang="ts" module>
	export type Option = { value: string; label: string; group?: string };
</script>

<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import { cn } from '#lib/utils.js';
	import { t } from '#lib/i18n/t.svelte.ts';

	let {
		id,
		name,
		value = $bindable(''),
		options,
		placeholder = '',
		disabled = false,
		searchable,
		onValueChange,
		class: className
	}: {
		id?: string;
		name?: string;
		value?: string;
		options: Option[];
		placeholder?: string;
		disabled?: boolean;
		/** Defaults to true when there are more than 8 options. */
		searchable?: boolean;
		onValueChange?: (value: string) => void;
		class?: string;
	} = $props();

	let open = $state(false);
	const showSearch = $derived(searchable ?? options.length > 8);
	const selected = $derived(options.find((o) => o.value === value));
	const sections = $derived.by(() => {
		const out: { group?: string; items: Option[] }[] = [];
		for (const o of options) {
			const last = out[out.length - 1];
			if (last && last.group === o.group) last.items.push(o);
			else out.push({ group: o.group, items: [o] });
		}
		return out;
	});

	function choose(v: string) {
		value = v;
		open = false;
		onValueChange?.(v);
	}
</script>

{#if name}<input type="hidden" {name} {value} />{/if}
<Popover.Root bind:open>
	<Popover.Trigger
		{id}
		{disabled}
		role="combobox"
		aria-expanded={open}
		class={cn(
			'border-input bg-background hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-[0.95rem] shadow-xs outline-none focus-visible:ring-3 disabled:opacity-50',
			className
		)}
	>
		<span class={cn('truncate', !selected && 'text-muted-foreground')}
			>{selected?.label ?? placeholder}</span
		>
		<ChevronsUpDown class="text-muted-foreground size-4 shrink-0" />
	</Popover.Trigger>
	<Popover.Content class="w-(--bits-popover-anchor-width) min-w-64 p-0" align="start">
		<Command.Root>
			{#if showSearch}
				<Command.Input placeholder={t('common.search_placeholder')} class="h-10 text-base" />
			{/if}
			<Command.List class="max-h-[min(55vh,22rem)]">
				<Command.Empty>{t('common.no_results')}</Command.Empty>
				{#each sections as section, i (i)}
					<Command.Group heading={section.group}>
						{#each section.items as o (o.value)}
							<Command.Item
								value={`${o.label} ${o.group ?? ''} ${o.value}`}
								onSelect={() => choose(o.value)}
								class="py-2.5 text-[0.95rem]"
							>
								<Check class={cn('size-4', o.value === value ? 'opacity-100' : 'opacity-0')} />
								<span class="truncate">{o.label}</span>
							</Command.Item>
						{/each}
					</Command.Group>
				{/each}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>

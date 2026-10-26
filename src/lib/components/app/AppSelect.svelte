<script lang="ts" module>
	export type Option = { value: string; label: string; group?: string };
</script>

<script lang="ts">
	import * as Select from '#lib/components/ui/select/index.js';
	import { cn } from '#lib/utils.js';

	let {
		id,
		name,
		value = $bindable(''),
		options,
		placeholder = '',
		disabled = false,
		onValueChange,
		class: className
	}: {
		id?: string;
		name?: string;
		value?: string;
		options: Option[];
		placeholder?: string;
		disabled?: boolean;
		onValueChange?: (value: string) => void;
		class?: string;
	} = $props();

	// bits-ui treats "" as "nothing selected", but "" is a real choice here ("All"),
	// so map it to a sentinel internally and submit the real value via a hidden input.
	const EMPTY = '__empty__';
	const toInner = (v: string) => (v === '' ? EMPTY : v);
	const toOuter = (v: string) => (v === EMPTY ? '' : v);

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
</script>

{#if name}<input type="hidden" {name} {value} />{/if}
<Select.Root
	type="single"
	value={toInner(value)}
	onValueChange={(v) => {
		value = toOuter(v);
		onValueChange?.(value);
	}}
	{disabled}
>
	<Select.Trigger {id} class={cn('h-10 w-full bg-background text-[0.95rem]', className)}>
		<span class={cn('truncate', !selected && 'text-muted-foreground')}
			>{selected?.label ?? placeholder}</span
		>
	</Select.Trigger>
	<Select.Content class="max-h-[min(60vh,26rem)]">
		{#each sections as section, i (i)}
			{#if section.group}
				<Select.Group>
					<Select.GroupHeading class="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium"
						>{section.group}</Select.GroupHeading
					>
					{#each section.items as o (o.value)}
						<Select.Item value={toInner(o.value)} label={o.label} class="py-2.5 text-[0.95rem]" />
					{/each}
				</Select.Group>
			{:else}
				{#each section.items as o (o.value)}
					<Select.Item value={toInner(o.value)} label={o.label} class="py-2.5 text-[0.95rem]" />
				{/each}
			{/if}
		{/each}
	</Select.Content>
</Select.Root>

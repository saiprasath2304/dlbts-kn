<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import AppSelect from '#lib/components/app/AppSelect.svelte';
	import { groupOptions, eventOptions, all } from '#lib/options.ts';
	import { t } from '#lib/i18n/t.svelte.ts';

	type Status = 'present' | 'absent' | null;
	type Row = (typeof data.participants)[number];

	let { data } = $props();

	let q = $state('');
	let group = $state('');
	let event = $state('');
	let samithi = $state('');
	let show = $state('');

	// Ticks saved this session, on top of what the page loaded.
	let marked = $state<Record<string, Status>>({});
	let saving = $state<Record<string, 'saving' | 'error' | undefined>>({});
	const queue = new Map<string, Promise<void>>();
	const statusOf = (p: Row): Status => (p.id in marked ? marked[p.id] : p.attendance);

	const rows = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return data.participants.filter(
			(p) =>
				(!needle ||
					p.name.toLowerCase().includes(needle) ||
					p.code.toLowerCase().includes(needle) ||
					p.label.toLowerCase().includes(needle)) &&
				(!group || p.group_id === group) &&
				(!event || p.eventIds.includes(event)) &&
				(!samithi || p.affiliation === samithi) &&
				(!show || (statusOf(p) ?? 'unmarked') === show)
		);
	});
	const counts = $derived.by(() => {
		const c = { present: 0, absent: 0, unmarked: 0 };
		for (const p of rows) c[statusOf(p) ?? 'unmarked']++;
		return c;
	});

	/** Saves straight away; changes to the same child are sent one after another. */
	function mark(p: Row, status: Status) {
		const before = statusOf(p);
		marked[p.id] = status;
		saving[p.id] = 'saving';
		const run = (queue.get(p.id) ?? Promise.resolve()).then(async () => {
			try {
				const res = await fetch('/api/admin/attendance', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ participant_id: p.id, status })
				});
				if (!res.ok) throw new Error(String(res.status));
				if (queue.get(p.id) === run) saving[p.id] = undefined;
			} catch {
				marked[p.id] = before;
				saving[p.id] = 'error';
			}
		});
		queue.set(p.id, run);
	}

	const toggle = (p: Row, status: 'present' | 'absent', on: boolean) => mark(p, on ? status : null);
</script>

<svelte:head><title>{t('attendance.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('attendance.title')} description={t('attendance.help')} />

	<Card.Root>
		<Card.Content class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
			<div class="grid gap-2">
				<Label for="a-q">{t('common.search')}</Label>
				<div class="relative">
					<Search class="text-muted-foreground pointer-events-none absolute top-3 left-3 size-5" />
					<Input
						id="a-q"
						type="search"
						bind:value={q}
						placeholder={t('attendance.search_help')}
						class="pl-10"
					/>
				</div>
			</div>
			<div class="grid gap-2">
				<Label for="a-group">{t('common.group')}</Label>
				<AppSelect
					id="a-group"
					bind:value={group}
					options={[all(t('common.all')), ...groupOptions(data.groups)]}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="a-event">{t('common.event')}</Label>
				<AppSelect
					id="a-event"
					bind:value={event}
					options={[all(t('common.all')), ...eventOptions(data.groups)]}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="a-samithi">{t('admin.participants.affiliation')}</Label>
				<AppSelect
					id="a-samithi"
					bind:value={samithi}
					options={[all(t('common.all')), ...data.samithis.map((s) => ({ value: s, label: s }))]}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="a-show">{t('common.status')}</Label>
				<AppSelect
					id="a-show"
					bind:value={show}
					options={[
						all(t('common.all')),
						{ value: 'present', label: t('attendance.present') },
						{ value: 'absent', label: t('attendance.absent') },
						{ value: 'unmarked', label: t('attendance.unmarked') }
					]}
				/>
			</div>
		</Card.Content>
	</Card.Root>

	<div class="flex flex-wrap gap-2 text-sm" aria-live="polite">
		<Badge variant="success">{t('attendance.present')}: {counts.present}</Badge>
		<Badge variant="destructive">{t('attendance.absent')}: {counts.absent}</Badge>
		<Badge variant="neutral">{t('attendance.unmarked')}: {counts.unmarked}</Badge>
	</div>

	<Card.Root class="py-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{t('common.participant')}</Table.Head>
					<Table.Head class="w-20 text-center">{t('attendance.present')}</Table.Head>
					<Table.Head class="w-20 text-center">{t('attendance.absent')}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each rows as p (p.id)}
					{@const s = statusOf(p)}
					<Table.Row
						class={s === 'present' ? 'bg-success/5' : s === 'absent' ? 'bg-destructive/5' : ''}
					>
						<Table.Cell class="py-3 whitespace-normal">
							<div class="font-semibold">{p.name}</div>
							<div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
								<span class="font-mono text-base font-bold">{t('attendance.id')}: {p.label}</span>
								{#if p.label !== p.code}<span class="text-muted-foreground font-mono text-xs"
										>{p.code}</span
									>{/if}
								{#if p.affiliation}<span class="text-muted-foreground text-xs">{p.affiliation}</span
									>{/if}
								{#if saving[p.id] === 'saving'}
									<LoaderCircle
										class="text-muted-foreground size-3.5 animate-spin"
										aria-label={t('attendance.saving')}
									/>
								{:else if saving[p.id] === 'error'}
									<span class="text-destructive text-xs font-semibold" role="alert"
										>{t('attendance.not_saved')}</span
									>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell class="text-center">
							<Checkbox
								class="size-6"
								aria-label="{t('attendance.present')}: {p.name}"
								bind:checked={() => s === 'present', (v) => toggle(p, 'present', v)}
							/>
						</Table.Cell>
						<Table.Cell class="text-center">
							<Checkbox
								class="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive size-6"
								aria-label="{t('attendance.absent')}: {p.name}"
								bind:checked={() => s === 'absent', (v) => toggle(p, 'absent', v)}
							/>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row
						><Table.Cell colspan={3} class="text-muted-foreground p-6"
							>{t('admin.participants.none')}</Table.Cell
						></Table.Row
					>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>
</div>

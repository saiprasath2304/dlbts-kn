<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet';
	import Download from '@lucide/svelte/icons/download';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';
	import { toCsv, type RowError } from '#lib/import/participants.ts';

	let { form } = $props();
	let busy = $state(false);

	const errors = $derived((form?.errors ?? []) as RowError[]);
	const rows = $derived(form && 'rows' in form ? (form.rows ?? []) : []);
	const scored = $derived(form && 'scoredEvents' in form ? (form.scoredEvents ?? []) : []);

	const problem = (e: RowError) =>
		t(`import.err.${e.code}`, {
			...(e.params ?? {}),
			columns: String(e.params?.columns ?? ''),
			max: String(e.params?.max ?? '')
		});

	function downloadErrors() {
		const csv = toCsv(
			['row', 'field', 'value', 'problem'],
			errors.map((e) => [e.row, e.field ?? '', e.value ?? '', problem(e)])
		);
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const a = Object.assign(document.createElement('a'), {
			href: url,
			download: 'import-errors.csv'
		});
		a.click();
		URL.revokeObjectURL(url);
	}

	const busyEnhance = () => {
		busy = true;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			busy = false;
			await update({ reset: false });
		};
	};
</script>

<svelte:head><title>{t('admin.import.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<div>
		<Button href="/admin/participants" variant="ghost" size="sm" class="-ml-2"
			><ArrowLeft />{t('admin.participants.title')}</Button
		>
	</div>
	<PageHeader title={t('admin.import.title')} description={t('admin.import.help')} />

	<Card.Root>
		<Card.Content class="grid gap-5">
			<div class="bg-muted text-muted-foreground rounded-lg px-4 py-3 font-mono text-sm">
				{t('admin.import.columns')}
			</div>
			<div class="flex flex-wrap gap-2">
				<Button
					href="/admin/participants/import/template?format=csv"
					variant="outline"
					size="sm"
					download><Download />{t('admin.import.template')} (CSV)</Button
				>
				<Button
					href="/admin/participants/import/template?format=xlsx"
					variant="outline"
					size="sm"
					download><Download />{t('admin.import.template')} (Excel)</Button
				>
			</div>
			<form
				method="POST"
				action="?/preview"
				enctype="multipart/form-data"
				use:enhance={busyEnhance}
				class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
			>
				<div class="grid gap-2">
					<Label for="file">{t('admin.import.file')}</Label>
					<Input
						id="file"
						name="file"
						type="file"
						required
						accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
						class="pt-2"
					/>
				</div>
				<Button type="submit" disabled={busy}><FileSpreadsheet />{t('admin.import.preview')}</Button
				>
			</form>
		</Card.Content>
	</Card.Root>

	{#if form?.success}
		<Alert.Root variant="success" role="status" data-testid="import-success"
			><CircleCheck /><Alert.Title>{form.success}</Alert.Title></Alert.Root
		>
	{/if}
	{#if form && 'error' in form && form.error}
		<Alert.Root variant="destructive" role="alert"
			><CircleAlert /><Alert.Title>{form.error}</Alert.Title></Alert.Root
		>
	{/if}

	{#if errors.length}
		<Card.Root class="gap-0 py-0" data-testid="import-errors">
			<Card.Header class="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
				<div>
					<Card.Title class="text-destructive"
						>{t('admin.import.rows_error', { n: errors.length })}</Card.Title
					>
					<Card.Description>{t('admin.import.blocked')}</Card.Description>
				</div>
				<Button variant="outline" size="sm" onclick={downloadErrors}
					><Download />{t('admin.import.download_errors')}</Button
				>
			</Card.Header>
			<Table.Root>
				<Table.Header
					><Table.Row
						><Table.Head>{t('admin.import.row')}</Table.Head><Table.Head
							>{t('common.code')}</Table.Head
						><Table.Head>{t('admin.import.problem')}</Table.Head></Table.Row
					></Table.Header
				>
				<Table.Body>
					{#each errors as e, i (i)}
						<Table.Row>
							<Table.Cell>{e.row || '–'}</Table.Cell>
							<Table.Cell class="font-mono">{e.value ?? ''}</Table.Cell>
							<Table.Cell class="whitespace-normal">{problem(e)}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Root>
	{:else if rows.length}
		<Card.Root class="gap-0 py-0" data-testid="import-preview">
			<Card.Header class="border-b py-4"
				><Card.Title class="text-success"
					>{t('admin.import.rows_ok', { n: rows.length })}</Card.Title
				></Card.Header
			>
			<div class="max-h-[50vh] overflow-auto">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>{t('admin.import.row')}</Table.Head><Table.Head
								>{t('common.code')}</Table.Head
							><Table.Head>{t('common.name')}</Table.Head>
							<Table.Head>{t('common.group')}</Table.Head><Table.Head
								>{t('common.event')}</Table.Head
							><Table.Head>{t('admin.participants.kind')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each rows.slice(0, 200) as r (r.row)}
							<Table.Row>
								<Table.Cell>{r.row}</Table.Cell><Table.Cell class="font-mono">{r.code}</Table.Cell
								><Table.Cell>{r.name}</Table.Cell>
								<Table.Cell>{r.group_code}</Table.Cell><Table.Cell>{r.event_code}</Table.Cell
								><Table.Cell>{r.kind}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
			<form
				method="POST"
				action="?/confirm"
				use:enhance={busyEnhance}
				class="grid gap-4 border-t p-5"
			>
				<input type="hidden" name="rows" value={JSON.stringify(rows)} />
				<input
					type="hidden"
					name="file_name"
					value={form && 'fileName' in form ? form.fileName : ''}
				/>
				{#if scored.length}
					<Alert.Root variant="warning">
						<TriangleAlert />
						<Alert.Title>{t('common.confirm_reason_title')}</Alert.Title>
						<Alert.Description class="w-full">
							<p>{scored.join(', ')}</p>
							<Label for="imp-reason" class="mt-2">{t('common.reason')}</Label>
							<Textarea
								id="imp-reason"
								name="reason"
								required
								minlength={3}
								class="bg-background mt-1"
							/>
						</Alert.Description>
					</Alert.Root>
				{/if}
				<div>
					<Button type="submit" size="lg" disabled={busy}
						>{t('admin.import.confirm', { n: rows.length })}</Button
					>
				</div>
			</form>
		</Card.Root>
	{/if}
</div>

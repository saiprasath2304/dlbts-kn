<script lang="ts">
	import { enhance } from '$app/forms';
	import Eye from '@lucide/svelte/icons/eye';
	import Download from '@lucide/svelte/icons/download';
	import Mail from '@lucide/svelte/icons/mail';
	import Info from '@lucide/svelte/icons/info';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as RadioGroup from '#lib/components/ui/radio-group/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import NativeSelect from '#lib/components/app/NativeSelect.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';

	let { data, form } = $props();
	let kind = $state<'final' | 'progress'>('final');
	let reportLocale = $derived<'en' | 'ta'>(locale());
	let breakdown = $state(false);
	let previewUrl = $state<string | null>(null);
	let busy = $state(false);

	const query = $derived(
		new URLSearchParams({ kind, locale: reportLocale, breakdown: breakdown ? '1' : '0' }).toString()
	);
	const tone = (s: string) =>
		s === 'sent'
			? 'success'
			: s === 'failed'
				? 'destructive'
				: s === 'pending'
					? 'warning'
					: 'neutral';
</script>

<svelte:head><title>{t('admin.reports.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.reports.title')} />
	<FormFeedback {form} />

	<Card.Root>
		<form
			method="POST"
			action="?/email"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					await update();
				};
			}}
		>
			<Card.Content class="grid grid-cols-1 gap-6">
				<RadioGroup.Root bind:value={kind} name="kind" class="grid gap-3 md:grid-cols-2">
					{#each [['final', 'admin.reports.final', 'admin.reports.final_help'], ['progress', 'admin.reports.progress', 'admin.reports.progress_help']] as [value, title, help] (value)}
						<Label
							for="k-{value}"
							class="has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary flex cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal"
						>
							<RadioGroup.Item {value} id="k-{value}" class="mt-1" />
							<span
								><span class="block font-semibold">{t(title)}</span><span
									class="text-muted-foreground text-sm">{t(help)}</span
								></span
							>
						</Label>
					{/each}
				</RadioGroup.Root>
				<div class="flex flex-wrap items-end gap-6">
					<div class="grid w-48 gap-2">
						<Label for="r-locale">{t('admin.reports.language')}</Label>
						<NativeSelect id="r-locale" name="locale" bind:value={reportLocale}>
							<option value="en">English</option>
							<option value="ta">தமிழ்</option>
						</NativeSelect>
					</div>
					{#if kind === 'final'}
						<div class="flex h-11 items-center gap-3">
							<Switch id="r-breakdown" name="breakdown" bind:checked={breakdown} />
							<Label for="r-breakdown">{t('admin.reports.breakdown')}</Label>
						</div>
					{/if}
				</div>
				<input type="hidden" name="idempotency_key" value={data.idempotencyKey} />
			</Card.Content>
			<Card.Footer class="flex flex-wrap gap-2 border-t pt-6">
				<Button
					type="button"
					variant="outline"
					onclick={() =>
						(previewUrl = `/admin/reports/pdf?${query}&disposition=inline&t=${Date.now()}`)}
					><Eye />{t('admin.reports.preview')}</Button
				>
				<Button href="/admin/reports/pdf?{query}" download data-testid="download-pdf"
					><Download />{t('admin.reports.download')}</Button
				>
				{#if data.emailConfigured}
					<Button type="submit" variant="secondary" disabled={busy}
						><Mail />{t('admin.reports.email')} ({data.recipient})</Button
					>
				{/if}
			</Card.Footer>
		</form>
	</Card.Root>

	{#if !data.emailConfigured}
		<Alert.Root variant="info"
			><Info /><Alert.Title>{t('admin.reports.email_not_configured')}</Alert.Title></Alert.Root
		>
	{/if}

	{#if previewUrl}
		<iframe
			class="h-[80vh] w-full rounded-xl border bg-white"
			src={previewUrl}
			title={t('admin.reports.preview')}
		></iframe>
	{/if}

	<Card.Root class="gap-0 py-0">
		<Card.Header class="border-b py-4"
			><Card.Title>{t('admin.reports.history')}</Card.Title></Card.Header
		>
		<Table.Root>
			<Table.Body>
				{#each data.history as h (h.id)}
					<Table.Row>
						<Table.Cell class="text-muted-foreground text-sm"
							>{formatDateTime(locale(), h.generated_at)}</Table.Cell
						>
						<Table.Cell class="whitespace-normal"
							>{h.kind === 'final' ? t('admin.reports.final') : t('admin.reports.progress')} · {h.locale}{h.include_breakdown
								? ' · +'
								: ''}</Table.Cell
						>
						<Table.Cell class="text-sm">{h.profiles?.display_name}</Table.Cell>
						<Table.Cell class="whitespace-normal">
							<Badge variant={tone(h.email_status)}>{h.email_status}</Badge>
							{#if h.email_recipient_masked}<span class="text-sm">{h.email_recipient_masked}</span
								>{/if}
							{#if h.email_last_error}<div class="text-muted-foreground text-xs">
									{h.email_last_error}
								</div>{/if}
						</Table.Cell>
						<Table.Cell class="text-right">
							{#if data.emailConfigured && h.email_status !== 'not_requested'}
								<form method="POST" action="?/resend" use:enhance>
									<input type="hidden" name="id" value={h.id} />
									<Button type="submit" variant="ghost" size="sm"
										>{t('admin.reports.resend')}</Button
									>
								</form>
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>
</div>

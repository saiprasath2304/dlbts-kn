<script lang="ts">
	import { goto } from '$app/navigation';
	import Download from '@lucide/svelte/icons/download';
	import Users from '@lucide/svelte/icons/users';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import AppSelect from '#lib/components/app/AppSelect.svelte';
	import { eventOptions } from '#lib/options.ts';
	import { t, locale } from '#lib/i18n/t.svelte.ts';

	let { data } = $props();
	let marks = $state(false);
	let reportLocale = $derived<'en' | 'ta'>(locale());
	const q = (extra: string) => `${extra}&locale=${reportLocale}${marks ? '&marks=1' : ''}`;
</script>

<svelte:head><title>{t('admin.feedback.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.feedback.title')} description={t('admin.feedback.help')} />

	<Card.Root>
		<Card.Content class="grid gap-4 sm:grid-cols-[2fr_1fr] sm:items-end">
			<div class="grid gap-2">
				<Label for="fb-event">{t('admin.feedback.select_event')}</Label>
				<AppSelect
					id="fb-event"
					value={data.eventId}
					placeholder={t('admin.feedback.select_event')}
					options={eventOptions(data.groups)}
					onValueChange={(v) => goto(`/admin/feedback?event=${v}`, { replace: true })}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="fb-locale">{t('admin.reports.language')}</Label>
				<AppSelect
					id="fb-locale"
					bind:value={reportLocale}
					options={[
						{ value: 'en', label: 'English' },
						{ value: 'ta', label: 'தமிழ்' }
					]}
				/>
			</div>
			<div class="flex items-center gap-3">
				<Switch id="fb-marks" bind:checked={marks} />
				<Label for="fb-marks">{t('admin.feedback.include_marks')}</Label>
			</div>
		</Card.Content>
	</Card.Root>

	{#if data.eventId}
		<Card.Root class="gap-0 py-0">
			<Card.Header class="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
				<Card.Title>{t('admin.events.tab_participants')} · {data.participants.length}</Card.Title>
				<Button href="/admin/feedback/pdf?{q(`event=${data.eventId}`)}" download
					><Download />{t('admin.feedback.download_event')}</Button
				>
			</Card.Header>
			<Table.Root>
				<Table.Body>
					{#each data.participants as p (p.id)}
						<Table.Row>
							<Table.Cell class="py-3 whitespace-normal">
								<div class="font-medium">{p.name}</div>
								<div class="text-muted-foreground text-xs">
									<span class="font-mono">{p.code}</span>
								</div>
							</Table.Cell>
							<Table.Cell>
								{#if p.kind === 'team'}<Badge variant="secondary"><Users />{t('score.team')}</Badge
									>{/if}
							</Table.Cell>
							<Table.Cell>
								<Badge variant={p.remarks ? 'success' : 'neutral'}
									>{t('admin.feedback.remarks_count', { n: p.remarks })}</Badge
								>
							</Table.Cell>
							<Table.Cell class="text-right">
								<Button
									href="/admin/feedback/pdf?{q(`participant=${p.id}`)}"
									variant="ghost"
									size="sm"
									download><Download />{t('admin.feedback.download_one')}</Button
								>
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row
							><Table.Cell class="text-muted-foreground p-6"
								>{t('admin.participants.none')}</Table.Cell
							></Table.Row
						>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Root>
	{/if}
</div>

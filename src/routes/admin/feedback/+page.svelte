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

	/** Query string for the current event/Samithi scope. */
	const scope = (eventId: string, samithi: string) =>
		[eventId && `event=${eventId}`, samithi && `samithi=${encodeURIComponent(samithi)}`]
			.filter(Boolean)
			.join('&');
	const go = (eventId: string, samithi: string) =>
		goto(`/admin/feedback?${scope(eventId, samithi)}`, { replace: true });
</script>

<svelte:head><title>{t('admin.feedback.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.feedback.title')} description={t('admin.feedback.help')} />

	<Card.Root>
		<Card.Content class="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr] lg:items-end">
			<div class="grid gap-2">
				<Label for="fb-event">{t('admin.feedback.select_event')}</Label>
				<AppSelect
					id="fb-event"
					value={data.eventId}
					placeholder={t('admin.feedback.all_events')}
					options={[
						{ value: '', label: t('admin.feedback.all_events') },
						...eventOptions(data.groups)
					]}
					onValueChange={(v) => go(v, data.samithi)}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="fb-samithi">{t('report.affiliation')}</Label>
				<AppSelect
					id="fb-samithi"
					value={data.samithi}
					placeholder={t('admin.feedback.all_samithis')}
					options={[
						{ value: '', label: t('admin.feedback.all_samithis') },
						...data.samithis.map((s) => ({ value: s, label: s }))
					]}
					onValueChange={(v) => go(data.eventId, v)}
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

	{#if data.eventId || data.samithi}
		<Card.Root class="gap-0 py-0">
			<Card.Header class="flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
				<Card.Title>{t('admin.events.tab_participants')} · {data.participants.length}</Card.Title>
				{#if data.participants.length}
					<Button href="/admin/feedback/pdf?{q(scope(data.eventId, data.samithi))}" download
						><Download />{t('admin.feedback.download_event')}</Button
					>
				{/if}
			</Card.Header>
			<Table.Root>
				<Table.Body>
					{#each data.participants as p (p.id)}
						<Table.Row>
							<Table.Cell class="py-3 whitespace-normal">
								<div class="font-medium">{p.name}</div>
								<div class="text-muted-foreground text-xs">
									<span class="font-mono">{p.code}</span>
									{#if p.affiliation}· {p.affiliation}{/if}
									{#if !data.eventId && p.events.length}· {p.events.join(', ')}{/if}
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
									href="/admin/feedback/pdf?{q(
										`participant=${p.id}${data.eventId ? `&event=${data.eventId}` : ''}`
									)}"
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
	{:else}
		<p class="text-muted-foreground text-sm">{t('admin.feedback.choose_scope')}</p>
	{/if}
</div>

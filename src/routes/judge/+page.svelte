<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Users from '@lucide/svelte/icons/users';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import StatusBadge from '#lib/components/app/StatusBadge.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { isSubmitted } from '#lib/status.ts';

	let { data } = $props();
</script>

<svelte:head><title>{t('judge.my_events')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<div>
		<p class="text-muted-foreground">
			{t('judge.welcome', { name: data.profile?.display_name ?? '' })}
		</p>
		<h1 class="text-2xl font-bold tracking-tight">{t('judge.my_events')}</h1>
	</div>

	{#if data.events.length === 0}
		<Alert.Root variant="info"><Alert.Title>{t('judge.no_events')}</Alert.Title></Alert.Root>
	{:else}
		<ul class="grid gap-4 sm:grid-cols-2" role="list">
			{#each data.events as ev (ev.id)}
				<li>
					<Card.Root class="h-full">
						<Card.Header>
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-muted-foreground text-sm font-medium">{ev.group}</p>
									<Card.Title class="text-xl">{ev.name}</Card.Title>
								</div>
								<StatusBadge status={ev.status} />
							</div>
						</Card.Header>
						<Card.Content class="grid gap-3">
							{#if ev.openCorrections > 0 || ev.status === 'reopened' || ev.status === 'correction_requested'}
								<Alert.Root variant="warning"
									><BellRing /><Alert.Title>{t('judge.action_required')}</Alert.Title></Alert.Root
								>
							{/if}
							<div class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
								<span class="inline-flex items-center gap-1.5"
									><Users class="size-4" />{t('judge.participants_count', {
										n: ev.participants
									})}</span
								>
								<span class="inline-flex items-center gap-1.5"
									><ListChecks class="size-4" />{t('judge.criteria_count', {
										n: ev.criteria
									})}</span
								>
								{#if ev.venue}<span class="inline-flex items-center gap-1.5"
										><MapPin class="size-4" />{ev.venue}</span
									>{/if}
							</div>
							{#if ev.submitted_at && isSubmitted(ev.status)}
								<p class="text-sm">
									{t('submit.success_body', {
										event: ev.name,
										time: formatDateTime(locale(), ev.submitted_at)
									})}
								</p>
							{/if}
						</Card.Content>
						<Card.Footer>
							<Button href="/judge/events/{ev.id}" size="lg" class="w-full">
								{isSubmitted(ev.status) || ev.status === 'reopening_requested'
									? t('judge.view_submission')
									: ev.status === 'not_started'
										? t('judge.start_scoring')
										: t('judge.continue_scoring')}
								<ArrowRight />
							</Button>
						</Card.Footer>
					</Card.Root>
				</li>
			{/each}
		</ul>
	{/if}
</div>

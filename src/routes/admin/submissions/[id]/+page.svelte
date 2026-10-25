<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import ConfirmForm from '#lib/components/app/ConfirmForm.svelte';
	import StatusBadge from '#lib/components/app/StatusBadge.svelte';
	import NativeSelect from '#lib/components/app/NativeSelect.svelte';
	import { t, locale } from '#lib/i18n/t.svelte.ts';
	import { formatDateTime } from '#lib/i18n/index.ts';
	import { formatMark, participantTotal } from '#lib/scoring.ts';
	import { isSubmitted } from '#lib/status.ts';

	let { data, form } = $props();
	const s = $derived(data.sub);
	const mark = (p: string, c: string) =>
		data.scores.find((x) => x.participant_id === p && x.criterion_id === c)?.value ?? null;
	const totalFor = (p: string) => {
		const m: Record<string, number | null> = {};
		for (const c of data.criteria) m[c.id] = mark(p, c.id);
		return participantTotal(data.criteria, m);
	};
	const pName = (id: string | null) => data.participants.find((p) => p.id === id)?.name ?? '';
	const cName = (id: string) => data.allCriteria.find((c) => c.id === id)?.name ?? id;
	const locked = $derived(isSubmitted(s.status) || s.status === 'reopening_requested');
	let unlock = $state(true);
	const reqTone = (st: string) =>
		st === 'approved' || st === 'resolved'
			? 'success'
			: st === 'rejected' || st === 'cancelled'
				? 'neutral'
				: 'warning';
</script>

<svelte:head><title>{t('admin.submissions.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<div>
		<Button href="/admin/submissions?event={s.event_id}" variant="ghost" size="sm" class="-ml-2"
			><ArrowLeft />{t('admin.submissions.title')}</Button
		>
	</div>
	<PageHeader
		title={s.profiles?.display_name ?? ''}
		eyebrow="{s.events?.groups?.name} – {s.events?.name}"
	>
		{#snippet actions()}
			<StatusBadge status={s.status} />
			{#if locked}
				<ConfirmForm
					action="?/reopen"
					label={t('admin.submissions.reopen')}
					title={t('admin.submissions.reopen')}
					requireReason
				/>
			{/if}
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />
	{#if data.missing > 0}
		<Alert.Root variant="warning"
			><TriangleAlert /><Alert.Title
				>{t('admin.submissions.missing', { n: data.missing })}</Alert.Title
			></Alert.Root
		>
	{/if}

	<Tabs.Root value="marks">
		<Tabs.List class="h-auto flex-wrap">
			<Tabs.Trigger value="marks" class="px-4 py-2">{t('admin.submissions.details')}</Tabs.Trigger>
			<Tabs.Trigger value="actions" class="px-4 py-2">{t('common.actions')}</Tabs.Trigger>
			<Tabs.Trigger value="history" class="px-4 py-2">{t('request.history')}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="marks" class="mt-4">
			<Card.Root class="py-0">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>{t('common.participant')}</Table.Head>
							{#each data.criteria as c (c.id)}<Table.Head class="text-right whitespace-normal"
									>{c.name}
									<div class="text-muted-foreground text-xs font-normal">
										/ {formatMark(c.max_marks)}
									</div></Table.Head
								>{/each}
							<Table.Head class="text-right">{t('score.total')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.participants as p (p.id)}
							{@const tot = totalFor(p.id)}
							<Table.Row>
								<Table.Cell class="whitespace-normal"
									><div class="font-medium">{p.name}</div>
									<div class="text-muted-foreground font-mono text-xs">{p.code}</div></Table.Cell
								>
								{#each data.criteria as c (c.id)}
									{@const v = mark(p.id, c.id)}
									<Table.Cell class="text-right tabular-nums"
										>{#if v === null}<Badge variant="destructive">–</Badge>{:else}{formatMark(
												v
											)}{/if}</Table.Cell
									>
								{/each}
								<Table.Cell class="text-right font-bold tabular-nums"
									>{formatMark(tot.total)}</Table.Cell
								>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="actions" class="mt-4">
			<div class="grid gap-4 lg:grid-cols-2">
				<Card.Root>
					<Card.Header><Card.Title>{t('admin.submissions.edit_score')}</Card.Title></Card.Header>
					<Card.Content>
						<form method="POST" action="?/setScore" use:enhance class="grid gap-4">
							<div class="grid gap-2">
								<Label for="es-p">{t('common.participant')}</Label>
								<NativeSelect id="es-p" name="participant_id" required
									>{#each data.participants as p (p.id)}<option value={p.id}
											>{p.code} – {p.name}</option
										>{/each}</NativeSelect
								>
							</div>
							<div class="grid gap-2">
								<Label for="es-c">{t('judge.criteria')}</Label>
								<NativeSelect id="es-c" name="criterion_id" required
									>{#each data.criteria as c (c.id)}<option value={c.id}
											>{c.name} (/ {formatMark(c.max_marks)})</option
										>{/each}</NativeSelect
								>
							</div>
							<div class="grid gap-2">
								<Label for="es-v">{t('score.title')}</Label>
								<Input id="es-v" name="value" inputmode="decimal" required class="max-w-32" />
							</div>
							<div class="grid gap-2">
								<Label for="es-r">{t('common.reason')}</Label>
								<Textarea id="es-r" name="reason" required minlength={3} />
							</div>
							<div><Button type="submit">{t('common.save')}</Button></div>
						</form>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Header><Card.Title>{t('admin.requests.new_correction')}</Card.Title></Card.Header>
					<Card.Content>
						<form method="POST" action="?/correction" use:enhance class="grid gap-4">
							<div class="grid gap-2">
								<Label for="cr-p">{t('admin.requests.participant_optional')}</Label>
								<NativeSelect id="cr-p" name="participant_id">
									<option value="">{t('common.all')}</option>
									{#each data.participants as p (p.id)}<option value={p.id}
											>{p.code} – {p.name}</option
										>{/each}
								</NativeSelect>
							</div>
							<fieldset class="grid gap-2">
								<legend class="mb-1 text-sm font-medium"
									>{t('admin.requests.criteria_optional')}</legend
								>
								{#each data.criteria as c (c.id)}
									<label class="flex items-center gap-2"
										><input
											type="checkbox"
											name="criterion_ids"
											value={c.id}
											class="accent-primary size-5"
										/>{c.name}</label
									>
								{/each}
							</fieldset>
							<div class="grid gap-2">
								<Label for="cr-m">{t('admin.requests.message')}</Label>
								<Textarea id="cr-m" name="message" required minlength={3} />
							</div>
							<div class="flex items-start gap-2">
								<Checkbox id="cr-unlock" name="unlock" bind:checked={unlock} class="mt-0.5" />
								<Label for="cr-unlock" class="font-normal">{t('admin.requests.unlock')}</Label>
							</div>
							<div><Button type="submit">{t('admin.submissions.request_correction')}</Button></div>
						</form>
					</Card.Content>
				</Card.Root>
			</div>
		</Tabs.Content>

		<Tabs.Content value="history" class="mt-4">
			<div class="grid gap-4">
				{#if data.corrections.length || data.reopenings.length}
					<Card.Root>
						<Card.Header><Card.Title>{t('nav.requests')}</Card.Title></Card.Header>
						<Card.Content class="grid gap-3">
							{#each data.reopenings as r (r.id)}
								<div class="rounded-lg border p-3">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<span class="font-medium">{t('request.reopen_title')}</span><Badge
											variant={reqTone(r.status)}>{t(`request.${r.status}`)}</Badge
										>
									</div>
									<p class="mt-1">“{r.reason}”</p>
									<p class="text-muted-foreground text-xs">
										{formatDateTime(locale(), r.created_at)}{#if r.resolution_note}
											· {r.resolution_note}{/if}
									</p>
								</div>
							{/each}
							{#each data.corrections as c (c.id)}
								<div class="rounded-lg border p-3">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<span class="font-medium">{t('admin.submissions.request_correction')}</span
										><Badge variant={reqTone(c.status)}>{t(`request.${c.status}`)}</Badge>
									</div>
									<p class="mt-1">“{c.message}”</p>
									{#if c.participant_id || c.criterion_ids.length}<p
											class="text-muted-foreground text-sm"
										>
											{pName(c.participant_id)}
											{c.criterion_ids.map(cName).join(', ')}
										</p>{/if}
									{#if c.judge_response}<p class="mt-1 text-sm">
											<strong>{t('admin.requests.judge_reply')}:</strong>
											{c.judge_response}
										</p>{/if}
									<p class="text-muted-foreground text-xs">
										{formatDateTime(locale(), c.created_at)}
									</p>
								</div>
							{/each}
						</Card.Content>
					</Card.Root>
				{/if}
				<Card.Root>
					<Card.Header><Card.Title>{t('common.status')}</Card.Title></Card.Header>
					<Card.Content>
						<ol class="border-primary/30 grid gap-3 border-l-2 pl-4">
							{#each data.transitions as tr (tr.id)}
								<li class="text-sm">
									<span class="text-muted-foreground"
										>{formatDateTime(locale(), tr.created_at)}</span
									><br />
									{tr.from_status ? t(`status.${tr.from_status}`) : '–'} →
									<strong>{t(`status.${tr.to_status}`)}</strong>{#if tr.reason}
										– “{tr.reason}”{/if}
								</li>
							{/each}
						</ol>
					</Card.Content>
				</Card.Root>
				<Card.Root class="gap-0 py-0">
					<Card.Header class="border-b py-4"
						><Card.Title>{t('admin.audit.details')} ({data.history.length})</Card.Title
						></Card.Header
					>
					<Table.Root>
						<Table.Body>
							{#each data.history as h (h.id)}
								<Table.Row>
									<Table.Cell class="text-muted-foreground text-xs"
										>{formatDateTime(locale(), h.changed_at)}</Table.Cell
									>
									<Table.Cell class="whitespace-normal"
										>{pName(h.participant_id)} · {cName(h.criterion_id)}</Table.Cell
									>
									<Table.Cell class="tabular-nums"
										>{h.old_value ?? '–'} → <strong>{h.new_value ?? '–'}</strong></Table.Cell
									>
									<Table.Cell
										><Badge variant={h.source === 'admin' ? 'warning' : 'neutral'}>{h.source}</Badge
										></Table.Cell
									>
									<Table.Cell class="whitespace-normal text-sm">{h.reason ?? ''}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Root>
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>

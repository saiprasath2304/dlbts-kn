<script lang="ts">
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Search from '@lucide/svelte/icons/search';
	import Wand from '@lucide/svelte/icons/wand-sparkles';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import FormDialog from '#lib/components/app/FormDialog.svelte';
	import ConfirmForm from '#lib/components/app/ConfirmForm.svelte';
	import NativeSelect from '#lib/components/app/NativeSelect.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data, form } = $props();

	let eventId = $state('');
	let username = $state('');
	let password = $state('');
	let assign = $state(true);
	let query = $state('');

	function suggest() {
		const s = data.suggestions[eventId];
		if (s) {
			username = s.username;
			password = s.password;
		}
	}

	const shown = $derived(
		query.trim()
			? data.judges.filter((j) =>
					`${j.display_name} ${j.username} ${j.events.join(' ')}`
						.toLowerCase()
						.includes(query.trim().toLowerCase())
				)
			: data.judges
	);
</script>

<svelte:head><title>{t('admin.judges.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader
		title={t('admin.judges.title')}
		description="{data.judges.length} · {t('admin.judges.username_help')}"
	>
		{#snippet actions()}
			<FormDialog
				action="?/create"
				title={t('admin.judges.new')}
				submitLabel={t('common.create')}
				wide
			>
				{#snippet trigger()}<UserPlus />{t('admin.judges.new')}{/snippet}
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-2 sm:col-span-2">
						<Label for="j-event">{t('admin.judges.suggest_for')}</Label>
						<div class="flex gap-2">
							<NativeSelect id="j-event" name="event_id" bind:value={eventId} onchange={suggest}>
								<option value="">{t('common.none')}</option>
								{#each data.groups as g (g.id)}
									<optgroup label={g.name}
										>{#each g.events as e (e.id)}<option value={e.id}>{e.name}</option
											>{/each}</optgroup
									>
								{/each}
							</NativeSelect>
							{#if eventId}<Button
									type="button"
									variant="outline"
									size="icon"
									onclick={suggest}
									aria-label={t('admin.judges.suggest')}><Wand /></Button
								>{/if}
						</div>
					</div>
					<div class="grid gap-2 sm:col-span-2">
						<Label for="j-name">{t('admin.judges.display_name')}</Label>
						<Input id="j-name" name="display_name" required autocomplete="off" />
					</div>
					<div class="grid gap-2">
						<Label for="j-user">{t('admin.judges.username')}</Label>
						<Input
							id="j-user"
							name="username"
							required
							bind:value={username}
							autocomplete="off"
							autocapitalize="none"
							spellcheck={false}
							class="font-mono"
						/>
					</div>
					<div class="grid gap-2">
						<Label for="j-pass">{t('admin.judges.password')}</Label>
						<Input
							id="j-pass"
							name="password"
							type="text"
							required
							minlength={6}
							bind:value={password}
							autocomplete="new-password"
							spellcheck={false}
							class="font-mono"
						/>
					</div>
					<p class="text-muted-foreground text-xs sm:col-span-2">
						{t('admin.judges.password_help')}
					</p>
					{#if eventId}
						<div class="flex items-center gap-2 sm:col-span-2">
							<Checkbox id="j-assign" name="assign" bind:checked={assign} />
							<Label for="j-assign" class="font-normal">{t('admin.judges.assign_now')}</Label>
						</div>
					{/if}
				</div>
			</FormDialog>
		{/snippet}
	</PageHeader>
	<FormFeedback {form} />

	<div class="relative max-w-md">
		<Search class="text-muted-foreground pointer-events-none absolute top-3 left-3 size-5" />
		<Label for="j-search" class="sr-only">{t('common.search')}</Label>
		<Input
			id="j-search"
			type="search"
			bind:value={query}
			placeholder={t('common.search')}
			class="pl-10"
		/>
	</div>

	<Card.Root class="py-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{t('common.judge')}</Table.Head>
					<Table.Head class="hidden md:table-cell">{t('admin.judges.assigned_events')}</Table.Head>
					<Table.Head class="text-right">{t('common.actions')}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each shown as j (j.id)}
					<Table.Row data-testid="judge-row" class={j.is_active ? '' : 'opacity-60'}>
						<Table.Cell class="py-3 whitespace-normal">
							<div class="font-semibold">{j.display_name}</div>
							<div class="text-muted-foreground font-mono text-sm">{j.username}</div>
							{#if !j.is_active}<Badge variant="neutral" class="mt-1">{t('common.inactive')}</Badge
								>{/if}
						</Table.Cell>
						<Table.Cell class="hidden whitespace-normal md:table-cell">
							<div class="flex flex-wrap gap-1">
								{#each j.events as e (e)}<Badge variant="secondary">{e}</Badge>{:else}<span
										class="text-muted-foreground text-sm">{t('common.none')}</span
									>{/each}
							</div>
						</Table.Cell>
						<Table.Cell class="text-right">
							<div class="flex flex-wrap justify-end gap-1">
								<FormDialog
									action="?/rename"
									title={t('admin.judges.display_name')}
									variant="ghost"
									size="sm"
								>
									{#snippet trigger()}<Pencil /><span class="sr-only lg:not-sr-only"
											>{t('common.edit')}</span
										>{/snippet}
									<input type="hidden" name="id" value={j.id} />
									<div class="grid gap-2">
										<Label for="rn-{j.id}">{t('admin.judges.display_name')}</Label>
										<Input id="rn-{j.id}" name="display_name" value={j.display_name} required />
									</div>
								</FormDialog>
								<FormDialog
									action="?/password"
									title="{t('admin.judges.reset_password')}: {j.username}"
									variant="ghost"
									size="sm"
								>
									{#snippet trigger()}<KeyRound /><span class="sr-only lg:not-sr-only"
											>{t('admin.judges.reset_password')}</span
										>{/snippet}
									<input type="hidden" name="id" value={j.id} />
									<div class="grid gap-2">
										<Label for="pw-{j.id}">{t('admin.judges.password')}</Label>
										<Input
											id="pw-{j.id}"
											name="password"
											type="text"
											minlength={6}
											required
											autocomplete="new-password"
											class="font-mono"
										/>
										<p class="text-muted-foreground text-xs">{t('admin.judges.password_help')}</p>
									</div>
								</FormDialog>
								<ConfirmForm
									action="?/active"
									label={j.is_active ? t('common.deactivate') : t('common.activate')}
									title={`${j.is_active ? t('common.deactivate') : t('common.activate')}: ${j.display_name}`}
									requireReason={j.is_active}
									danger={j.is_active}
									variant="ghost"
									size="sm"
								>
									{#snippet fields()}
										<input type="hidden" name="id" value={j.id} />
										<input type="hidden" name="active" value={j.is_active ? 'false' : 'true'} />
									{/snippet}
								</ConfirmForm>
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Root>
</div>

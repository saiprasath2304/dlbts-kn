<script lang="ts">
	import { enhance } from '$app/forms';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import PageHeader from '#lib/components/app/PageHeader.svelte';
	import FormFeedback from '#lib/components/app/FormFeedback.svelte';
	import NativeSelect from '#lib/components/app/NativeSelect.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data, form } = $props();
	const s = $derived(data.settings);
	let name = $state('');
	let year = $state(0);
	let confirmText = $state('');
	let busy = $state(false);
	$effect.pre(() => {
		name = s.app_name;
		year = s.event_year;
	});
</script>

<svelte:head><title>{t('admin.settings.title')}</title></svelte:head>

<div class="grid grid-cols-1 gap-6">
	<PageHeader title={t('admin.settings.title')} />
	<FormFeedback {form} />

	<Tabs.Root value="general">
		<Tabs.List class="h-auto flex-wrap">
			<Tabs.Trigger value="general" class="px-4 py-2">{t('admin.settings.general')}</Tabs.Trigger>
			<Tabs.Trigger value="reset" class="px-4 py-2">{t('admin.settings.reset_title')}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="general" class="mt-4">
			<form method="POST" action="?/save" use:enhance class="grid grid-cols-1 gap-6">
				<Card.Root>
					<Card.Header><Card.Title>{t('admin.settings.general')}</Card.Title></Card.Header>
					<Card.Content class="grid gap-5">
						<div class="grid gap-4 sm:grid-cols-3">
							<div class="grid gap-2 sm:col-span-2">
								<Label for="s-name">{t('admin.settings.app_name')}</Label><Input
									id="s-name"
									name="app_name"
									required
									bind:value={name}
								/>
							</div>
							<div class="grid gap-2">
								<Label for="s-year">{t('admin.settings.event_year')}</Label><Input
									id="s-year"
									name="event_year"
									type="number"
									min="2000"
									max="2100"
									required
									bind:value={year}
								/>
							</div>
						</div>
						<p class="text-muted-foreground text-sm">
							{t('admin.settings.title_preview', { title: `${name} ${year}` })}
						</p>
						<div class="grid gap-2 sm:max-w-xs">
							<Label for="s-locale">{t('admin.settings.default_locale')}</Label>
							<NativeSelect id="s-locale" name="default_locale" value={s.default_locale}>
								<option value="en">English</option>
								<option value="ta">தமிழ்</option>
							</NativeSelect>
						</div>
						<div class="bg-muted/60 flex items-center gap-4 rounded-xl p-4">
							<img src="/logo.png" alt="" width="56" height="56" class="rounded-full" />
							<div>
								<p class="font-semibold">{t('admin.settings.logo')}</p>
								<p class="text-muted-foreground text-sm">{t('admin.settings.logo_help')}</p>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Header>
						<Card.Title>{t('admin.settings.accounts')}</Card.Title>
						<Card.Description>{t('admin.settings.pattern_help')}</Card.Description>
					</Card.Header>
					<Card.Content class="grid gap-4 sm:grid-cols-3">
						<div class="grid gap-2">
							<Label for="s-user">{t('admin.settings.username_pattern')}</Label><Input
								id="s-user"
								name="username_pattern"
								required
								value={s.username_pattern}
								class="font-mono"
							/>
						</div>
						<div class="grid gap-2">
							<Label for="s-pass">{t('admin.settings.password_pattern')}</Label><Input
								id="s-pass"
								name="password_pattern"
								required
								value={s.password_pattern}
								class="font-mono"
							/>
						</div>
						<div class="grid gap-2">
							<Label for="s-delay">{t('admin.settings.autosave_delay')}</Label><Input
								id="s-delay"
								name="autosave_delay_ms"
								type="number"
								min="200"
								max="10000"
								value={s.autosave_delay_ms}
							/>
						</div>
					</Card.Content>
				</Card.Root>
				<div><Button type="submit" size="lg">{t('common.save')}</Button></div>
			</form>
		</Tabs.Content>

		<Tabs.Content value="reset" class="mt-4">
			<Card.Root class="border-destructive/40">
				<form
					method="POST"
					action="?/reset"
					use:enhance={() => {
						busy = true;
						return async ({ update }) => {
							busy = false;
							confirmText = '';
							await update();
						};
					}}
				>
					<Card.Header>
						<Card.Title class="text-destructive flex items-center gap-2"
							><RotateCcw />{t('admin.settings.reset_title')}</Card.Title
						>
					</Card.Header>
					<Card.Content class="grid gap-4">
						<Alert.Root variant="destructive"
							><TriangleAlert /><Alert.Description class="text-base"
								>{t('admin.settings.reset_body')}</Alert.Description
							></Alert.Root
						>
						<div class="grid gap-2 sm:max-w-xs">
							<Label for="s-reset">{t('admin.settings.reset_confirm_label')}</Label>
							<Input
								id="s-reset"
								name="confirm"
								autocomplete="off"
								bind:value={confirmText}
								placeholder="RESET"
								class="font-mono"
							/>
						</div>
						<div>
							<Button
								type="submit"
								variant="solidDestructive"
								disabled={confirmText !== 'RESET' || busy}
								data-testid="reset-button">{t('admin.settings.reset_button')}</Button
							>
						</div>
					</Card.Content>
				</form>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>

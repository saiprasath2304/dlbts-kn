<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { form } = $props();
	let busy = $state(false);
	let show = $state(false);
</script>

<svelte:head><title>{t('login.title')}</title></svelte:head>

<div class="mx-auto max-w-md pt-4">
	<Card.Root class="shadow-lg">
		<Card.Header class="items-center text-center">
			<img
				src="/logo.png"
				alt="Sri Sathya Sai Balvikas"
				width="96"
				height="96"
				class="mx-auto rounded-full shadow-md"
			/>
			<p class="text-primary mt-2 text-lg font-bold">{page.data.appTitle}</p>
			<Card.Title class="text-2xl">{t('login.title')}</Card.Title>
			<Card.Description class="text-base">{t('login.subtitle')}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				class="grid gap-5"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						busy = false;
						await update({ reset: false });
					};
				}}
			>
				{#if form?.error}
					<Alert.Root variant="destructive" role="alert" id="login-error">
						<CircleAlert />
						<Alert.Title>{form.error}</Alert.Title>
					</Alert.Root>
				{/if}
				<div class="grid gap-2">
					<Label for="username">{t('login.username')}</Label>
					<Input
						id="username"
						name="username"
						autocomplete="username"
						autocapitalize="none"
						autocorrect="off"
						spellcheck={false}
						required
						value={form?.username ?? ''}
						aria-describedby={form?.error ? 'login-error' : undefined}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="password">{t('login.password')}</Label>
					<Input
						id="password"
						name="password"
						type={show ? 'text' : 'password'}
						autocomplete="current-password"
						required
					/>
					<div class="flex items-center gap-2 pt-1">
						<Checkbox id="show-password" bind:checked={show} />
						<Label for="show-password" class="font-normal">{t('login.show_password')}</Label>
					</div>
				</div>
				<Button type="submit" size="xl" class="w-full" disabled={busy}>
					{busy ? t('login.submitting') : t('login.submit')}
				</Button>
				<p class="text-muted-foreground text-center text-sm">{t('login.help')}</p>
			</form>
		</Card.Content>
	</Card.Root>
</div>

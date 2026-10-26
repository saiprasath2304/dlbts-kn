<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Loader from '@lucide/svelte/icons/loader-circle';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { progress, withProgress } from '#lib/progress.svelte.ts';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { form } = $props();
	let busy = $state(false);
	let show = $state(false);
	const locale = $derived(page.data.locale);
</script>

<svelte:head><title>{t('login.title')} · {page.data.appTitle}</title></svelte:head>

<div class="bg-muted/40 relative flex min-h-svh flex-col items-center justify-center px-4 py-10">
	<form method="POST" action="/lang" use:enhance={withProgress()} class="absolute top-4 right-4">
		<input type="hidden" name="locale" value={locale === 'ta' ? 'en' : 'ta'} />
		<input type="hidden" name="next" value="/login" />
		<Button type="submit" variant="ghost" size="sm" lang={locale === 'ta' ? 'en' : 'ta'}>
			<span class="sr-only">{t('lang.label')}: </span>{t('lang.switch_to')}
		</Button>
	</form>

	<main id="main" class="w-full max-w-sm">
		<div class="mb-8 flex flex-col items-center text-center">
			<img
				src="/logo.png"
				alt="Sri Sathya Sai Balvikas"
				width="72"
				height="72"
				class="rounded-full shadow-sm"
			/>
			<p class="mt-4 text-lg font-semibold tracking-tight">{page.data.appTitle}</p>
			<p class="text-muted-foreground text-sm">{t('login.subtitle')}</p>
		</div>

		<div class="bg-card rounded-xl border p-6 shadow-sm">
			<h1 class="mb-5 text-xl font-semibold tracking-tight">{t('login.title')}</h1>
			<form
				method="POST"
				class="grid gap-4"
				use:enhance={() => {
					busy = true;
					progress.forms++;
					return async ({ update }) => {
						try {
							await update({ reset: false });
						} finally {
							busy = false;
							progress.forms--;
						}
					};
				}}
			>
				{#if form?.error}
					<div
						class="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
						role="alert"
						id="login-error"
					>
						<CircleAlert class="mt-0.5 size-4 shrink-0" />
						<span>{form.error}</span>
					</div>
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
						class="h-11"
					/>
				</div>
				<div class="grid gap-2">
					<Label for="password">{t('login.password')}</Label>
					<div class="relative">
						<Input
							id="password"
							name="password"
							type={show ? 'text' : 'password'}
							autocomplete="current-password"
							required
							class="h-11 pr-11"
						/>
						<button
							type="button"
							class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md outline-none focus-visible:ring-3"
							onclick={() => (show = !show)}
							aria-label={t('login.show_password')}
							aria-pressed={show}
						>
							{#if show}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
						</button>
					</div>
				</div>
				<Button type="submit" size="lg" class="mt-2 w-full" disabled={busy}>
					{#if busy}<Loader class="animate-spin" />{t('login.submitting')}{:else}{t(
							'login.submit'
						)}{/if}
				</Button>
			</form>
		</div>
		<p class="text-muted-foreground mt-6 text-center text-sm">{t('login.help')}</p>
	</main>
</div>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { form } = $props();
	let busy = $state(false);
	let show = $state(false);
</script>

<svelte:head><title>{t('login.title')}</title></svelte:head>

<div class="login card stack">
	<div class="brand">
		<img src="/logo.png" alt="Sri Sathya Sai Balvikas" width="96" height="96" />
		<div class="event">{page.data.appTitle}</div>
	</div>
	<h1>{t('login.title')}</h1>
	<p class="muted">{t('login.subtitle')}</p>

	{#if form?.error}
		<div class="alert error" role="alert" id="login-error">{form.error}</div>
	{/if}

	<form
		method="POST"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
	>
		<div class="field">
			<label for="username">{t('login.username')}</label>
			<input
				id="username"
				name="username"
				type="text"
				autocomplete="username"
				autocapitalize="none"
				autocorrect="off"
				spellcheck="false"
				required
				value={form?.username ?? ''}
				aria-describedby={form?.error ? 'login-error' : undefined}
			/>
		</div>
		<div class="field">
			<label for="password">{t('login.password')}</label>
			<input
				id="password"
				name="password"
				type={show ? 'text' : 'password'}
				autocomplete="current-password"
				required
			/>
			<label class="checkbox small" style="margin-top: 0.5rem">
				<input type="checkbox" bind:checked={show} />
				{t('login.show_password')}
			</label>
		</div>
		<div class="field">
			<button class="btn large block" type="submit" disabled={busy}>
				{busy ? t('login.submitting') : t('login.submit')}
			</button>
		</div>
	</form>
	<p class="help">{t('login.help')}</p>
</div>

<style>
	.login {
		max-width: 28rem;
		margin: 1.5rem auto;
	}
	.brand {
		text-align: center;
	}
	.brand img {
		border-radius: 50%;
		box-shadow: 0 2px 12px rgb(38 51 111 / 0.15);
	}
	.event {
		font-weight: 800;
		font-size: 1.3rem;
		color: var(--heading);
		margin-top: 0.4rem;
	}
</style>

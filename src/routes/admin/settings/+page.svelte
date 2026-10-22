<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
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

<div class="stack">
	<h1>{t('admin.settings.title')}</h1>
	<Flash {form} />

	<form method="POST" action="?/save" use:enhance class="card stack">
		<h2>{t('admin.settings.general')}</h2>
		<div class="form-grid">
			<div>
				<label for="s-name">{t('admin.settings.app_name')}</label>
				<input id="s-name" name="app_name" required bind:value={name} />
			</div>
			<div>
				<label for="s-year">{t('admin.settings.event_year')}</label>
				<input
					id="s-year"
					name="event_year"
					type="number"
					min="2000"
					max="2100"
					required
					bind:value={year}
				/>
			</div>
			<div>
				<label for="s-locale">{t('admin.settings.default_locale')}</label>
				<select id="s-locale" name="default_locale" value={s.default_locale}>
					<option value="en">English</option>
					<option value="ta">தமிழ்</option>
				</select>
			</div>
		</div>
		<p class="help">{t('admin.settings.title_preview', { title: `${name} ${year}` })}</p>

		<div class="logo-row">
			<img src="/logo.png" alt="" width="56" height="56" />
			<div>
				<strong>{t('admin.settings.logo')}</strong>
				<p class="help">{t('admin.settings.logo_help')}</p>
			</div>
		</div>

		<h2>{t('admin.settings.accounts')}</h2>
		<div class="form-grid">
			<div>
				<label for="s-user">{t('admin.settings.username_pattern')}</label>
				<input
					id="s-user"
					name="username_pattern"
					required
					value={s.username_pattern}
					aria-describedby="s-help"
				/>
			</div>
			<div>
				<label for="s-pass">{t('admin.settings.password_pattern')}</label>
				<input
					id="s-pass"
					name="password_pattern"
					required
					value={s.password_pattern}
					aria-describedby="s-help"
				/>
			</div>
			<div>
				<label for="s-delay">{t('admin.settings.autosave_delay')}</label>
				<input
					id="s-delay"
					name="autosave_delay_ms"
					type="number"
					min="200"
					max="10000"
					value={s.autosave_delay_ms}
				/>
			</div>
		</div>
		<p class="help" id="s-help">{t('admin.settings.pattern_help')}</p>
		<div><button class="btn" type="submit">{t('common.save')}</button></div>
	</form>

	<form
		method="POST"
		action="?/reset"
		class="card stack danger-zone"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				confirmText = '';
				await update();
			};
		}}
	>
		<h2>{t('admin.settings.reset_title')}</h2>
		<p>{t('admin.settings.reset_body')}</p>
		<div class="row">
			<div class="grow">
				<label for="s-reset">{t('admin.settings.reset_confirm_label')}</label>
				<input
					id="s-reset"
					name="confirm"
					autocomplete="off"
					bind:value={confirmText}
					placeholder="RESET"
				/>
			</div>
		</div>
		<div>
			<button
				class="btn danger"
				type="submit"
				disabled={confirmText !== 'RESET' || busy}
				data-testid="reset-button"
			>
				{t('admin.settings.reset_button')}
			</button>
		</div>
	</form>
</div>

<style>
	.logo-row {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 0.75rem;
		border-radius: var(--radius);
		background: var(--surface-soft);
	}
	.logo-row img {
		border-radius: 50%;
		flex: none;
	}
	.danger-zone {
		border-color: var(--danger);
		border-width: 1.5px;
	}
	.danger-zone h2 {
		color: var(--danger);
	}
</style>

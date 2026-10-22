<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import ConfirmForm from '#lib/components/ConfirmForm.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data, form } = $props();

	let eventId = $state('');
	let username = $state('');
	let password = $state('');
	let busy = $state(false);

	function suggest() {
		const s = data.suggestions[eventId];
		if (s) {
			username = s.username;
			password = s.password;
		}
	}
</script>

<svelte:head><title>{t('admin.judges.title')}</title></svelte:head>

<div class="stack">
	<h1>{t('admin.judges.title')}</h1>
	<Flash {form} />

	<section class="card stack">
		<h2>{t('admin.judges.new')}</h2>
		<form
			method="POST"
			action="?/create"
			class="stack"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					busy = false;
					if (result.type === 'success') {
						username = '';
						password = '';
					}
					await update();
				};
			}}
		>
			<div class="form-grid">
				<div>
					<label for="j-event">{t('admin.judges.suggest_for')}</label>
					<select id="j-event" name="event_id" bind:value={eventId} onchange={suggest}>
						<option value="">{t('common.none')}</option>
						{#each data.groups as g (g.id)}
							<optgroup label={g.name}>
								{#each g.events as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
							</optgroup>
						{/each}
					</select>
				</div>
				<div>
					<label for="j-name">{t('admin.judges.display_name')}</label>
					<input id="j-name" name="display_name" required autocomplete="off" />
				</div>
				<div>
					<label for="j-user">{t('admin.judges.username')}</label>
					<input
						id="j-user"
						name="username"
						required
						bind:value={username}
						autocomplete="off"
						autocapitalize="none"
						spellcheck="false"
						aria-describedby="j-user-help"
					/>
					<p class="help" id="j-user-help">{t('admin.judges.username_help')}</p>
				</div>
				<div>
					<label for="j-pass">{t('admin.judges.password')}</label>
					<input
						id="j-pass"
						name="password"
						type="text"
						required
						minlength="6"
						bind:value={password}
						autocomplete="new-password"
						spellcheck="false"
						aria-describedby="j-pass-help"
					/>
					<p class="help" id="j-pass-help">{t('admin.judges.password_help')}</p>
				</div>
			</div>
			{#if eventId}
				<label class="checkbox"
					><input type="checkbox" name="assign" checked /> {t('admin.judges.assign_now')}</label
				>
			{/if}
			<div class="row">
				<button class="btn" type="submit" disabled={busy}>{t('common.create')}</button>
				{#if eventId}<button class="btn ghost" type="button" onclick={suggest}
						>{t('admin.judges.suggest')}</button
					>{/if}
			</div>
		</form>
	</section>

	<ul class="jlist" role="list">
		{#each data.judges as j (j.id)}
			<li class="card stack" data-testid="judge-row">
				<div class="row between">
					<div>
						<strong class="big">{j.display_name}</strong> <span class="mono">{j.username}</span>
						<div class="small muted">
							{t('admin.judges.assigned_events')}: {j.events.join('; ') || t('common.none')}
						</div>
					</div>
					<span class="badge {j.is_active ? 'success' : 'neutral'}"
						>{j.is_active ? t('common.active') : t('common.inactive')}</span
					>
				</div>
				<details>
					<summary class="btn small ghost">{t('common.edit')}</summary>
					<div class="stack" style="margin-top: 1rem">
						<form method="POST" action="?/rename" use:enhance class="row">
							<input type="hidden" name="id" value={j.id} />
							<label class="visually-hidden" for="rn-{j.id}">{t('admin.judges.display_name')}</label
							>
							<input
								id="rn-{j.id}"
								name="display_name"
								value={j.display_name}
								required
								style="max-width: 20rem"
							/>
							<button class="btn small secondary" type="submit">{t('common.update')}</button>
						</form>
						<form method="POST" action="?/password" use:enhance class="row">
							<input type="hidden" name="id" value={j.id} />
							<label class="visually-hidden" for="pw-{j.id}"
								>{t('admin.judges.reset_password')}</label
							>
							<input
								id="pw-{j.id}"
								name="password"
								type="text"
								minlength="6"
								required
								autocomplete="new-password"
								placeholder={t('admin.judges.reset_password')}
								style="max-width: 20rem"
							/>
							<button class="btn small secondary" type="submit"
								>{t('admin.judges.reset_password')}</button
							>
						</form>
						<ConfirmForm
							action="?/active"
							label={j.is_active ? t('common.deactivate') : t('common.activate')}
							title={`${j.is_active ? t('common.deactivate') : t('common.activate')}: ${j.display_name}`}
							requireReason={j.is_active}
							danger={j.is_active}
							buttonClass="btn small {j.is_active ? 'danger' : 'secondary'}"
						>
							{#snippet fields()}
								<input type="hidden" name="id" value={j.id} />
								<input type="hidden" name="active" value={j.is_active ? 'false' : 'true'} />
							{/snippet}
						</ConfirmForm>
					</div>
				</details>
			</li>
		{/each}
	</ul>
</div>

<style>
	.jlist {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}
</style>

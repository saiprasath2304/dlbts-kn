<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data, form } = $props();
	const CODE_PATTERN = '[a-z0-9]{1,12}';
</script>

<svelte:head><title>{t('admin.groups.title')}</title></svelte:head>

<div class="stack">
	<h1>{t('admin.groups.title')}</h1>
	<Flash {form} />

	{#snippet groupForm(g?: (typeof data.groups)[number])}
		<form method="POST" action="?/save" use:enhance class="form-grid">
			{#if g}<input type="hidden" name="id" value={g.id} />{/if}
			<div>
				<label for="code-{g?.id ?? 'new'}">{t('common.code')}</label>
				<input
					id="code-{g?.id ?? 'new'}"
					name="code"
					required
					pattern={CODE_PATTERN}
					value={g?.code ?? ''}
					aria-describedby="code-help"
				/>
			</div>
			<div>
				<label for="name-{g?.id ?? 'new'}">{t('common.name')}</label>
				<input id="name-{g?.id ?? 'new'}" name="name" required value={g?.name ?? ''} />
			</div>
			<div>
				<label for="order-{g?.id ?? 'new'}">{t('common.order')}</label>
				<input
					id="order-{g?.id ?? 'new'}"
					name="display_order"
					type="number"
					value={g?.display_order ?? 0}
				/>
			</div>
			<div>
				<label for="desc-{g?.id ?? 'new'}">{t('common.description')}</label>
				<input id="desc-{g?.id ?? 'new'}" name="description" value={g?.description ?? ''} />
			</div>
			{#if g}
				<label class="checkbox"
					><input type="checkbox" name="is_active" checked={g.is_active} />
					{t('common.active')}</label
				>
			{/if}
			<button class="btn" type="submit">{g ? t('common.update') : t('common.create')}</button>
		</form>
	{/snippet}

	<section class="card stack">
		<h2>{t('admin.groups.new')}</h2>
		<p class="help" id="code-help">{t('admin.groups.code_help')}</p>
		{@render groupForm()}
	</section>

	{#each data.groups as g (g.id)}
		<section class="card stack">
			<div class="row between">
				<h2 style="margin: 0">{g.name} <span class="mono small muted">{g.code}</span></h2>
				<span class="badge {g.is_active ? 'success' : 'neutral'}"
					>{g.is_active ? t('common.active') : t('common.inactive')}</span
				>
			</div>
			<p class="muted">
				{t('admin.groups.events', { n: g.events.length })}: {g.events.map((e) => e.name).join(', ')}
			</p>
			<details>
				<summary class="btn small ghost">{t('common.edit')}</summary>
				<div style="margin-top: 1rem">{@render groupForm(g)}</div>
				{#if g.events.length === 0}
					<form method="POST" action="?/delete" use:enhance style="margin-top: 1rem">
						<input type="hidden" name="id" value={g.id} />
						<button class="btn danger small" type="submit">{t('common.delete')}</button>
					</form>
				{/if}
			</details>
		</section>
	{/each}
</div>

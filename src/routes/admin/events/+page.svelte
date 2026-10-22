<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data, form } = $props();
</script>

<svelte:head><title>{t('admin.events.title')}</title></svelte:head>

<div class="stack">
	<h1>{t('admin.events.title')}</h1>
	<Flash {form} />

	<details class="card" open={data.groups.every((g) => g.events.length === 0)}>
		<summary class="btn secondary">{t('admin.events.new')}</summary>
		<form method="POST" action="?/save" use:enhance class="stack" style="margin-top: 1rem">
			<div class="form-grid">
				<div>
					<label for="n-group">{t('common.group')}</label>
					<select id="n-group" name="group_id" required>
						{#each data.groups as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
					</select>
				</div>
				<div>
					<label for="n-code">{t('common.code')}</label>
					<input id="n-code" name="code" required aria-describedby="n-code-help" />
					<p class="help" id="n-code-help">{t('admin.events.code_help')}</p>
				</div>
				<div>
					<label for="n-name">{t('common.name')}</label>
					<input id="n-name" name="name" required />
				</div>
				<div>
					<label for="n-prec">{t('admin.events.precision')}</label>
					<select id="n-prec" name="score_precision">
						<option value="0">{t('admin.events.precision_0')}</option>
						<option value="1" selected>{t('admin.events.precision_1')}</option>
						<option value="2">{t('admin.events.precision_2')}</option>
					</select>
				</div>
				<div>
					<label for="n-order">{t('common.order')}</label>
					<input id="n-order" name="display_order" type="number" value="0" />
				</div>
			</div>
			<div>
				<label for="n-desc">{t('common.description')}</label>
				<textarea id="n-desc" name="description"></textarea>
			</div>
			<div>
				<label for="n-ins">{t('admin.events.instructions')}</label>
				<textarea id="n-ins" name="instructions"></textarea>
			</div>
			<button class="btn" type="submit">{t('common.create')}</button>
		</form>
	</details>

	{#each data.groups as g (g.id)}
		<section class="stack">
			<h2>{g.name}</h2>
			{#if g.events.length === 0}<p class="muted">{t('common.none')}</p>{/if}
			<ul class="grid" role="list" style="list-style: none; padding: 0">
				{#each g.events as e (e.id)}
					<li class="card row between">
						<div>
							<strong>{e.name}</strong> <span class="mono small muted">{e.code}</span>
							{#if !e.is_active}<span class="badge neutral">{t('common.inactive')}</span>{/if}
						</div>
						<a class="btn small secondary" href="/admin/events/{e.id}">{t('admin.events.manage')}</a
						>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

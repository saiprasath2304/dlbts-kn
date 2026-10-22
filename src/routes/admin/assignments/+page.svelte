<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '#lib/components/Flash.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { data, form } = $props();
	const judgeName = (id: string) => {
		const j = data.judges.find((x) => x.id === id);
		return j ? `${j.display_name} (${j.username})` : id;
	};
	const scored = $derived(new Set(data.scored));
</script>

<svelte:head><title>{t('admin.assignments.title')}</title></svelte:head>

<div class="stack">
	<h1>{t('admin.assignments.title')}</h1>
	<Flash {form} />

	{#each data.groups as g (g.id)}
		<section class="stack">
			<h2>{g.name}</h2>
			<div class="grid">
				{#each g.events as e (e.id)}
					{@const list = data.assignments.filter((a) => a.event_id === e.id)}
					{@const active = new Set(list.filter((a) => a.is_active).map((a) => a.judge_id))}
					<article class="card stack">
						<div class="row between">
							<h3 style="margin: 0">{e.name}</h3>
							{#if scored.has(e.id)}<span class="badge warning"
									>{t('admin.events.scoring_started')}</span
								>{/if}
						</div>
						{#if list.length === 0}<p class="muted small">{t('admin.assignments.none')}</p>{/if}
						<ul class="alist">
							{#each list as a (a.id)}
								<li>
									<form method="POST" action="?/set" use:enhance class="row between">
										<span class:muted={!a.is_active}>{judgeName(a.judge_id)}</span>
										<input type="hidden" name="event_id" value={e.id} />
										<input type="hidden" name="judge_id" value={a.judge_id} />
										<input type="hidden" name="active" value={a.is_active ? 'false' : 'true'} />
										{#if scored.has(e.id)}<input
												name="reason"
												required
												minlength="3"
												placeholder={t('common.reason')}
												aria-label={t('common.reason')}
											/>{/if}
										<button class="btn small {a.is_active ? 'ghost' : 'secondary'}" type="submit">
											{a.is_active ? t('admin.assignments.remove') : t('admin.assignments.restore')}
										</button>
									</form>
								</li>
							{/each}
						</ul>
						<form method="POST" action="?/set" use:enhance class="stack">
							<input type="hidden" name="event_id" value={e.id} />
							<input type="hidden" name="active" value="true" />
							<label for="aj-{e.id}">{t('admin.assignments.select_judge')}</label>
							<select id="aj-{e.id}" name="judge_id" required>
								{#each data.judges.filter((j) => j.is_active && !active.has(j.id)) as j (j.id)}
									<option value={j.id}>{j.display_name} ({j.username})</option>
								{/each}
							</select>
							{#if scored.has(e.id)}
								<label for="ajr-{e.id}">{t('common.reason')}</label>
								<input id="ajr-{e.id}" name="reason" required minlength="3" />
							{/if}
							<button class="btn small" type="submit">{t('admin.assignments.add')}</button>
						</form>
					</article>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.alist {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.alist li {
		border-bottom: 1px solid var(--border);
		padding: 0.35rem 0;
	}
	.alist input[name='reason'] {
		max-width: 10rem;
	}
</style>

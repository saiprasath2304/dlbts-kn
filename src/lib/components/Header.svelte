<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { t } from '#lib/i18n/t.svelte.ts';

	const profile = $derived(page.data.profile);
	const locale = $derived(page.data.locale);
</script>

<header class="site-header">
	<div class="bar">
		<a class="brand" href="/">
			<img src="/logo.png" alt="" width="46" height="46" />
			<span>{page.data.appTitle}</span>
		</a>
		<div class="tools">
			{#if profile?.role === 'judge'}
				<a class="btn ghost small" href="/judge">{t('nav.my_events')}</a>
			{/if}
			<form method="POST" action="/lang" use:enhance>
				<input type="hidden" name="locale" value={locale === 'ta' ? 'en' : 'ta'} />
				<input type="hidden" name="next" value={page.url.pathname + page.url.search} />
				<button class="btn ghost small" type="submit" lang={locale === 'ta' ? 'en' : 'ta'}>
					<span class="visually-hidden">{t('lang.label')}: </span>{t('lang.switch_to')}
				</button>
			</form>
			{#if profile}
				<span class="who" title={profile.username}>{profile.display_name}</span>
				<form method="POST" action="/logout">
					<button class="btn ghost small" type="submit">{t('nav.logout')}</button>
				</form>
			{/if}
		</div>
	</div>
</header>

<style>
	.site-header {
		background: rgb(255 255 255 / 0.92);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 20;
		backdrop-filter: blur(6px);
	}
	.bar {
		max-width: var(--maxw);
		margin: 0 auto;
		padding: 0.55rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		text-decoration: none;
		color: var(--heading);
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: 0.01em;
	}
	.brand img {
		border-radius: 50%;
		box-shadow:
			0 0 0 2px #fff,
			0 1px 6px rgb(38 51 111 / 0.18);
	}
	.tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.who {
		font-size: 0.9rem;
		color: var(--muted);
		max-width: 16rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	@media (max-width: 640px) {
		.who {
			display: none;
		}
		.brand {
			font-size: 1.1rem;
		}
	}
</style>

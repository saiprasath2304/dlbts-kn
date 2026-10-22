<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { children } = $props();
	let open = $state(false);
	afterNavigate(() => (open = false));

	type Link = [href: string, key: string];
	const sections: [title: string, links: Link[]][] = [
		[
			'nav.section_overview',
			[
				['/admin', 'nav.dashboard'],
				['/admin/results', 'nav.results'],
				['/admin/reports', 'nav.reports']
			]
		],
		[
			'nav.section_judging',
			[
				['/admin/submissions', 'nav.submissions'],
				['/admin/requests', 'nav.requests']
			]
		],
		[
			'nav.section_setup',
			[
				['/admin/events', 'nav.events'],
				['/admin/groups', 'nav.groups'],
				['/admin/participants', 'nav.participants'],
				['/admin/judges', 'nav.judges'],
				['/admin/assignments', 'nav.assignments']
			]
		],
		[
			'nav.section_system',
			[
				['/admin/audit', 'nav.audit'],
				['/admin/settings', 'nav.settings']
			]
		]
	];

	const path = $derived(page.url.pathname);
	const isCurrent = (href: string) =>
		href === '/admin' ? path === '/admin' : path.startsWith(href);
	const currentLabel = $derived(
		sections.flatMap(([, items]) => items).find(([href]) => isCurrent(href))?.[1] ?? 'nav.dashboard'
	);
</script>

<div class="shell">
	<aside class="side">
		<button
			class="btn secondary block menu-toggle"
			type="button"
			aria-expanded={open}
			aria-controls="admin-nav"
			onclick={() => (open = !open)}
		>
			☰ {t('nav.menu')}: {t(currentLabel)}
		</button>
		<nav id="admin-nav" aria-label="Admin" class:open>
			{#each sections as [title, items] (title)}
				<div class="section">
					<div class="section-title">{t(title)}</div>
					<ul>
						{#each items as [href, key] (href)}
							<li><a {href} aria-current={isCurrent(href) ? 'page' : undefined}>{t(key)}</a></li>
						{/each}
					</ul>
				</div>
			{/each}
		</nav>
	</aside>
	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.shell {
		max-width: var(--maxw);
		margin: 0 auto;
		padding: 1.25rem 1rem 2rem;
		display: grid;
		gap: 1.5rem;
		grid-template-columns: 1fr;
	}
	.content {
		min-width: 0;
	}
	nav {
		display: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.6rem;
		margin-top: 0.5rem;
		box-shadow: var(--shadow);
	}
	nav.open {
		display: block;
	}
	.section + .section {
		margin-top: 0.5rem;
	}
	.section-title {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		padding: 0.4rem 0.75rem 0.2rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	a {
		display: block;
		padding: 0.55rem 0.75rem;
		border-radius: 10px;
		text-decoration: none;
		font-weight: 600;
		color: var(--text);
		min-height: 44px;
	}
	a:hover {
		background: var(--surface-soft);
	}
	a[aria-current='page'] {
		background: var(--primary-soft);
		color: var(--primary-hover);
	}
	@media (min-width: 960px) {
		.shell {
			grid-template-columns: 230px 1fr;
		}
		.menu-toggle {
			display: none;
		}
		nav {
			display: block;
			position: sticky;
			top: 5rem;
			margin-top: 0;
		}
	}
</style>

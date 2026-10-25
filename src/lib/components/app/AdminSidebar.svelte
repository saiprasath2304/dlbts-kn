<script lang="ts">
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Trophy from '@lucide/svelte/icons/trophy';
	import FileText from '@lucide/svelte/icons/file-text';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import Inbox from '@lucide/svelte/icons/inbox';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Users from '@lucide/svelte/icons/users';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Settings from '@lucide/svelte/icons/settings';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import Brand from './Brand.svelte';
	import LanguageToggle from './LanguageToggle.svelte';
	import { t } from '#lib/i18n/t.svelte.ts';
	import type { Component } from 'svelte';

	let { pendingRequests = 0 }: { pendingRequests?: number } = $props();
	const sidebar = Sidebar.useSidebar();
	afterNavigate(() => sidebar.setOpenMobile(false));

	type Item = { href: string; key: string; icon: Component; badge?: boolean };
	const sections: { title: string; items: Item[] }[] = [
		{
			title: 'nav.section_overview',
			items: [
				{ href: '/admin', key: 'nav.dashboard', icon: LayoutDashboard },
				{ href: '/admin/results', key: 'nav.results', icon: Trophy },
				{ href: '/admin/reports', key: 'nav.reports', icon: FileText }
			]
		},
		{
			title: 'nav.section_judging',
			items: [
				{ href: '/admin/submissions', key: 'nav.submissions', icon: ClipboardCheck },
				{ href: '/admin/requests', key: 'nav.requests', icon: Inbox, badge: true }
			]
		},
		{
			title: 'nav.section_setup',
			items: [
				{ href: '/admin/events', key: 'nav.events', icon: CalendarDays },
				{ href: '/admin/participants', key: 'nav.participants', icon: Users },
				{ href: '/admin/judges', key: 'nav.judges', icon: UserCheck }
			]
		},
		{
			title: 'nav.section_system',
			items: [
				{ href: '/admin/audit', key: 'nav.audit', icon: ScrollText },
				{ href: '/admin/settings', key: 'nav.settings', icon: Settings }
			]
		}
	];
	const path = $derived(page.url.pathname);
	const isCurrent = (href: string) =>
		href === '/admin' ? path === '/admin' : path.startsWith(href);
</script>

<Sidebar.Root>
	<Sidebar.Header class="px-3 pt-4 pb-2">
		<Brand href="/admin" />
	</Sidebar.Header>
	<Sidebar.Content>
		{#each sections as section (section.title)}
			<Sidebar.Group>
				<Sidebar.GroupLabel class="text-xs tracking-wider uppercase"
					>{t(section.title)}</Sidebar.GroupLabel
				>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each section.items as item (item.href)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									isActive={isCurrent(item.href)}
									size="lg"
									class="text-[0.95rem]"
								>
									{#snippet child({ props })}
										<a
											href={item.href}
											{...props}
											aria-current={isCurrent(item.href) ? 'page' : undefined}
										>
											<item.icon />
											<span>{t(item.key)}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
								{#if item.badge && pendingRequests > 0}
									<Sidebar.MenuBadge class="bg-warning/30 text-warning-foreground rounded-full"
										>{pendingRequests}</Sidebar.MenuBadge
									>
								{/if}
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>
	<Sidebar.Footer class="gap-2 p-3">
		<div class="px-1 text-sm">
			<div class="truncate font-semibold">{page.data.profile?.display_name}</div>
			<div class="text-muted-foreground truncate font-mono text-xs">
				{page.data.profile?.username}
			</div>
		</div>
		<LanguageToggle class="[&_button]:w-full [&_button]:justify-start" />
		<form method="POST" action="/logout">
			<Button type="submit" variant="ghost" size="sm" class="w-full justify-start"
				><LogOut />{t('nav.logout')}</Button
			>
		</form>
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>

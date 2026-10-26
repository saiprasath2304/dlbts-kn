<script lang="ts">
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Trophy from '@lucide/svelte/icons/trophy';
	import FileText from '@lucide/svelte/icons/file-text';
	import MessageSquareText from '@lucide/svelte/icons/message-square-text';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import Inbox from '@lucide/svelte/icons/inbox';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Users from '@lucide/svelte/icons/users';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Settings from '@lucide/svelte/icons/settings';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import UserMenu from './UserMenu.svelte';
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
				{ href: '/admin/reports', key: 'nav.reports', icon: FileText },
				{ href: '/admin/feedback', key: 'nav.feedback', icon: MessageSquareText }
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
				{ href: '/admin/judges', key: 'nav.judges', icon: UserCheck },
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
	<Sidebar.Header class="border-b px-4 py-3">
		<a href="/admin" class="flex items-center gap-2.5">
			<img src="/logo.png" alt="" width="32" height="32" class="rounded-full" />
			<span class="min-w-0 leading-tight">
				<span class="block truncate text-sm font-semibold">{page.data.appTitle}</span>
				<span class="text-muted-foreground block text-xs">Admin</span>
			</span>
		</a>
	</Sidebar.Header>
	<Sidebar.Content class="gap-0 py-2">
		{#each sections as section (section.title)}
			<Sidebar.Group class="py-1">
				<Sidebar.GroupLabel class="h-7 text-xs">{t(section.title)}</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu class="gap-0.5">
						{#each section.items as item (item.href)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={isCurrent(item.href)} class="h-9">
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
									<Sidebar.MenuBadge
										class="bg-warning/25 text-warning-foreground top-2 rounded-full"
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
	<Sidebar.Footer class="border-t p-2">
		<UserMenu align="start" />
	</Sidebar.Footer>
	<Sidebar.Rail />
</Sidebar.Root>

<script lang="ts">
	import LogOut from '@lucide/svelte/icons/log-out';
	import Languages from '@lucide/svelte/icons/languages';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { withProgress } from '#lib/progress.svelte.ts';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { cn } from '#lib/utils.js';
	import { t } from '#lib/i18n/t.svelte.ts';

	let { compact = false, align = 'end' }: { compact?: boolean; align?: 'start' | 'end' } = $props();
	const profile = $derived(page.data.profile);
	const locale = $derived(page.data.locale);
	const initials = $derived(
		(profile?.display_name ?? '?')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0]?.toUpperCase())
			.join('')
	);
</script>

<form id="lang-form" method="POST" action="/lang" use:enhance={withProgress()} class="hidden">
	<input type="hidden" name="locale" value={locale === 'ta' ? 'en' : 'ta'} />
	<input type="hidden" name="next" value={page.url.pathname + page.url.search} />
</form>
<form id="logout-form" method="POST" action="/logout" class="hidden"></form>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={cn(
			'hover:bg-accent focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-lg p-1.5 text-left outline-none focus-visible:ring-3',
			!compact && 'w-full'
		)}
	>
		<span
			class="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
			>{initials}</span
		>
		{#if !compact}
			<span class="min-w-0 flex-1 leading-tight">
				<span class="block truncate text-sm font-medium">{profile?.display_name}</span>
				<span class="text-muted-foreground block truncate text-xs">{profile?.username}</span>
			</span>
			<ChevronsUpDown class="text-muted-foreground size-4" />
		{:else}
			<span class="sr-only">{profile?.display_name}</span>
		{/if}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content {align} class="w-56">
		<DropdownMenu.Label class="font-normal">
			<div class="truncate text-sm font-medium">{profile?.display_name}</div>
			<div class="text-muted-foreground truncate text-xs">{profile?.username}</div>
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		{#if profile?.role === 'judge'}
			<DropdownMenu.Item>
				{#snippet child({ props })}<a {...props} href="/judge"><ListChecks />{t('nav.my_events')}</a
					>{/snippet}
			</DropdownMenu.Item>
		{/if}
		<DropdownMenu.Item>
			{#snippet child({ props })}
				<button
					{...props}
					type="submit"
					form="lang-form"
					class={cn(props.class as string, 'w-full')}
					lang={locale === 'ta' ? 'en' : 'ta'}
				>
					<Languages />{t('lang.switch_to')}
				</button>
			{/snippet}
		</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item>
			{#snippet child({ props })}
				<button
					{...props}
					type="submit"
					form="logout-form"
					class={cn(props.class as string, 'w-full')}><LogOut />{t('nav.logout')}</button
				>
			{/snippet}
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>

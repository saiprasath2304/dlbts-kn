<script lang="ts">
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { t } from '#lib/i18n/t.svelte.ts';

	const sidebar = Sidebar.useSidebar();
</script>

<Button variant="ghost" size="icon-sm" onclick={() => sidebar.toggle()} aria-label={t('nav.menu')}>
	<PanelLeft />
</Button>

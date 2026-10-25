<script lang="ts">
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { t } from '#lib/i18n/t.svelte.ts';

	const sidebar = Sidebar.useSidebar();
</script>

<!-- Visible text label on phones: easier than an icon-only control. -->
<Button variant="outline" size="sm" onclick={() => sidebar.toggle()} aria-label={t('nav.menu')}>
	<PanelLeft />
	<span class="md:sr-only">{t('nav.menu')}</span>
</Button>

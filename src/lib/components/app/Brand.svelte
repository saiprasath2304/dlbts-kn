<script lang="ts">
	import { page } from '$app/state';

	let { size = 40, href = '/' }: { size?: number; href?: string } = $props();
</script>

<a
	{href}
	class="text-foreground flex min-w-0 items-center gap-2.5 font-bold tracking-tight no-underline"
>
	<img
		src="/logo.png"
		alt=""
		width={size}
		height={size}
		class="shrink-0 rounded-full shadow-[0_0_0_2px_white,0_1px_6px_rgb(38_51_111/0.18)]"
	/>
	<span class="truncate text-lg">{page.data.appTitle}</span>
</a>

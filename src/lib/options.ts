import type { Option } from '#lib/components/app/AppSelect.svelte';

type G = { id: string; name: string; events?: { id: string; name: string }[] };

export const all = (label: string): Option => ({ value: '', label });

export const groupOptions = (groups: G[]): Option[] =>
	groups.map((g) => ({ value: g.id, label: g.name }));

/** Events, headed by their group name in the dropdown. */
export const eventOptions = (groups: G[]): Option[] =>
	groups.flatMap((g) =>
		(g.events ?? []).map((e) => ({ value: e.id, label: e.name, group: g.name }))
	);

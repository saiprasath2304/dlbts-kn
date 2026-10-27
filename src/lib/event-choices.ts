export type EventKind = 'individual' | 'team';

export interface ChoiceGroup {
	id: string;
	name: string;
	events: { id: string; name: string; participation?: string | null; is_active?: boolean }[];
}

/** Groups whose events are all team events (e.g. "Team Events", "Group Events"): open to every child. */
export function commonGroupIds(groups: ChoiceGroup[]): Set<string> {
	return new Set(
		groups
			.filter((g) => g.events.length > 0 && g.events.every((e) => e.participation === 'team'))
			.map((g) => g.id)
	);
}

/**
 * Events a child can be added to.
 * - individual: individual events of the child's own group
 * - team: team events of the child's own group, plus every event of the
 *   common team groups (Team Events / Group Events)
 * Without a group, all events of that kind are offered. Events the child is
 * already in are left out.
 */
export function eventChoices(
	groups: ChoiceGroup[],
	kind: EventKind,
	childGroupId: string | null | undefined,
	alreadyIn: Iterable<string> = []
): { value: string; label: string; group: string }[] {
	const common = commonGroupIds(groups);
	const skip = new Set(alreadyIn);
	const out: { value: string; label: string; group: string }[] = [];
	for (const g of groups) {
		for (const e of g.events) {
			if (e.is_active === false || skip.has(e.id)) continue;
			const isTeam = e.participation === 'team';
			if (kind === 'individual') {
				if (isTeam || (childGroupId && g.id !== childGroupId)) continue;
			} else {
				if (!isTeam) continue;
				if (childGroupId && g.id !== childGroupId && !common.has(g.id)) continue;
			}
			out.push({ value: e.id, label: e.name, group: g.name });
		}
	}
	return out;
}

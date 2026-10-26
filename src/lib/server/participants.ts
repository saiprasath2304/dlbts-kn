import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/database.types.ts';
import type { KnownData } from '#lib/import/participants.ts';

type Db = SupabaseClient<Database>;

export async function loadKnown(db: Db, codes: string[]): Promise<KnownData> {
	const [{ data: groups }, { data: events }] = await Promise.all([
		db.from('groups').select('id, code'),
		db.from('events').select('group_id, code')
	]);
	const byId = new Map((groups ?? []).map((g) => [g.id, g.code]));
	const map = new Map<string, Set<string>>((groups ?? []).map((g) => [g.code, new Set<string>()]));
	for (const e of events ?? []) map.get(byId.get(e.group_id) ?? '')?.add(e.code);

	const existing: KnownData['existing'] = new Map();
	const unique = [...new Set(codes)];
	for (let i = 0; i < unique.length; i += 200) {
		const { data } = await db
			.from('participants')
			.select('code, name, group_id')
			.in('code', unique.slice(i, i + 200));
		for (const p of data ?? [])
			existing.set(p.code, {
				name: p.name,
				group_code: p.group_id ? (byId.get(p.group_id) ?? null) : null
			});
	}
	return { groups: map, existing };
}

export const EXPORT_HEADER = [
	'code',
	'name',
	'group_code',
	'event_code',
	'kind',
	'affiliation',
	'registration_no',
	'notes',
	'members',
	'memento_given',
	'active'
] as const;

/** One row per participant-event entry (participants with no event get one row). */
export async function exportRows(db: Db, filter: { group?: string; event?: string }) {
	let q = db
		.from('participants')
		.select(
			'code, name, kind, affiliation, registration_no, notes, members, memento_given, is_active, group_id, groups(code), event_participants(is_active, events(id, code))'
		)
		.order('code');
	if (filter.group) q = q.eq('group_id', filter.group);
	const { data } = await q;
	const rows: (string | boolean)[][] = [];
	for (const p of data ?? []) {
		const links = (p.event_participants ?? []).filter((l) => l.is_active && l.events);
		const scoped = filter.event ? links.filter((l) => l.events!.id === filter.event) : links;
		if (filter.event && scoped.length === 0) continue;
		const base = (event: string) => [
			p.code,
			p.name,
			p.groups?.code ?? '',
			event,
			p.kind,
			p.affiliation ?? '',
			p.registration_no ?? '',
			p.notes ?? '',
			p.members ?? '',
			p.memento_given ? 'yes' : 'no',
			p.is_active ? 'yes' : 'no'
		];
		if (scoped.length === 0) rows.push(base(''));
		for (const l of scoped) rows.push(base(l.events!.code));
	}
	return rows;
}

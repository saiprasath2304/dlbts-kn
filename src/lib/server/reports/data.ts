import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '#lib/database.types.ts';
import type { FinalSnapshot } from '#lib/results.ts';
import type { FinalEventEntry, ProgressEvent } from './pdf.ts';

type Db = SupabaseClient<Database>;

/**
 * Final report data comes ONLY from active finalization snapshots. Events
 * without one are listed as pending and never show rankings.
 */
export async function loadFinalReportData(db: Db): Promise<FinalEventEntry[]> {
	const [{ data: events }, { data: finals }] = await Promise.all([
		db
			.from('events')
			.select('id, name, display_order, groups(name, display_order)')
			.eq('is_active', true),
		db
			.from('result_finalizations')
			.select('event_id, snapshot, finalized_at')
			.eq('status', 'active')
	]);
	return (events ?? [])
		.map((e) => {
			const f = (finals ?? []).find((x) => x.event_id === e.id);
			return {
				group: e.groups?.name ?? '',
				groupOrder: e.groups?.display_order ?? 0,
				event: e.name,
				eventOrder: e.display_order,
				snapshot: f ? (f.snapshot as unknown as FinalSnapshot) : null,
				finalizedAt: f?.finalized_at ?? null
			};
		})
		.sort(
			(a, b) =>
				a.groupOrder - b.groupOrder ||
				a.group.localeCompare(b.group) ||
				a.eventOrder - b.eventOrder ||
				a.event.localeCompare(b.event)
		);
}

export async function loadProgressReportData(db: Db): Promise<ProgressEvent[]> {
	const [{ data: progress }, { data: subs }] = await Promise.all([
		db.rpc('admin_event_progress'),
		db
			.from('submissions')
			.select(
				'event_id, judge_id, status, profiles!submissions_judge_id_fkey(display_name, is_active)'
			)
	]);
	const { data: assigns } = await db
		.from('judge_assignments')
		.select('event_id, judge_id')
		.eq('is_active', true);
	const required = new Set((assigns ?? []).map((a) => `${a.event_id}|${a.judge_id}`));
	return (progress ?? [])
		.filter((e) => e.event_active)
		.map((e) => ({
			group: e.group_name,
			event: e.event_name,
			required: e.required_judges,
			submitted: e.submitted,
			finalized: e.finalized,
			judges: (subs ?? [])
				.filter(
					(s) =>
						s.event_id === e.event_id &&
						required.has(`${s.event_id}|${s.judge_id}`) &&
						s.profiles?.is_active
				)
				.map((s) => ({ name: s.profiles?.display_name ?? '', status: s.status }))
		}));
}

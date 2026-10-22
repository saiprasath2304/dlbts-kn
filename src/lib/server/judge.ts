import { error } from '@sveltejs/kit';
import type { SubmissionStatus } from '#lib/types.ts';

/**
 * Everything a judge needs for one assigned event. All queries run with the
 * judge's own session, so RLS guarantees they only see their own assignment,
 * submission and marks. An unassigned event id simply returns 404.
 */
export async function loadJudgeEvent(locals: App.Locals, eventId: string) {
	const db = locals.supabase;
	const judgeId = locals.profile!.id;
	if (!/^[0-9a-f-]{36}$/i.test(eventId)) error(404, { message: 'Not found' });

	const [eventRes, criteriaRes, entriesRes, submissionRes] = await Promise.all([
		db
			.from('events')
			.select('id, code, name, description, instructions, score_precision, groups(id, code, name)')
			.eq('id', eventId)
			.maybeSingle(),
		db
			.from('evaluation_criteria')
			.select('id, name, description, max_marks, display_order')
			.eq('event_id', eventId)
			.eq('is_active', true)
			.order('display_order')
			.order('name'),
		db
			.from('event_participants')
			.select('display_order, participants(id, code, name, kind, affiliation)')
			.eq('event_id', eventId)
			.eq('is_active', true),
		db
			.from('submissions')
			.select('id, status, version, round, submitted_at, last_saved_at')
			.eq('event_id', eventId)
			.eq('judge_id', judgeId)
			.maybeSingle()
	]);
	if (!eventRes.data || !submissionRes.data) error(404, { message: 'Not found' });

	const submission = submissionRes.data as typeof submissionRes.data & { status: SubmissionStatus };
	const [scoresRes, correctionsRes, reopeningsRes] = await Promise.all([
		db
			.from('criterion_scores')
			.select('participant_id, criterion_id, value, version, updated_at')
			.eq('submission_id', submission.id),
		db
			.from('correction_requests')
			.select(
				'id, participant_id, criterion_ids, message, status, judge_response, created_at, unlocks_submission'
			)
			.eq('submission_id', submission.id)
			.order('created_at', { ascending: false }),
		db
			.from('reopening_requests')
			.select('id, reason, status, resolution_note, created_at, resolved_at')
			.eq('submission_id', submission.id)
			.order('created_at', { ascending: false })
	]);

	const participants = (entriesRes.data ?? [])
		.filter((e) => e.participants)
		.map((e) => ({ ...e.participants!, display_order: e.display_order }))
		.sort((a, b) => a.display_order - b.display_order || a.code.localeCompare(b.code));

	const criteria = (criteriaRes.data ?? []).map((c) => ({ ...c, max_marks: Number(c.max_marks) }));

	return {
		event: eventRes.data,
		group: eventRes.data.groups!,
		criteria,
		participants,
		submission,
		scores: (scoresRes.data ?? []).map((s) => ({
			...s,
			value: s.value === null ? null : Number(s.value)
		})),
		corrections: correctionsRes.data ?? [],
		reopenings: reopeningsRes.data ?? []
	};
}

export type JudgeEventData = Awaited<ReturnType<typeof loadJudgeEvent>>;

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
			.select(
				'id, code, name, description, instructions, score_precision, venue, groups(id, code, name)'
			)
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
			// Judges never receive names, Samithi or team member names: only code, reg. no and DOB.
			.select('display_order, participants(id, code, kind, registration_no, dob, dob_verified)')
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
	const [scoresRes, correctionsRes, reopeningsRes, remarksRes, contextRes, preqRes, openRes] =
		await Promise.all([
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
				.order('created_at', { ascending: false }),
			db
				.from('participant_remarks')
				.select('participant_id, remark, updated_at')
				.eq('submission_id', submission.id),
			db.rpc('event_participant_context', { p_event_id: eventId }),
			db
				.from('participant_requests')
				.select(
					'id, request_type, participant_id, name, details, status, resolution_note, created_at'
				)
				.eq('event_id', eventId)
				.eq('requested_by', judgeId)
				.order('created_at', { ascending: false }),
			db.rpc('scoring_is_open')
		]);

	const participants = (entriesRes.data ?? [])
		.filter((e) => e.participants)
		.map((e) => ({
			...e.participants!,
			/** What judges see in place of a name. */
			label: e.participants!.registration_no || e.participants!.code,
			display_order: e.display_order
		}))
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
		reopenings: reopeningsRes.data ?? [],
		remarks: Object.fromEntries(
			(remarksRes.data ?? []).map((r) => [r.participant_id, r.remark])
		) as Record<string, string>,
		context: Object.fromEntries(
			(contextRes.data ?? []).map((c) => [
				c.participant_id,
				{
					other_events: (c.other_events ?? []) as {
						event_id: string;
						name: string;
						group: string;
						venue: string | null;
					}[],
					memento: { given: c.memento_given, at: c.memento_given_at, by: c.memento_given_by_name },
					dob: { verified: c.dob_verified, at: c.dob_verified_at, by: c.dob_verified_by_name }
				}
			])
		) as Record<string, ParticipantContext>,
		participantRequests: preqRes.data ?? [],
		scoringOpen: openRes.data === true
	};
}

export interface ParticipantContext {
	other_events: { event_id: string; name: string; group: string; venue: string | null }[];
	memento: { given: boolean; at: string | null; by: string | null };
	dob: { verified: boolean; at: string | null; by: string | null };
}

export type JudgeEventData = Awaited<ReturnType<typeof loadJudgeEvent>>;

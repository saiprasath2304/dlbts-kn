import { beforeAll, describe, expect, it } from 'vitest';
import { makeFixture, saveAll, service, submit, type Fixture } from './helpers';
import type { EventResults } from '../../src/lib/results';

let f: Fixture;
const results = async () => {
	const { data, error } = await f.admin.client.rpc('get_event_results', { p_event_id: f.eventId });
	if (error) throw error;
	return data as unknown as EventResults;
};
const byCode = (r: EventResults, i: number) =>
	r.participants!.find((p) => p.participant_id === f.participants[i].id)!;

beforeAll(async () => {
	// 3 judges, 4 participants, one criterion out of 100 to make totals obvious.
	f = await makeFixture({ judges: 3, participants: 4, criteria: [100], precision: 0 });
});

describe('aggregation and ranking', () => {
	it('hides results until every required judge has submitted', async () => {
		await saveAll(f, 0, [[90], [80], [70], [70]]);
		await saveAll(f, 1, [[85], [80], [75], [75]]);
		await saveAll(f, 2, [[92], [90], [60], [60]]);
		await submit(f, 0);
		await submit(f, 1);
		const r = await results();
		expect(r).toMatchObject({
			status: 'judging_in_progress',
			complete: false,
			required_judges: 3,
			submitted_judges: 2,
			participants: null
		});
	});

	it('does not count inactive or unassigned judges', async () => {
		// A removed assignment no longer counts toward completion.
		const extra = await makeFixture({ judges: 1, participants: 1 });
		const { error } = await f.admin.client.rpc('admin_set_assignment', {
			p_event_id: f.eventId,
			p_judge_id: extra.judges[0].id,
			p_active: true,
			p_reason: 'extra judge'
		});
		expect(error).toBeNull();
		expect((await results()).required_judges).toBe(4);
		await f.admin.client.rpc('admin_set_assignment', {
			p_event_id: f.eventId,
			p_judge_id: extra.judges[0].id,
			p_active: false,
			p_reason: 'not needed'
		});
		expect((await results()).required_judges).toBe(3);
	});

	it('sums the totals of all required judges (90 + 85 + 92 = 267)', async () => {
		await submit(f, 2);
		const r = await results();
		expect(r.complete).toBe(true);
		expect(byCode(r, 0)).toMatchObject({ aggregate: 267, final_rank: 1, tied: false });
		expect(byCode(r, 0).judge_totals).toEqual({
			[f.judges[0].id]: 90,
			[f.judges[1].id]: 85,
			[f.judges[2].id]: 92
		});
		expect(byCode(r, 1)).toMatchObject({ aggregate: 250, final_rank: 2 });
	});

	it('flags ties and never breaks them automatically', async () => {
		const r = await results();
		expect(r.status).toBe('awaiting_tie_resolution');
		expect(byCode(r, 2)).toMatchObject({
			aggregate: 205,
			tied: true,
			final_rank: null,
			calc_rank: 3
		});
		expect(byCode(r, 3)).toMatchObject({
			aggregate: 205,
			tied: true,
			final_rank: null,
			calc_rank: 3
		});
		expect(r.ties).toHaveLength(1);
		const fin = await f.admin.client.rpc('finalize_event_results', { p_event_id: f.eventId });
		expect(fin.error?.message).toBe('NOT_READY');
	});

	it('requires valid ranks and a reason to resolve a tie', async () => {
		const ids = [f.participants[2].id, f.participants[3].id];
		const bad = await f.admin.client.rpc('resolve_tie', {
			p_event_id: f.eventId,
			p_participant_ids: ids,
			p_ranks: { [ids[0]]: 1, [ids[1]]: 2 },
			p_reason: 'x long enough',
			p_related_correction_ids: []
		});
		expect(bad.error?.message).toBe('INVALID_RANKS');
		const noReason = await f.admin.client.rpc('resolve_tie', {
			p_event_id: f.eventId,
			p_participant_ids: ids,
			p_ranks: { [ids[0]]: 3, [ids[1]]: 4 },
			p_reason: '',
			p_related_correction_ids: []
		});
		expect(noReason.error?.message).toBe('REASON_REQUIRED');
		const ok = await f.admin.client.rpc('resolve_tie', {
			p_event_id: f.eventId,
			p_participant_ids: ids,
			p_ranks: { [ids[0]]: 4, [ids[1]]: 3 },
			p_reason: 'Higher score from the chief judge',
			p_related_correction_ids: []
		});
		expect(ok.error).toBeNull();
		const r = await results();
		expect(r.status).toBe('ready_for_finalization');
		expect(byCode(r, 3).final_rank).toBe(3);
		expect(byCode(r, 2).final_rank).toBe(4);
		const { data: stored } = await service
			.from('tie_resolutions')
			.select('original, reason, ranks')
			.eq('event_id', f.eventId)
			.eq('is_active', true)
			.single();
		expect(stored?.reason).toBe('Higher score from the chief judge');
		expect((stored?.original as unknown[]).length).toBe(2);
	});

	it('finalizes into an immutable snapshot', async () => {
		const { error } = await f.admin.client.rpc('finalize_event_results', { p_event_id: f.eventId });
		expect(error).toBeNull();
		const r = await results();
		expect(r.status).toBe('finalized');
		const { data: snap } = await service
			.from('result_finalizations')
			.select('snapshot, status')
			.eq('event_id', f.eventId)
			.eq('status', 'active')
			.single();
		const s = snap?.snapshot as unknown as EventResults & {
			event: { name: string };
			breakdown: unknown[];
		};
		expect(s.participants?.find((p) => p.participant_id === f.participants[0].id)?.aggregate).toBe(
			267
		);
		expect(s.breakdown).toHaveLength(12);
		const twice = await f.admin.client.rpc('finalize_event_results', { p_event_id: f.eventId });
		expect(twice.error?.message).toBe('ALREADY_FINALIZED');
	});

	it('an authorized correction invalidates the finalization and is audited', async () => {
		const sub = f.submissions[f.judges[0].id];
		const noReason = await f.admin.client.rpc('admin_set_score', {
			p_submission_id: sub,
			p_participant_id: f.participants[2].id,
			p_criterion_id: f.criteria[0].id,
			p_value: 71,
			p_reason: ''
		});
		expect(noReason.error?.message).toBe('REASON_REQUIRED');
		const { error } = await f.admin.client.rpc('admin_set_score', {
			p_submission_id: sub,
			p_participant_id: f.participants[2].id,
			p_criterion_id: f.criteria[0].id,
			p_value: 71,
			p_reason: 'Judge confirmed typo on sheet'
		});
		expect(error).toBeNull();
		const r = await results();
		expect(r.status).toBe('ready_for_finalization'); // tie gone (206 vs 205), finalization invalidated
		expect(byCode(r, 2)).toMatchObject({ aggregate: 206, final_rank: 3, tied: false });
		const { data: fins } = await service
			.from('result_finalizations')
			.select('status, invalidation_reason')
			.eq('event_id', f.eventId);
		expect(fins?.every((x) => x.status === 'invalidated')).toBe(true);
		const { data: audit } = await service
			.from('audit_logs')
			.select('action, reason')
			.eq('event_id', f.eventId)
			.in('action', ['score.admin_corrected', 'results.invalidated']);
		expect(audit?.map((a) => a.action).sort()).toEqual([
			'results.invalidated',
			'score.admin_corrected'
		]);
		const { data: sub2 } = await service
			.from('submissions')
			.select('status')
			.eq('id', sub)
			.single();
		expect(sub2?.status).toBe('submitted'); // stays locked
	});

	it('reopening a submission makes results incomplete again', async () => {
		await f.admin.client.rpc('finalize_event_results', { p_event_id: f.eventId });
		const { error } = await f.admin.client.rpc('admin_reopen_submission', {
			p_submission_id: f.submissions[f.judges[1].id],
			p_reason: 'Judge asked to recheck'
		});
		expect(error).toBeNull();
		const r = await results();
		expect(r).toMatchObject({ status: 'judging_in_progress', participants: null });
	});
});

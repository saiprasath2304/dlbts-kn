import { beforeAll, describe, expect, it } from 'vitest';
import { makeFixture, service, submit, type Fixture } from './helpers';

let f: Fixture;
const full = [
	[22, 24, 21, 23],
	[20, 20, 20, 20.5]
];

beforeAll(async () => {
	f = await makeFixture({ judges: 1, participants: 2, precision: 1 });
});

describe('autosave and validation', () => {
	it('saves marks, moves to in_progress and computes nothing from the client', async () => {
		const j = f.judges[0];
		const { data, error } = await j.client.rpc('save_scores', {
			p_submission_id: f.submissions[j.id],
			p_changes: [
				{
					participant_id: f.participants[0].id,
					criterion_id: f.criteria[0].id,
					value: 22,
					base_version: 0
				}
			]
		});
		expect(error).toBeNull();
		expect(data).toMatchObject({
			status: 'in_progress',
			results: [{ status: 'saved', version: 1 }]
		});
	});

	it('rejects out-of-range and over-precise marks', async () => {
		const j = f.judges[0];
		const { data } = await j.client.rpc('save_scores', {
			p_submission_id: f.submissions[j.id],
			p_changes: [
				{
					participant_id: f.participants[0].id,
					criterion_id: f.criteria[1].id,
					value: 26,
					base_version: 0
				},
				{
					participant_id: f.participants[0].id,
					criterion_id: f.criteria[1].id,
					value: -1,
					base_version: 0
				},
				{
					participant_id: f.participants[0].id,
					criterion_id: f.criteria[1].id,
					value: 20.25,
					base_version: 0
				},
				{
					participant_id: f.participants[0].id,
					criterion_id: f.criteria[1].id,
					value: 'abc',
					base_version: 0
				}
			]
		});
		const codes = (data as { results: { code: string }[] }).results.map((r) => r.code);
		expect(codes).toEqual(['OUT_OF_RANGE', 'OUT_OF_RANGE', 'PRECISION', 'INVALID_VALUE']);
	});

	it('detects version conflicts instead of overwriting newer marks', async () => {
		const j = f.judges[0];
		const sub = f.submissions[j.id];
		const p = f.participants[0].id;
		const c = f.criteria[0].id;
		await j.client.rpc('save_scores', {
			p_submission_id: sub,
			p_changes: [{ participant_id: p, criterion_id: c, value: 23, base_version: 1 }]
		}); // -> v2
		const { data } = await j.client.rpc('save_scores', {
			p_submission_id: sub,
			p_changes: [{ participant_id: p, criterion_id: c, value: 15, base_version: 1 }]
		});
		expect((data as { results: unknown[] }).results[0]).toMatchObject({
			status: 'conflict',
			server_value: 23,
			server_version: 2
		});
		const { data: row } = await service
			.from('criterion_scores')
			.select('value')
			.eq('submission_id', sub)
			.eq('participant_id', p)
			.eq('criterion_id', c)
			.single();
		expect(Number(row?.value)).toBe(23);
	});
});

describe('final submission and locking', () => {
	it('rejects incomplete submissions', async () => {
		const { error } = await submit(f, 0);
		expect(error?.message).toBe('INCOMPLETE');
	});

	it('rejects a submit if marks changed after review (version check)', async () => {
		const j = f.judges[0];
		const { error } = await j.client.rpc('submit_submission', {
			p_submission_id: f.submissions[j.id],
			p_expected_version: 0
		});
		expect(['VERSION_CONFLICT', 'INCOMPLETE']).toContain(error?.message);
	});

	it('submits a complete submission atomically and records who/when', async () => {
		const j = f.judges[0];
		const { data: current } = await service
			.from('criterion_scores')
			.select('participant_id, criterion_id, version')
			.eq('submission_id', f.submissions[j.id]);
		const changes = f.participants.flatMap((p, pi) =>
			f.criteria.map((c, ci) => ({
				participant_id: p.id,
				criterion_id: c.id,
				value: full[pi][ci],
				base_version:
					current?.find((x) => x.participant_id === p.id && x.criterion_id === c.id)?.version ?? 0
			}))
		);
		const saved = await j.client.rpc('save_scores', {
			p_submission_id: f.submissions[j.id],
			p_changes: changes
		});
		expect(
			(saved.data as { results: { status: string }[] }).results.every((r) => r.status === 'saved')
		).toBe(true);
		const { data, error } = await submit(f, 0);
		expect(error).toBeNull();
		expect(data).toMatchObject({
			status: 'submitted',
			round: 1,
			participant_count: 2,
			criteria_count: 4
		});
		const { data: sub } = await service
			.from('submissions')
			.select('status, submitted_by, submitted_at')
			.eq('id', f.submissions[j.id])
			.single();
		expect(sub).toMatchObject({ status: 'submitted', submitted_by: j.id });
		expect(sub?.submitted_at).toBeTruthy();
		const { data: round } = await service
			.from('submission_rounds')
			.select('totals')
			.eq('submission_id', f.submissions[j.id])
			.eq('round', 1)
			.single();
		expect(Number((round?.totals as Record<string, number>)[f.participants[0].id])).toBe(90);
	});

	it('blocks every further edit after submission (server-enforced)', async () => {
		const j = f.judges[0];
		const { error } = await j.client.rpc('save_scores', {
			p_submission_id: f.submissions[j.id],
			p_changes: [
				{
					participant_id: f.participants[0].id,
					criterion_id: f.criteria[0].id,
					value: 1,
					base_version: 99
				}
			]
		});
		expect(error?.message).toBe('SUBMISSION_LOCKED');
		// Even the service role cannot change a locked mark without the admin override path.
		const direct = await service
			.from('criterion_scores')
			.update({ value: 1 })
			.eq('submission_id', f.submissions[j.id]);
		expect(direct.error?.message).toBe('SUBMISSION_LOCKED');
		const del = await service
			.from('criterion_scores')
			.delete()
			.eq('submission_id', f.submissions[j.id]);
		expect(del.error?.message).toBe('SCORE_DELETE_FORBIDDEN');
		const again = await submit(f, 0);
		expect(again.error?.message).toBe('SUBMISSION_LOCKED');
	});
});

describe('reopening workflow and history', () => {
	let requestId: string;

	it('judge requests reopening with a reason', async () => {
		const j = f.judges[0];
		const short = await j.client.rpc('request_reopening', {
			p_submission_id: f.submissions[j.id],
			p_reason: ''
		});
		expect(short.error?.message).toBe('REASON_REQUIRED');
		const { data, error } = await j.client.rpc('request_reopening', {
			p_submission_id: f.submissions[j.id],
			p_reason: 'Typed 22 instead of 12 for participant 1'
		});
		expect(error).toBeNull();
		requestId = data as string;
		const { data: sub } = await service
			.from('submissions')
			.select('status')
			.eq('id', f.submissions[j.id])
			.single();
		expect(sub?.status).toBe('reopening_requested');
		const locked = await j.client.rpc('save_scores', {
			p_submission_id: f.submissions[j.id],
			p_changes: []
		});
		expect(locked.error?.message).toBe('SUBMISSION_LOCKED');
	});

	it('admin rejection restores the submitted state', async () => {
		const { error } = await f.admin.client.rpc('resolve_reopening_request', {
			p_request_id: requestId,
			p_approve: false,
			p_note: 'Marks look correct'
		});
		expect(error).toBeNull();
		const { data } = await service
			.from('submissions')
			.select('status')
			.eq('id', f.submissions[f.judges[0].id])
			.single();
		expect(data?.status).toBe('submitted');
	});

	it('admin approval reopens; judge edits and resubmits; history is preserved', async () => {
		const j = f.judges[0];
		const { data: id2 } = await j.client.rpc('request_reopening', {
			p_submission_id: f.submissions[j.id],
			p_reason: 'Need to fix participant 1'
		});
		const ok = await f.admin.client.rpc('resolve_reopening_request', {
			p_request_id: id2 as string,
			p_approve: true,
			p_note: 'Approved'
		});
		expect(ok.error).toBeNull();
		const { data: before } = await service
			.from('criterion_scores')
			.select('version')
			.eq('submission_id', f.submissions[j.id])
			.eq('participant_id', f.participants[0].id)
			.eq('criterion_id', f.criteria[0].id)
			.single();
		const edit = await j.client.rpc('save_scores', {
			p_submission_id: f.submissions[j.id],
			p_changes: [
				{
					participant_id: f.participants[0].id,
					criterion_id: f.criteria[0].id,
					value: 12,
					base_version: before!.version
				}
			]
		});
		expect((edit.data as { results: { status: string }[] }).results[0].status).toBe('saved');
		const { data, error } = await submit(f, 0);
		expect(error).toBeNull();
		expect(data).toMatchObject({ status: 'resubmitted', round: 2 });

		const { data: rounds } = await service
			.from('submission_rounds')
			.select('round, totals')
			.eq('submission_id', f.submissions[j.id])
			.order('round');
		expect(
			rounds?.map((r) => Number((r.totals as Record<string, number>)[f.participants[0].id]))
		).toEqual([90, 80]);
		const { data: hist } = await service
			.from('score_history')
			.select('old_value, new_value')
			.eq('submission_id', f.submissions[j.id])
			.eq('criterion_id', f.criteria[0].id)
			.eq('participant_id', f.participants[0].id)
			.order('id');
		expect(
			hist?.map((h) => [h.old_value === null ? null : Number(h.old_value), Number(h.new_value)])
		).toEqual([
			[null, 22],
			[22, 23],
			[23, 22],
			[22, 12]
		]);
		const { data: transitions } = await service
			.from('submission_transitions')
			.select('to_status')
			.eq('submission_id', f.submissions[j.id])
			.order('id');
		expect(transitions?.map((t) => t.to_status)).toEqual([
			'in_progress',
			'submitted',
			'reopening_requested',
			'submitted',
			'reopening_requested',
			'reopened',
			'resubmitted'
		]);
	});

	it('admin can reopen directly (reason required) and request corrections', async () => {
		const j = f.judges[0];
		const sub = f.submissions[j.id];
		const noReason = await f.admin.client.rpc('admin_reopen_submission', {
			p_submission_id: sub,
			p_reason: ''
		});
		expect(noReason.error?.message).toBe('REASON_REQUIRED');
		const { data: corrId, error } = await f.admin.client.rpc('create_correction_request', {
			p_submission_id: sub,
			p_participant_id: f.participants[1].id,
			p_criterion_ids: [f.criteria[3].id],
			p_message: 'Please re-check criterion 4',
			p_unlock: true
		});
		expect(error).toBeNull();
		const { data: s1 } = await service.from('submissions').select('status').eq('id', sub).single();
		expect(s1?.status).toBe('correction_requested');
		const { data: visible } = await j.client.from('correction_requests').select('id, message');
		expect(visible?.map((c) => c.id)).toContain(corrId);
		const reply = await j.client.rpc('respond_correction_request', {
			p_request_id: corrId as string,
			p_response: 'Checked, it is correct'
		});
		expect(reply.error).toBeNull();
		const resub = await submit(f, 0);
		expect(resub.data).toMatchObject({ status: 'resubmitted', round: 3 });
		const resolved = await f.admin.client.rpc('resolve_correction_request', {
			p_request_id: corrId as string,
			p_note: 'ok',
			p_cancel: false
		});
		expect(resolved.error).toBeNull();
	});
});

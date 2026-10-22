import { beforeAll, describe, expect, it } from 'vitest';
import { anonClient, makeFixture, saveAll, service, type Fixture } from './helpers';

let a: Fixture; // event A with judges a0, a1
let b: Fixture; // event B with judge b0 (unrelated)

beforeAll(async () => {
	a = await makeFixture({ judges: 2, participants: 2 });
	b = await makeFixture({ judges: 1, participants: 1 });
	await saveAll(b, 0, [[10, 10, 10, 10]]);
});

describe('unauthenticated access', () => {
	it('cannot read any application data', async () => {
		const anon = anonClient();
		for (const table of [
			'groups',
			'events',
			'participants',
			'profiles',
			'submissions',
			'criterion_scores',
			'audit_logs',
			'judge_assignments'
		] as const) {
			const { data, error } = await anon.from(table).select('*').limit(5);
			expect(error ?? data?.length === 0, table).toBeTruthy();
			expect(data ?? [], table).toHaveLength(0);
		}
	});
	it('cannot call workflow functions', async () => {
		const { error } = await anonClient().rpc('save_scores', {
			p_submission_id: a.submissions[a.judges[0].id],
			p_changes: []
		});
		expect(error).not.toBeNull();
	});
	it('cannot self-register', async () => {
		const { error } = await anonClient().auth.signUp({
			email: 'intruder@judges.invalid',
			password: 'password123'
		});
		expect(error?.message ?? '').toMatch(/signup|not allowed|disabled/i);
	});
});

describe('judge isolation', () => {
	it('sees only their own assigned events, groups and participants', async () => {
		const judge = a.judges[0].client;
		const { data: events } = await judge.from('events').select('id');
		expect(events?.map((e) => e.id)).toEqual([a.eventId]);
		const { data: parts } = await judge.from('participants').select('id');
		expect(new Set(parts?.map((p) => p.id))).toEqual(new Set(a.participants.map((p) => p.id)));
		const { data: groups } = await judge.from('groups').select('id');
		expect(groups?.map((g) => g.id)).toEqual([a.groupId]);
	});

	it("cannot read another judge's assignments, submissions or scores", async () => {
		const judge = a.judges[0].client;
		const { data: assigns } = await judge.from('judge_assignments').select('judge_id');
		expect(assigns?.every((x) => x.judge_id === a.judges[0].id)).toBe(true);
		const { data: subs } = await judge.from('submissions').select('id');
		expect(subs?.map((s) => s.id)).toEqual([a.submissions[a.judges[0].id]]);
		const { data: scores } = await judge
			.from('criterion_scores')
			.select('*')
			.eq('submission_id', b.submissions[b.judges[0].id]);
		expect(scores).toEqual([]);
		const { data: other } = await judge
			.from('criterion_scores')
			.select('*')
			.eq('submission_id', a.submissions[a.judges[1].id]);
		expect(other).toEqual([]);
	});

	it('cannot read other profiles or any audit log', async () => {
		const judge = a.judges[0].client;
		const { data: profiles } = await judge.from('profiles').select('id');
		expect(profiles?.map((p) => p.id)).toEqual([a.judges[0].id]);
		const { data: audit } = await judge.from('audit_logs').select('id').limit(1);
		expect(audit).toEqual([]);
	});

	it('cannot open an unassigned event by changing an id', async () => {
		const judge = a.judges[0].client;
		const { data } = await judge.from('events').select('id').eq('id', b.eventId);
		expect(data).toEqual([]);
		const { data: crit } = await judge
			.from('evaluation_criteria')
			.select('id')
			.eq('event_id', b.eventId);
		expect(crit).toEqual([]);
	});

	it("cannot write marks into someone else's submission", async () => {
		const { error } = await a.judges[0].client.rpc('save_scores', {
			p_submission_id: b.submissions[b.judges[0].id],
			p_changes: [
				{
					participant_id: b.participants[0].id,
					criterion_id: b.criteria[0].id,
					value: 1,
					base_version: 1
				}
			]
		});
		expect(error?.message).toBe('NOT_FOUND');
		const { data } = await service
			.from('criterion_scores')
			.select('value')
			.eq('submission_id', b.submissions[b.judges[0].id])
			.eq('criterion_id', b.criteria[0].id)
			.single();
		expect(Number(data?.value)).toBe(10);
	});

	it('cannot write marks for a participant or criterion of another event', async () => {
		const j = a.judges[0];
		const { data, error } = await j.client.rpc('save_scores', {
			p_submission_id: a.submissions[j.id],
			p_changes: [
				{
					participant_id: b.participants[0].id,
					criterion_id: b.criteria[0].id,
					value: 5,
					base_version: 0
				}
			]
		});
		expect(error).toBeNull();
		expect((data as { results: { status: string; code: string }[] }).results[0]).toMatchObject({
			status: 'invalid',
			code: 'NOT_IN_EVENT'
		});
	});
});

describe('judge cannot escalate or tamper', () => {
	it('cannot change their own role or profile', async () => {
		const j = a.judges[0];
		const { error } = await j.client.from('profiles').update({ role: 'admin' }).eq('id', j.id);
		expect(error?.message).toMatch(/permission denied/);
		const { data } = await service.from('profiles').select('role').eq('id', j.id).single();
		expect(data?.role).toBe('judge');
	});

	it('cannot write tables directly', async () => {
		const j = a.judges[0];
		const sub = a.submissions[j.id];
		const direct = await j.client.from('criterion_scores').insert({
			submission_id: sub,
			participant_id: a.participants[0].id,
			criterion_id: a.criteria[0].id,
			value: 5
		});
		expect(direct.error?.message).toMatch(/permission denied/);
		const upd = await j.client.from('submissions').update({ status: 'submitted' }).eq('id', sub);
		expect(upd.error?.message).toMatch(/permission denied/);
		const { data } = await service.from('submissions').select('status').eq('id', sub).single();
		expect(data?.status).not.toBe('submitted');
		const assign = await j.client
			.from('judge_assignments')
			.insert({ event_id: b.eventId, judge_id: j.id });
		expect(assign.error).not.toBeNull();
		const crit = await j.client
			.from('evaluation_criteria')
			.update({ max_marks: 999 })
			.eq('id', a.criteria[0].id)
			.select();
		expect(crit.data ?? []).toEqual([]);
		const audit = await j.client.from('audit_logs').insert({ action: 'fake' });
		expect(audit.error).not.toBeNull();
	});

	it('is denied admin-only operations', async () => {
		const j = a.judges[0].client;
		const calls = [
			j.rpc('get_event_results', { p_event_id: a.eventId }),
			j.rpc('finalize_event_results', { p_event_id: a.eventId }),
			j.rpc('admin_reopen_submission', {
				p_submission_id: a.submissions[a.judges[0].id],
				p_reason: 'self reopen'
			}),
			j.rpc('admin_set_score', {
				p_submission_id: a.submissions[a.judges[1].id],
				p_participant_id: a.participants[0].id,
				p_criterion_id: a.criteria[0].id,
				p_value: 1,
				p_reason: 'tamper'
			}),
			j.rpc('admin_set_assignment', {
				p_event_id: b.eventId,
				p_judge_id: a.judges[0].id,
				p_active: true,
				p_reason: ''
			}),
			j.rpc('admin_event_progress')
		];
		for (const r of await Promise.all(calls)) expect(r.error?.message).toBe('FORBIDDEN');
	});

	it('cannot call internal or service-only functions', async () => {
		const j = a.judges[0].client;
		const internal = await j.rpc(
			'transition_submission' as never,
			{ p_submission_id: a.submissions[a.judges[0].id], p_to: 'submitted' } as never
		);
		expect(internal.error?.message).toMatch(/permission denied/);
		const svc = await j.rpc('service_create_profile', {
			p_id: a.judges[0].id,
			p_username: 'x',
			p_display_name: 'x',
			p_role: 'admin',
			p_actor: a.judges[0].id
		});
		expect(svc.error).not.toBeNull();
		const log = await j.rpc('log_audit' as never, { p_action: 'fake' } as never);
		expect(log.error).not.toBeNull();
	});

	it('an admin cannot promote anyone through their own session either', async () => {
		const { error } = await a.admin.client
			.from('profiles')
			.update({ role: 'admin' })
			.eq('id', a.judges[0].id);
		expect(error?.message).toMatch(/permission denied/);
		const { data } = await service
			.from('profiles')
			.select('role')
			.eq('id', a.judges[0].id)
			.single();
		expect(data?.role).toBe('judge');
	});

	it('loses access immediately when deactivated', async () => {
		const extra = await makeFixture({ judges: 1, participants: 1 });
		const j = extra.judges[0];
		expect((await j.client.from('events').select('id')).data).toHaveLength(1);
		await service.rpc('service_update_profile', {
			p_id: j.id,
			p_display_name: '',
			p_is_active: false,
			p_actor: extra.admin.id,
			p_reason: 'test'
		});
		expect((await j.client.from('events').select('id')).data).toEqual([]);
		const { error } = await j.client.rpc('save_scores', {
			p_submission_id: extra.submissions[j.id],
			p_changes: []
		});
		expect(error?.message).toBe('NOT_FOUND');
	});
});

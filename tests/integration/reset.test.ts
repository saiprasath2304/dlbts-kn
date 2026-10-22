import { describe, expect, it } from 'vitest';
import { makeFixture, saveAll, service, signIn, submit } from './helpers';

describe('reset for a new year', () => {
	it('removes participants and marks but keeps structure, accounts and assignments', async () => {
		const f = await makeFixture({ judges: 2, participants: 2, criteria: [10, 10], precision: 0 });
		await saveAll(f, 0, [
			[5, 5],
			[6, 6]
		]);
		await submit(f, 0);
		await f.admin.client.rpc('admin_reopen_submission', {
			p_submission_id: f.submissions[f.judges[0].id],
			p_reason: 'test reopen'
		});

		const denied = await f.judges[0].client.rpc('admin_reset_event_data', { p_confirm: 'RESET' });
		expect(denied.error?.message).toBe('FORBIDDEN');
		const unconfirmed = await f.admin.client.rpc('admin_reset_event_data', { p_confirm: 'yes' });
		expect(unconfirmed.error?.message).toBe('CONFIRMATION_REQUIRED');

		const { data, error } = await f.admin.client.rpc('admin_reset_event_data', {
			p_confirm: 'RESET'
		});
		expect(error).toBeNull();
		expect((data as { participants: number }).participants).toBeGreaterThanOrEqual(2);

		const count = async (
			t:
				| 'participants'
				| 'criterion_scores'
				| 'score_history'
				| 'submission_rounds'
				| 'event_participants'
				| 'reopening_requests'
		) => (await service.from(t).select('*', { count: 'exact', head: true })).count;
		for (const t of [
			'participants',
			'criterion_scores',
			'score_history',
			'submission_rounds',
			'event_participants',
			'reopening_requests'
		] as const) {
			expect(await count(t), t).toBe(0);
		}
		const { data: subs } = await service
			.from('submissions')
			.select('status, round, version')
			.eq('event_id', f.eventId);
		expect(subs?.every((s) => s.status === 'not_started' && s.round === 0 && s.version === 0)).toBe(
			true
		);
		const { data: crit } = await service
			.from('evaluation_criteria')
			.select('id')
			.eq('event_id', f.eventId);
		expect(crit).toHaveLength(2);
		const { data: assigns } = await service
			.from('judge_assignments')
			.select('id')
			.eq('event_id', f.eventId)
			.eq('is_active', true);
		expect(assigns).toHaveLength(2);

		// Same usernames and passwords still work.
		const again = await signIn(f.judges[0].username, f.judges[0].password);
		expect((await again.from('events').select('id')).data).toHaveLength(1);

		// The reset itself is audited and the audit log is untouched.
		const { data: audit } = await service
			.from('audit_logs')
			.select('action')
			.eq('action', 'system.reset');
		expect(audit?.length).toBeGreaterThanOrEqual(1);
		const { count: before } = await service
			.from('audit_logs')
			.select('*', { count: 'exact', head: true })
			.eq('event_id', f.eventId);
		expect(before).toBeGreaterThan(0);

		// Append-only protection is back on after the reset.
		const { data: anyLog } = await service.from('audit_logs').select('id').limit(1).single();
		const del = await service.from('audit_logs').delete().eq('id', anyLog!.id);
		expect(del.error?.message).toBe('APPEND_ONLY');
	});
});

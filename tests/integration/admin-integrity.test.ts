import { beforeAll, describe, expect, it } from 'vitest';
import { makeFixture, saveAll, service, type Fixture } from './helpers';

let f: Fixture;
beforeAll(async () => {
	f = await makeFixture({ judges: 1, participants: 1, criteria: [25, 25] });
});

describe('participant import', () => {
	it('imports valid rows and links existing participants without duplicates', async () => {
		const rows = [
			{
				row: 2,
				code: `IMP-${f.eventCode}-1`.toUpperCase(),
				name: 'Import One',
				kind: 'individual',
				group_code: f.groupCode,
				event_code: f.eventCode
			},
			{
				row: 3,
				code: `IMP-${f.eventCode}-2`.toUpperCase(),
				name: 'இறக்குமதி இரண்டு',
				kind: 'team',
				group_code: f.groupCode,
				event_code: f.eventCode
			},
			{
				row: 4,
				code: f.participants[0].code,
				name: `Participant 1 ${f.eventCode.slice(1)}`,
				kind: 'individual',
				group_code: f.groupCode,
				event_code: f.eventCode
			}
		];
		const { data, error } = await f.admin.client.rpc('admin_import_participants', {
			p_rows: rows,
			p_source: 'test.csv',
			p_reason: ''
		});
		expect(error).toBeNull();
		expect(data).toMatchObject({ created: 2, linked: 2, already_linked: 1 });
		const { data: tamil } = await service
			.from('participants')
			.select('name')
			.eq('code', rows[1].code)
			.single();
		expect(tamil?.name).toBe('இறக்குமதி இரண்டு');
	});

	it('is all-or-nothing: one bad row imports nothing', async () => {
		const code = `IMP-${f.eventCode}-9`.toUpperCase();
		const rows = [
			{ row: 2, code, name: 'Would be created', group_code: f.groupCode, event_code: f.eventCode },
			{ row: 3, code: 'BAD CODE', name: 'X', group_code: f.groupCode, event_code: f.eventCode },
			{
				row: 4,
				code: f.participants[0].code,
				name: 'Different Name',
				group_code: f.groupCode,
				event_code: f.eventCode
			},
			{ row: 5, code: 'OK-1', name: 'Y', group_code: 'nogroup', event_code: '' }
		];
		const { error } = await f.admin.client.rpc('admin_import_participants', {
			p_rows: rows,
			p_source: 'bad.csv',
			p_reason: ''
		});
		expect(error?.message).toBe('IMPORT_INVALID');
		const details = JSON.parse(error!.details!) as { row: number; code: string }[];
		expect(details.map((d) => [d.row, d.code])).toEqual([
			[3, 'INVALID_CODE'],
			[4, 'CODE_USED_BY_OTHER_NAME'],
			[5, 'UNKNOWN_GROUP']
		]);
		const { data } = await service.from('participants').select('id').eq('code', code);
		expect(data).toEqual([]);
	});

	it('is denied to judges', async () => {
		const { error } = await f.judges[0].client.rpc('admin_import_participants', {
			p_rows: [],
			p_source: '',
			p_reason: ''
		});
		expect(error?.message).toBe('FORBIDDEN');
	});
});

describe('changes after scoring has started', () => {
	beforeAll(async () => {
		const { data: parts } = await service
			.from('event_participants')
			.select('participant_id')
			.eq('event_id', f.eventId);
		await saveAll(f, 0, [[20, 20]]);
		void parts;
	});

	it('criteria changes need a reason and cannot invalidate existing marks', async () => {
		const c = f.criteria[0].id;
		const noReason = await f.admin.client.rpc('admin_save_criterion', {
			p_event_id: f.eventId,
			p_id: c,
			p_name: 'Criterion 1',
			p_description: '',
			p_max_marks: 30,
			p_display_order: 0,
			p_is_active: true,
			p_reason: ''
		});
		expect(noReason.error?.message).toBe('CONFIRMATION_REQUIRED');
		const below = await f.admin.client.rpc('admin_save_criterion', {
			p_event_id: f.eventId,
			p_id: c,
			p_name: 'Criterion 1',
			p_description: '',
			p_max_marks: 10,
			p_display_order: 0,
			p_is_active: true,
			p_reason: 'lower max'
		});
		expect(below.error?.message).toBe('MAX_BELOW_EXISTING_SCORE');
		const rename = await f.admin.client.rpc('admin_save_criterion', {
			p_event_id: f.eventId,
			p_id: c,
			p_name: 'Clarity',
			p_description: '',
			p_max_marks: 25,
			p_display_order: 0,
			p_is_active: true,
			p_reason: ''
		});
		expect(rename.error).toBeNull();
		const delDirect = await f.admin.client.from('evaluation_criteria').delete().eq('id', c);
		expect(delDirect.error).not.toBeNull();
	});

	it('removing a judge with marks needs confirmation; deleting is impossible', async () => {
		const j = f.judges[0];
		const noReason = await f.admin.client.rpc('admin_set_assignment', {
			p_event_id: f.eventId,
			p_judge_id: j.id,
			p_active: false,
			p_reason: ''
		});
		expect(noReason.error?.message).toBe('CONFIRMATION_REQUIRED');
		const del = await service
			.from('judge_assignments')
			.delete()
			.eq('event_id', f.eventId)
			.eq('judge_id', j.id);
		expect(del.error?.message).toBe('ASSIGNMENT_HAS_SCORES');
	});

	it('adding a participant after scoring started needs a reason', async () => {
		const { data: p } = await f.admin.client
			.from('participants')
			.insert({
				code: `LATE-${f.eventCode}`.toUpperCase(),
				name: 'Late entry',
				group_id: f.groupId
			})
			.select('id')
			.single();
		const noReason = await f.admin.client.rpc('admin_set_event_participant', {
			p_event_id: f.eventId,
			p_participant_id: p!.id,
			p_active: true,
			p_reason: ''
		});
		expect(noReason.error?.message).toBe('CONFIRMATION_REQUIRED');
		const ok = await f.admin.client.rpc('admin_set_event_participant', {
			p_event_id: f.eventId,
			p_participant_id: p!.id,
			p_active: true,
			p_reason: 'Registered late at desk'
		});
		expect(ok.error).toBeNull();
		const { data: audit } = await service
			.from('audit_logs')
			.select('reason')
			.eq('action', 'event_participants.insert')
			.eq('participant_id', p!.id)
			.single();
		expect(audit?.reason).toBe('Registered late at desk');
	});
});

describe('audit log', () => {
	it('records consequential actions with actor and role', async () => {
		const { data } = await service
			.from('audit_logs')
			.select('action, actor_id, actor_role')
			.eq('event_id', f.eventId);
		const actions = new Set(data?.map((d) => d.action));
		for (const a of [
			'events.insert',
			'evaluation_criteria.insert',
			'judge_assignments.insert',
			'scores.saved',
			'evaluation_criteria.update'
		]) {
			expect(actions, a).toContain(a);
		}
		const saved = data?.find((d) => d.action === 'scores.saved');
		expect(saved).toMatchObject({ actor_id: f.judges[0].id, actor_role: 'judge' });
	});

	it('is append-only for everyone, including the service role', async () => {
		const { data: row } = await service
			.from('audit_logs')
			.select('id')
			.eq('event_id', f.eventId)
			.limit(1)
			.single();
		const upd = await service.from('audit_logs').update({ action: 'tampered' }).eq('id', row!.id);
		expect(upd.error?.message).toBe('APPEND_ONLY');
		const del = await service.from('audit_logs').delete().eq('id', row!.id);
		expect(del.error?.message).toBe('APPEND_ONLY');
		const admin = await f.admin.client.from('audit_logs').delete().eq('id', row!.id).select();
		expect(admin.error ?? (admin.data?.length === 0 ? null : 'deleted')).toBeTruthy();
		const { data: still } = await service
			.from('audit_logs')
			.select('action')
			.eq('id', row!.id)
			.single();
		expect(still?.action).not.toBe('tampered');
	});

	it('never stores passwords', async () => {
		const { data } = await service
			.from('audit_logs')
			.select('old_value, new_value, metadata')
			.limit(1000);
		const blob = JSON.stringify(data);
		expect(blob).not.toMatch(/password|pw-[a-z0-9]{6}-/i);
	});
});

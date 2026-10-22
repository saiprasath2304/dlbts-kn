import { writeFileSync } from 'node:fs';
import { makeFixture, saveAll, submit } from '../integration/helpers';

/** Fresh, isolated fixtures for the browser tests (local Supabase only). */
export default async function globalSetup() {
	// Judge flow: one judge, one event -> login lands directly on scoring.
	const judgeFlow = await makeFixture({
		judges: 1,
		participants: 2,
		criteria: [25, 25, 25, 25],
		precision: 1
	});
	// Admin flow: an event whose only judge has already submitted.
	const adminFlow = await makeFixture({
		judges: 1,
		participants: 2,
		criteria: [50, 50],
		precision: 0
	});
	await saveAll(adminFlow, 0, [
		[45, 45],
		[40, 40]
	]);
	const r = await submit(adminFlow, 0);
	if (r.error) throw r.error;

	const pick = (f: typeof judgeFlow) => ({
		eventId: f.eventId,
		eventName: `Event ${f.eventCode.slice(1)}`,
		groupCode: f.groupCode,
		eventCode: f.eventCode,
		participants: f.participants,
		criteria: f.criteria,
		admin: { username: f.admin.username, password: f.admin.password },
		judges: f.judges.map((j) => ({
			id: j.id,
			username: j.username,
			password: j.password,
			submissionId: f.submissions[j.id]
		}))
	});
	writeFileSync(
		'tests/e2e/.fixture.json',
		JSON.stringify({ judgeFlow: pick(judgeFlow), adminFlow: pick(adminFlow) }, null, 2)
	);
}

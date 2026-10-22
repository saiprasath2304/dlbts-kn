/**
 * Integration helpers: talk to a real (local) Supabase as different users.
 * Requires `npm run db:start` and a .env pointing at it. Every fixture uses
 * random codes so tests never collide with each other or with seed data.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import type { Database } from '../../src/lib/database.types';

if (existsSync('.env')) process.loadEnvFile('.env');

export const URL = process.env.PUBLIC_SUPABASE_URL!;
export const PUBLISHABLE = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const DOMAIN = process.env.AUTH_EMAIL_DOMAIN ?? 'judges.invalid';

if (!URL || !PUBLISHABLE || !SECRET)
	throw new Error('Integration tests need .env with local Supabase keys');
if (!/127\.0\.0\.1|localhost/.test(URL))
	throw new Error('Integration tests only run against a local Supabase');

export type Db = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const service: Db = createClient<Database>(URL, SECRET, opts);
export const anonClient = (): Db => createClient<Database>(URL, PUBLISHABLE, opts);

export const rid = () => Math.random().toString(36).slice(2, 8);

export async function signIn(username: string, password: string): Promise<Db> {
	const c = anonClient();
	const { error } = await c.auth.signInWithPassword({ email: `${username}@${DOMAIN}`, password });
	if (error) throw new Error(`sign in ${username}: ${error.message}`);
	return c;
}

export async function createUser(role: 'admin' | 'judge', label: string) {
	const username = `${role === 'admin' ? 'adm' : 'jdg'}${label}${rid()}`.toLowerCase();
	const password = `pw-${rid()}-${rid()}`;
	const { data, error } = await service.auth.admin.createUser({
		email: `${username}@${DOMAIN}`,
		password,
		email_confirm: true
	});
	if (error) throw error;
	const { error: pErr } = await service.rpc('service_create_profile', {
		p_id: data.user.id,
		p_username: username,
		p_display_name: `Test ${role} ${label}`,
		p_role: role,
		p_actor: null as unknown as string
	});
	if (pErr) throw pErr;
	return { id: data.user.id, username, password, client: await signIn(username, password) };
}

export interface Fixture {
	admin: Awaited<ReturnType<typeof createUser>>;
	judges: Awaited<ReturnType<typeof createUser>>[];
	groupId: string;
	groupCode: string;
	eventId: string;
	eventCode: string;
	criteria: { id: string; max: number }[];
	participants: { id: string; code: string }[];
	submissions: Record<string, string>; // judgeId -> submissionId
}

export async function makeFixture(
	o: { judges?: number; participants?: number; criteria?: number[]; precision?: number } = {}
): Promise<Fixture> {
	const s = rid();
	const admin = await createUser('admin', 'a');
	const db = admin.client;
	const { data: g, error: gErr } = await db
		.from('groups')
		.insert({ code: `g${s}`, name: `Group ${s}` })
		.select()
		.single();
	if (gErr) throw gErr;
	const { data: eventId, error: eErr } = await db.rpc('admin_save_event', {
		p_id: null as unknown as string,
		p_group_id: g.id,
		p_code: `e${s}`,
		p_name: `Event ${s}`,
		p_description: '',
		p_instructions: '',
		p_score_precision: o.precision ?? 1,
		p_display_order: 0,
		p_is_active: true,
		p_reason: ''
	});
	if (eErr) throw eErr;
	const criteria: Fixture['criteria'] = [];
	for (const [i, max] of (o.criteria ?? [25, 25, 25, 25]).entries()) {
		const { data, error } = await db.rpc('admin_save_criterion', {
			p_event_id: eventId as string,
			p_id: null as unknown as string,
			p_name: `Criterion ${i + 1}`,
			p_description: '',
			p_max_marks: max,
			p_display_order: i,
			p_is_active: true,
			p_reason: ''
		});
		if (error) throw error;
		criteria.push({ id: data as string, max });
	}
	const participants: Fixture['participants'] = [];
	for (let i = 0; i < (o.participants ?? 2); i++) {
		const code = `T${s}-${i + 1}`.toUpperCase();
		const { data, error } = await db
			.from('participants')
			.insert({ code, name: `Participant ${i + 1} ${s}`, group_id: g.id })
			.select('id')
			.single();
		if (error) throw error;
		const { error: lErr } = await db.rpc('admin_set_event_participant', {
			p_event_id: eventId as string,
			p_participant_id: data.id,
			p_active: true,
			p_reason: ''
		});
		if (lErr) throw lErr;
		participants.push({ id: data.id, code });
	}
	const judges = [];
	const submissions: Record<string, string> = {};
	for (let i = 0; i < (o.judges ?? 2); i++) {
		const j = await createUser('judge', String(i + 1));
		const { error } = await db.rpc('admin_set_assignment', {
			p_event_id: eventId as string,
			p_judge_id: j.id,
			p_active: true,
			p_reason: ''
		});
		if (error) throw error;
		const { data: sub } = await service
			.from('submissions')
			.select('id')
			.eq('event_id', eventId as string)
			.eq('judge_id', j.id)
			.single();
		submissions[j.id] = sub!.id;
		judges.push(j);
	}
	return {
		admin,
		judges,
		groupId: g.id,
		groupCode: g.code,
		eventId: eventId as string,
		eventCode: `e${s}`,
		criteria,
		participants,
		submissions
	};
}

/** Save marks for every participant/criterion: values[pIndex][cIndex]. */
export async function saveAll(f: Fixture, judgeIndex: number, values: number[][]) {
	const j = f.judges[judgeIndex];
	const changes = f.participants.flatMap((p, pi) =>
		f.criteria.map((c, ci) => ({
			participant_id: p.id,
			criterion_id: c.id,
			value: values[pi][ci],
			base_version: 0
		}))
	);
	const { data, error } = await j.client.rpc('save_scores', {
		p_submission_id: f.submissions[j.id],
		p_changes: changes
	});
	if (error) throw error;
	return data as { version: number; results: { status: string }[] };
}

export async function submit(f: Fixture, judgeIndex: number) {
	const j = f.judges[judgeIndex];
	const { data: sub } = await j.client
		.from('submissions')
		.select('version')
		.eq('id', f.submissions[j.id])
		.single();
	return j.client.rpc('submit_submission', {
		p_submission_id: f.submissions[j.id],
		p_expected_version: sub!.version
	});
}

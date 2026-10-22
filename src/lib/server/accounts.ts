import { AUTH_EMAIL_DOMAIN } from '$app/env/private';
import { serviceSupabase } from './supabase.ts';
import { syntheticEmail } from '#lib/usernames.ts';

/**
 * Judge account management. Callers MUST have verified that the current user
 * is an active admin (requireAdmin) before calling any of these: they use the
 * service-role key. Passwords are passed straight to Supabase Auth (which
 * hashes them) and are never stored, logged or returned.
 */
export async function createJudgeAccount(opts: {
	username: string;
	password: string;
	displayName: string;
	actorId: string;
}): Promise<
	{ id: string } | { error: 'USERNAME_TAKEN' | 'AUTH_ERROR' | 'PROFILE_ERROR'; message?: string }
> {
	const svc = serviceSupabase();
	const { data: existing } = await svc
		.from('profiles')
		.select('id')
		.eq('username', opts.username)
		.maybeSingle();
	if (existing) return { error: 'USERNAME_TAKEN' };

	const { data, error } = await svc.auth.admin.createUser({
		email: syntheticEmail(opts.username, AUTH_EMAIL_DOMAIN),
		password: opts.password,
		email_confirm: true,
		user_metadata: { username: opts.username }
	});
	if (error || !data.user) {
		const taken = /already|registered|exists/i.test(error?.message ?? '');
		return { error: taken ? 'USERNAME_TAKEN' : 'AUTH_ERROR', message: error?.message };
	}
	const { error: pErr } = await svc.rpc('service_create_profile', {
		p_id: data.user.id,
		p_username: opts.username,
		p_display_name: opts.displayName,
		p_role: 'judge',
		p_actor: opts.actorId
	});
	if (pErr) {
		await svc.auth.admin.deleteUser(data.user.id);
		return { error: 'PROFILE_ERROR', message: pErr.message };
	}
	return { id: data.user.id };
}

async function assertJudge(id: string): Promise<{ username: string } | null> {
	const { data } = await serviceSupabase()
		.from('profiles')
		.select('username, role')
		.eq('id', id)
		.maybeSingle();
	return data?.role === 'judge' ? { username: data.username } : null;
}

export async function setJudgePassword(id: string, password: string, actorId: string) {
	const judge = await assertJudge(id);
	if (!judge) return { error: 'NOT_FOUND' as const };
	const svc = serviceSupabase();
	const { error } = await svc.auth.admin.updateUserById(id, { password });
	if (error) return { error: 'AUTH_ERROR' as const, message: error.message };
	await svc.rpc('service_log_audit', {
		p_action: 'judge.password_set',
		p_actor: actorId,
		p_judge_id: id,
		p_entity_type: 'profile',
		p_entity_id: id
	});
	return { username: judge.username };
}

export async function setJudgeActive(
	id: string,
	active: boolean,
	actorId: string,
	reason: string | null
) {
	const judge = await assertJudge(id);
	if (!judge) return { error: 'NOT_FOUND' as const };
	const svc = serviceSupabase();
	// Banning blocks sign-in and token refresh; the profile flag cuts access immediately via RLS.
	const { error } = await svc.auth.admin.updateUserById(id, {
		ban_duration: active ? 'none' : '876000h'
	});
	if (error) return { error: 'AUTH_ERROR' as const, message: error.message };
	const { error: pErr } = await svc.rpc('service_update_profile', {
		p_id: id,
		p_display_name: '',
		p_is_active: active,
		p_actor: actorId,
		p_reason: reason ?? ''
	});
	if (pErr) return { error: 'PROFILE_ERROR' as const, message: pErr.message };
	return { username: judge.username };
}

export async function renameJudge(id: string, displayName: string, actorId: string) {
	const judge = await assertJudge(id);
	if (!judge) return { error: 'NOT_FOUND' as const };
	const { error } = await serviceSupabase().rpc('service_update_profile', {
		p_id: id,
		p_display_name: displayName,
		p_is_active: null as unknown as boolean,
		p_actor: actorId,
		p_reason: ''
	});
	if (error) return { error: 'PROFILE_ERROR' as const, message: error.message };
	return { username: judge.username };
}

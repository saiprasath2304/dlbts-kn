import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline';
import { syntheticEmail } from '../src/lib/usernames.ts';

export function env(name: string, fallback?: string): string {
	const v = process.env[name]?.trim() || fallback;
	if (!v) {
		console.error(`Missing ${name}. Run with --env-file=.env (see README).`);
		process.exit(1);
	}
	return v;
}

export function serviceClient() {
	return createClient(env('PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

export function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Prompt without echoing (password). Falls back to visible input if not a TTY. */
export function promptHidden(question: string): Promise<string> {
	return new Promise((resolve) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		const out = rl as unknown as {
			_writeToOutput: (s: string) => void;
			output: NodeJS.WriteStream;
		};
		let muted = false;
		out._writeToOutput = (s: string) => {
			if (!muted) out.output.write(s);
		};
		rl.question(question, (answer) => {
			rl.close();
			process.stdout.write('\n');
			resolve(answer);
		});
		muted = true;
	});
}

export async function createAccount(
	supabase: ReturnType<typeof serviceClient>,
	opts: {
		username: string;
		password: string;
		displayName: string;
		role: 'admin' | 'judge';
		actor?: string | null;
	}
): Promise<string> {
	const email = syntheticEmail(opts.username, env('AUTH_EMAIL_DOMAIN', 'judges.invalid'));
	const { data, error } = await supabase.auth.admin.createUser({
		email,
		password: opts.password,
		email_confirm: true,
		user_metadata: { username: opts.username }
	});
	if (error || !data.user)
		throw new Error(`Could not create auth user ${opts.username}: ${error?.message}`);
	const { error: pErr } = await supabase.rpc('service_create_profile', {
		p_id: data.user.id,
		p_username: opts.username,
		p_display_name: opts.displayName,
		p_role: opts.role,
		p_actor: opts.actor ?? null
	});
	if (pErr) {
		await supabase.auth.admin.deleteUser(data.user.id);
		throw new Error(`Could not create profile for ${opts.username}: ${pErr.message}`);
	}
	return data.user.id;
}

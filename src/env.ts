import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * All configuration is validated when the server starts. Messages name the
 * variable and what is wrong, never the secret value itself.
 */
function required(name: string, check?: (v: string) => string | null) {
	return (value: string | undefined) => {
		if (!value || !value.trim()) {
			throw new Error(`${name} is not set. Copy .env.example to .env and fill it in (see README).`);
		}
		const problem = check?.(value.trim());
		if (problem) throw new Error(`${name} is invalid: ${problem}`);
		return value.trim();
	};
}

function optional(check?: (v: string) => string | null, name = 'value') {
	return (value: string | undefined) => {
		if (!value || !value.trim()) return undefined;
		const problem = check?.(value.trim());
		if (problem) throw new Error(`${name} is invalid: ${problem}`);
		return value.trim();
	};
}

const isUrl = (v: string) => {
	try {
		const u = new URL(v);
		return u.protocol === 'http:' || u.protocol === 'https:' ? null : 'must be an http(s) URL';
	} catch {
		return 'must be a URL such as https://xyz.supabase.co';
	}
};

const isEmail = (v: string) =>
	/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? null : 'must be an email address';

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: {
		public: true,
		description: 'Supabase project URL',
		schema: required('PUBLIC_SUPABASE_URL', isUrl)
	},
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
		public: true,
		description: 'Supabase publishable (sb_publishable_...) or legacy anon key. Safe for browsers.',
		schema: required('PUBLIC_SUPABASE_PUBLISHABLE_KEY', (v) =>
			v.startsWith('sb_secret_') ? 'this is a SECRET key; use the publishable/anon key' : null
		)
	},
	SUPABASE_SERVICE_ROLE_KEY: {
		description: 'Supabase secret (sb_secret_...) or legacy service_role key. Server only.',
		schema: required('SUPABASE_SERVICE_ROLE_KEY', (v) =>
			v.startsWith('sb_publishable_')
				? 'this is the publishable key; use the secret/service-role key'
				: null
		)
	},
	AUTH_EMAIL_DOMAIN: {
		description:
			'Reserved, non-deliverable domain used to build internal auth identifiers from usernames.',
		schema: (value: string | undefined) => {
			const v = (value ?? 'judges.invalid').trim().toLowerCase();
			if (!/^([a-z0-9-]+\.)*(invalid|test|example|localhost)$/.test(v)) {
				throw new Error(
					'AUTH_EMAIL_DOMAIN must end in a reserved, non-deliverable TLD (.invalid, .test, .example or .localhost), e.g. judges.invalid'
				);
			}
			return v;
		}
	},
	SESSION_MAX_AGE_HOURS: {
		description: 'How long a login cookie lasts (hours). Default 12.',
		schema: (value: string | undefined) => {
			const n = value ? Number(value) : 12;
			if (!Number.isFinite(n) || n < 1 || n > 168) {
				throw new Error('SESSION_MAX_AGE_HOURS must be a number between 1 and 168');
			}
			return n;
		}
	},
	REPORT_EMAIL_TO: {
		description: 'Optional recipient for emailed reports.',
		schema: optional(isEmail, 'REPORT_EMAIL_TO')
	},
	RESEND_API_KEY: {
		description: 'Optional Resend API key for emailed reports.',
		schema: optional(undefined, 'RESEND_API_KEY')
	},
	EMAIL_FROM: {
		description:
			'Optional sender, e.g. "Results <results@your-domain.org>" (must be verified in Resend).',
		schema: optional(
			(v) =>
				/<?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(v) ? null : 'must contain an email address',
			'EMAIL_FROM'
		)
	}
});

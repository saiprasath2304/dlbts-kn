/**
 * Username conventions. Judges log in with a username such as `judge01grp1sc`.
 * Internally, Supabase Auth needs an email-shaped identifier, so we derive one
 * on the server under a reserved, non-deliverable domain (e.g. judges.invalid).
 * No mail is ever sent to these addresses.
 */
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,49}$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;

export function normalizeUsername(input: string): string {
	return input.normalize('NFKC').trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
	return USERNAME_RE.test(username);
}

export function syntheticEmail(username: string, domain: string): string {
	const u = normalizeUsername(username);
	if (!isValidUsername(u)) throw new Error('INVALID_USERNAME');
	return `${u}@${domain}`;
}

export function validatePassword(password: string): 'TOO_SHORT' | 'TOO_LONG' | null {
	if (password.length < PASSWORD_MIN) return 'TOO_SHORT';
	if (new TextEncoder().encode(password).length > PASSWORD_MAX) return 'TOO_LONG';
	return null;
}

export interface PatternParts {
	nn: number;
	group: string;
	event: string;
}

/** Apply a pattern such as `judge{nn}{group}{event}` -> `judge01grp1sc`. */
export function applyPattern(pattern: string, parts: PatternParts): string {
	return pattern
		.replaceAll('{nn}', String(parts.nn).padStart(2, '0'))
		.replaceAll('{group}', parts.group.toLowerCase())
		.replaceAll('{event}', parts.event.toLowerCase())
		.trim();
}

/** Smallest judge number (1..99) whose generated username is not taken. */
export function nextJudgeNumber(
	taken: Iterable<string>,
	pattern: string,
	group: string,
	event: string
): number {
	const set = new Set(Array.from(taken, normalizeUsername));
	for (let nn = 1; nn < 100; nn++) {
		if (!set.has(applyPattern(pattern, { nn, group, event }))) return nn;
	}
	throw new Error('NO_FREE_NUMBER');
}

export function suggestCredentials(
	taken: Iterable<string>,
	usernamePattern: string,
	passwordPattern: string,
	group: string,
	event: string
): { username: string; password: string; nn: number } {
	const nn = nextJudgeNumber(taken, usernamePattern, group, event);
	return {
		nn,
		username: applyPattern(usernamePattern, { nn, group, event }),
		password: applyPattern(passwordPattern, { nn, group, event })
	};
}

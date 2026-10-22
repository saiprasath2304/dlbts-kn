import { describe, expect, it } from 'vitest';
import {
	applyPattern,
	isValidUsername,
	nextJudgeNumber,
	normalizeUsername,
	suggestCredentials,
	syntheticEmail,
	validatePassword
} from './usernames';

describe('username conventions', () => {
	it('builds usernames and passwords from patterns', () => {
		expect(applyPattern('judge{nn}{group}{event}', { nn: 1, group: 'grp1', event: 'sc' })).toBe(
			'judge01grp1sc'
		);
		expect(applyPattern('pwd{nn}{group}{event}', { nn: 2, group: 'GRP1', event: 'SC' })).toBe(
			'pwd02grp1sc'
		);
	});
	it('picks the next free judge number', () => {
		expect(
			nextJudgeNumber(['judge01grp1sc', 'judge02grp1sc'], 'judge{nn}{group}{event}', 'grp1', 'sc')
		).toBe(3);
		expect(nextJudgeNumber(['judge02grp1sc'], 'judge{nn}{group}{event}', 'grp1', 'sc')).toBe(1);
		expect(
			suggestCredentials([], 'judge{nn}{group}{event}', 'pwd{nn}{group}{event}', 'grp2', 'jame')
		).toEqual({
			nn: 1,
			username: 'judge01grp2jame',
			password: 'pwd01grp2jame'
		});
	});
	it('normalises and validates usernames', () => {
		expect(normalizeUsername('  Judge01GRP1sc ')).toBe('judge01grp1sc');
		expect(isValidUsername('judge01grp1sc')).toBe(true);
		expect(isValidUsername('ab')).toBe(false);
		expect(isValidUsername('judge 01')).toBe(false);
		expect(isValidUsername('judge@x')).toBe(false);
	});
	it('derives a reserved, non-deliverable internal identifier', () => {
		expect(syntheticEmail('Judge01grp1sc', 'judges.invalid')).toBe('judge01grp1sc@judges.invalid');
		expect(() => syntheticEmail('bad name', 'judges.invalid')).toThrow();
	});
	it('validates password length', () => {
		expect(validatePassword('pwd01grp1sc')).toBeNull();
		expect(validatePassword('abc')).toBe('TOO_SHORT');
		expect(validatePassword('x'.repeat(73))).toBe('TOO_LONG');
	});
});

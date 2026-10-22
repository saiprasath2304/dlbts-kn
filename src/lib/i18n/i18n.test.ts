import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ta } from './ta';
import { errorMessage, translate } from './index';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
	it('Tamil defines every English key', () => {
		const missing = Object.keys(en).filter((k) => !(k in ta));
		expect(missing).toEqual([]);
	});
	it('Tamil has no extra keys', () => {
		expect(Object.keys(ta).filter((k) => !(k in en))).toEqual([]);
	});
	it('every translation keeps the same placeholders', () => {
		const wrong = Object.keys(en).filter(
			(k) =>
				placeholders(en[k as keyof typeof en]).join() !==
				placeholders(ta[k as keyof typeof ta]).join()
		);
		expect(wrong).toEqual([]);
	});
	it('Tamil strings are actually Tamil where expected', () => {
		expect(ta['nav.logout']).toMatch(/[\u0B80-\u0BFF]/);
		expect(ta['save.saved']).toMatch(/[\u0B80-\u0BFF]/);
	});
	it('interpolates parameters and falls back safely', () => {
		expect(translate('en', 'judge.welcome', { name: 'Asha' })).toBe('Welcome, Asha');
		expect(translate('ta', 'judge.welcome', { name: 'Asha' })).toBe('வணக்கம், Asha');
		expect(translate('ta', 'no.such.key')).toBe('no.such.key');
		expect(errorMessage('en', 'SUBMISSION_LOCKED')).toBe('This submission is locked.');
		expect(errorMessage('en', 'SOMETHING_ELSE')).toBe(en['error.generic']);
	});
	it('does not translate user-entered data', () => {
		// Names are passed through parameters verbatim.
		expect(
			translate('ta', 'submit.summary', { event: 'Sloka Chanting', group: 'Group 1' })
		).toContain('Sloka Chanting');
	});
});

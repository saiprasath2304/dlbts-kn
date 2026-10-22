import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

type Flow = {
	eventId: string;
	eventName: string;
	groupCode: string;
	eventCode: string;
	participants: { id: string; code: string }[];
	criteria: { id: string; max: number }[];
	admin: { username: string; password: string };
	judges: { id: string; username: string; password: string; submissionId: string }[];
};

export function fixture(): { judgeFlow: Flow; adminFlow: Flow } {
	return JSON.parse(readFileSync('tests/e2e/.fixture.json', 'utf8'));
}

export async function login(page: Page, username: string, password: string, expectSuccess = true) {
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	// Wait for the login request to finish before the test navigates elsewhere.
	if (expectSuccess) await page.waitForURL((u) => !u.pathname.startsWith('/login'));
	else await page.getByRole('alert').waitFor();
}

/** Input for participant index p and criterion index c (by DOM id). */
export function markInput(page: Page, flow: Flow, p: number, c: number) {
	return page.locator(`[id="m-${flow.participants[p].id}|${flow.criteria[c].id}"]`);
}

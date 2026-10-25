import { expect, test } from '@playwright/test';
import { fixture, login } from './fixture';
import { makeFixture, saveAll, submit } from '../integration/helpers';

const { adminFlow: f } = fixture();

test.describe.serial('admin workflows', () => {
	test('dashboard shows live submission progress', async ({ page }) => {
		await login(page, f.admin.username, f.admin.password);
		await expect(page).toHaveURL(/\/admin$/);
		const card = page.getByTestId('event-progress').filter({ hasText: f.eventName });
		await expect(card).toContainText('Judges submitted: 1 of 1');
		await expect(card).toContainText('All judges submitted');
	});

	test('dashboard updates live (Realtime) when a judge submits', async ({ page }) => {
		const fx = await makeFixture({ judges: 1, participants: 1, criteria: [10], precision: 0 });
		await login(page, fx.admin.username, fx.admin.password);
		const card = page
			.getByTestId('event-progress')
			.filter({ hasText: `Event ${fx.eventCode.slice(1)}` });
		await expect(card).toContainText('Judges submitted: 0 of 1');
		await expect(page.getByText('Live updates on')).toBeVisible();
		await saveAll(fx, 0, [[8]]);
		const r = await submit(fx, 0);
		expect(r.error).toBeNull();
		// Polling is every 30 s; seeing the change well before that proves the push.
		await expect(card).toContainText('Judges submitted: 1 of 1', { timeout: 12_000 });
	});

	test('results show the aggregate and can be finalized', async ({ page }) => {
		await login(page, f.admin.username, f.admin.password);
		await page.goto(`/admin/results/${f.eventId}`);
		await expect(page.getByTestId('result-status')).toHaveText('Ready for finalization');
		await expect(page.getByTestId('results-table')).toContainText('90');
		await page.getByRole('button', { name: 'Finalize results' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
		await expect(page.getByTestId('result-status')).toHaveText('Finalized');
	});

	test('final PDF downloads without email configuration', async ({ page }) => {
		await login(page, f.admin.username, f.admin.password);
		await page.goto('/admin/reports');
		await expect(
			page.getByText('Email is not configured. You can still download the PDF.')
		).toBeVisible();
		const res = await page.request.get('/admin/reports/pdf?kind=final&locale=ta&breakdown=1');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toBe('application/pdf');
		const body = await res.body();
		expect(body.subarray(0, 5).toString()).toBe('%PDF-');
		expect(body.toString('latin1')).toMatch(/NotoSansTamil/);
	});

	test('switches the interface to Tamil and back', async ({ page }) => {
		await login(page, f.admin.username, f.admin.password);
		await page.getByRole('button', { name: /தமிழ்/ }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('கட்டுப்பாட்டுப் பலகை');
		await expect(page.locator('html')).toHaveAttribute('lang', 'ta');
		await page.getByRole('button', { name: /English/ }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
	});

	test('creates a judge account who can then sign in', async ({ page }) => {
		const username = `judge99${f.groupCode}${f.eventCode}`.slice(0, 40);
		await login(page, f.admin.username, f.admin.password);
		await page.goto('/admin/judges');
		await page.getByRole('button', { name: 'New judge account' }).click();
		const create = page.locator('form[action="?/create"]');
		await create.getByLabel('Judge name', { exact: true }).fill('New E2E Judge');
		await create.getByLabel('Username', { exact: true }).fill(username);
		await create.getByLabel('Password', { exact: true }).fill('pwd99e2e');
		await create.getByRole('button', { name: 'Create' }).click();
		await expect(page.getByRole('status')).toContainText(`Judge account ${username} created.`);

		await page.getByRole('button', { name: 'Log out' }).click();
		await login(page, username, 'pwd99e2e');
		await expect(page).toHaveURL(/\/judge$/);
		await expect(page.getByText('You have no events assigned yet')).toBeVisible();
	});

	test('wrong passwords get one generic message', async ({ page }) => {
		await login(page, f.admin.username, 'definitely-wrong', false);
		await expect(page.getByRole('alert')).toHaveText(
			'Username or password is not correct. Please check and try again.'
		);
		await login(page, 'no-such-user', 'whatever1', false);
		await expect(page.getByRole('alert')).toHaveText(
			'Username or password is not correct. Please check and try again.'
		);
	});
});

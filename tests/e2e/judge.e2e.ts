import { expect, test } from '@playwright/test';
import { fixture, login, markInput } from './fixture';
import { service } from '../integration/helpers';

const { judgeFlow: f } = fixture();
const judge = f.judges[0];

async function serverValue(p: number, c: number) {
	const { data } = await service
		.from('criterion_scores')
		.select('value')
		.eq('submission_id', judge.submissionId)
		.eq('participant_id', f.participants[p].id)
		.eq('criterion_id', f.criteria[c].id)
		.maybeSingle();
	return data?.value === undefined || data?.value === null ? null : Number(data.value);
}

test.describe.serial('judge scoring workflow', () => {
	test('login goes straight to the only assigned event; marks autosave with live totals', async ({
		page
	}) => {
		await login(page, judge.username, judge.password);
		await expect(page).toHaveURL(new RegExp(`/judge/events/${f.eventId}$`));
		await expect(page.getByRole('heading', { level: 1 })).toContainText(f.eventName);

		const values = [22, 24, 21, 23];
		for (const [c, v] of values.entries()) await markInput(page, f, 0, c).fill(String(v));
		const card = page.getByTestId('participant-card').first();
		await expect(card.getByTestId('participant-total')).toContainText('90');
		await expect(card.getByTestId('participant-total')).toContainText('/ 100');
		await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
		await expect.poll(() => serverValue(0, 3)).toBe(23);

		// Invalid input is explained and not saved.
		await markInput(page, f, 1, 0).fill('30');
		await expect(
			page.getByRole('alert').filter({ hasText: 'The highest mark is 25' })
		).toBeVisible();
		await markInput(page, f, 1, 0).fill('');

		await page.reload();
		await expect(markInput(page, f, 0, 0)).toHaveValue('22');
		await expect(markInput(page, f, 0, 3)).toHaveValue('23');
	});

	test('keeps marks during a network interruption and syncs afterwards', async ({
		page,
		context
	}) => {
		await login(page, judge.username, judge.password);
		await context.setOffline(true);
		await markInput(page, f, 1, 0).fill('20.5');
		await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'offline');
		expect(await serverValue(1, 0)).toBeNull();
		await context.setOffline(false);
		await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
		await expect.poll(() => serverValue(1, 0)).toBe(20.5);
	});

	test('recovers unsaved drafts after a refresh', async ({ page }) => {
		await login(page, judge.username, judge.password);
		await page.route('**/api/judge/scores', (route) => route.abort('failed'));
		await markInput(page, f, 1, 1).fill('19');
		await expect(page.getByTestId('save-status')).not.toHaveAttribute('data-state', 'saved');
		await page.reload();
		await expect(markInput(page, f, 1, 1)).toHaveValue('19');
		await expect(page.getByText(/from an earlier session on this device/)).toBeVisible();
		expect(await serverValue(1, 1)).toBeNull();
		await page.unroute('**/api/judge/scores');
		await expect.poll(() => serverValue(1, 1), { timeout: 40_000 }).toBe(19);
	});

	test('review, final submit, then everything is locked', async ({ page }) => {
		await login(page, judge.username, judge.password);
		await markInput(page, f, 1, 2).fill('18');
		await markInput(page, f, 1, 3).fill('17.5');
		await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
		await expect.poll(() => serverValue(1, 3)).toBe(17.5);

		await page.getByTestId('review-link').click();
		await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible();
		const submitBtn = page.getByTestId('final-submit');
		await expect(submitBtn).toBeDisabled();
		await page.getByLabel('I have checked all marks and want to submit them.').check();
		await expect(submitBtn).toBeEnabled();
		await submitBtn.click();
		await expect(page.getByTestId('submit-success')).toBeVisible();

		await page.goto(`/judge/events/${f.eventId}`);
		await expect(page.getByTestId('locked-notice')).toBeVisible();
		await expect(markInput(page, f, 0, 0)).toHaveAttribute('readonly', '');

		// The server refuses edits regardless of the UI.
		const res = await page.request.post('/api/judge/scores', {
			data: {
				submission_id: judge.submissionId,
				changes: [
					{
						participant_id: f.participants[0].id,
						criterion_id: f.criteria[0].id,
						value: 1,
						base_version: 99
					}
				]
			}
		});
		expect(res.status()).toBe(409);
		expect(await serverValue(0, 0)).toBe(22);

		// Reopening needs the organisers.
		await page.getByLabel('Reason').fill('I mixed up two participants');
		await page.getByRole('button', { name: 'Send request' }).click();
		await expect(page.getByText('Waiting for the organisers')).toBeVisible();
	});

	test('cannot reach admin pages or other events', async ({ page }) => {
		await login(page, judge.username, judge.password);
		await page.goto('/admin');
		await expect(page).toHaveURL(/\/judge$/);
		const other = fixture().adminFlow.eventId;
		const res = await page.goto(`/judge/events/${other}`);
		expect(res?.status()).toBe(404);
		const api = await page.request.post('/api/judge/scores', {
			data: {
				submission_id: fixture().adminFlow.judges[0].submissionId,
				changes: [
					{
						participant_id: fixture().adminFlow.participants[0].id,
						criterion_id: fixture().adminFlow.criteria[0].id,
						value: 1,
						base_version: 1
					}
				]
			}
		});
		expect(api.status()).toBe(404);
	});
});

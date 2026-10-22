import { expect, test } from '@playwright/test';
import { fixture, login } from './fixture';

test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

const { adminFlow: f } = fixture();

test('scoring page fits a small phone and uses large controls', async ({ page }) => {
	await login(page, f.judges[0].username, f.judges[0].password);
	await page.goto(`/judge/events/${f.eventId}`);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
	const input = page.locator('input[data-score]').first();
	const size = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
	expect(size).toBeGreaterThanOrEqual(18);
	const box = await input.boundingBox();
	expect(box!.height).toBeGreaterThanOrEqual(48);
});

test('login page fits a small phone', async ({ page }) => {
	await page.goto('/login');
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
	const btn = await page.getByRole('button', { name: 'Sign in' }).boundingBox();
	expect(btn!.height).toBeGreaterThanOrEqual(48);
});

test('admin dashboard is usable on a phone', async ({ page }) => {
	await login(page, f.admin.username, f.admin.password);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
	await page.getByText('Menu').click();
	await expect(page.getByRole('link', { name: 'Participants' }).first()).toBeVisible();
});

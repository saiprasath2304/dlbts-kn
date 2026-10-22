import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('RateLimiter', () => {
	it('blocks after the limit within the window and recovers after it', () => {
		const rl = new RateLimiter(3, 1000);
		expect([
			rl.attempt('k', 0),
			rl.attempt('k', 10),
			rl.attempt('k', 20),
			rl.attempt('k', 30)
		]).toEqual([true, true, true, false]);
		expect(rl.attempt('k', 1500)).toBe(true);
		expect(rl.attempt('other', 30)).toBe(true);
	});
});

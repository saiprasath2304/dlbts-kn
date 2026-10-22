/**
 * Small in-memory sliding-window limiter for login attempts (per IP and per
 * username). Supabase Auth also rate-limits server-side; this adds a friendly,
 * early refusal. For multi-instance deployments rely on Supabase's limits or
 * put a shared store behind this interface.
 */
export class RateLimiter {
	private hits = new Map<string, number[]>();
	constructor(
		private readonly limit: number,
		private readonly windowMs: number
	) {}

	/** Returns true if the action is allowed (and records it). */
	attempt(key: string, now = Date.now()): boolean {
		const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
		if (recent.length >= this.limit) {
			this.hits.set(key, recent);
			return false;
		}
		recent.push(now);
		this.hits.set(key, recent);
		if (this.hits.size > 10_000) this.prune(now);
		return true;
	}

	reset(key: string) {
		this.hits.delete(key);
	}

	private prune(now: number) {
		for (const [k, v] of this.hits) {
			if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
		}
	}
}

/**
 * Per username: strict, against password guessing. Per IP: generous, because at a
 * venue many judges share one public IP address.
 */
export const userLoginLimiter = new RateLimiter(8, 5 * 60_000);
export const ipLoginLimiter = new RateLimiter(120, 5 * 60_000);

/**
 * Autosave controller for one judge submission.
 *
 * Every edit is written to the local draft store first, then sent to the
 * server in debounced batches. A draft is removed only after the server
 * confirms the same value. Each edit carries the version of the mark it was
 * based on; if the server holds a newer, different mark the server reports a
 * conflict and the judge chooses which value to keep - nothing is silently
 * overwritten or discarded.
 */
import { draftKey, openDraftStore, type Draft, type DraftStore } from './drafts.ts';

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'locked' | 'session';

export interface ServerScore {
	participant_id: string;
	criterion_id: string;
	value: number | null;
	version: number;
}

export interface Conflict {
	key: string;
	participant_id: string;
	criterion_id: string;
	mine: number | null;
	theirs: number | null;
	theirs_version: number;
	theirs_at: string | null;
}

interface SaveResult {
	participant_id: string;
	criterion_id: string;
	status: 'saved' | 'conflict' | 'invalid';
	value?: number | null;
	version?: number;
	code?: string;
	server_value?: number | null;
	server_version?: number;
	server_updated_at?: string;
}

export interface SyncOptions {
	userId: string;
	submissionId: string;
	delayMs: number;
	endpoint?: string;
	fetch?: typeof fetch;
	store?: DraftStore;
	isOnline?: () => boolean;
}

const same = (a: number | null, b: number | null) =>
	a === null || b === null ? a === b : Math.abs(a - b) < 1e-9;

export class ScoreSync {
	state = $state<SaveState>('idle');
	lastSavedAt = $state<string | null>(null);
	pending = $state(0);
	conflicts = $state<Conflict[]>([]);
	invalid = $state<{ participant_id: string; criterion_id: string; code: string }[]>([]);
	recovered = $state(0);
	submissionStatus = $state<string | null>(null);
	persistent = $state(true);

	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- internal bookkeeping, never rendered
	private server = new Map<string, { value: number | null; version: number }>();
	private store: DraftStore | null = null;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private inFlight = false;
	private again = false;
	private retryMs = 0;
	private scope: string;
	private opts: Required<Omit<SyncOptions, 'store'>> & { store?: DraftStore };
	private listeners: (() => void)[] = [];

	constructor(opts: SyncOptions, initial: ServerScore[], lastSavedAt: string | null) {
		this.opts = {
			endpoint: '/api/judge/scores',
			fetch: (...a) => fetch(...a),
			isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
			...opts
		};
		this.scope = `${opts.userId}|${opts.submissionId}`;
		for (const s of initial)
			this.server.set(this.k(s.participant_id, s.criterion_id), {
				value: s.value,
				version: s.version
			});
		this.lastSavedAt = lastSavedAt;
	}

	private k(p: string, c: string) {
		return draftKey(this.scope, p, c);
	}

	serverValue(p: string, c: string): number | null {
		return this.server.get(this.k(p, c))?.value ?? null;
	}

	/** Load drafts left from an earlier session. Returns values to show in the form. */
	async init(): Promise<Map<string, number | null>> {
		this.store = this.opts.store ?? (await openDraftStore());
		this.persistent = this.store.persistent;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- internal bookkeeping, never rendered
		const overlay = new Map<string, number | null>();
		for (const d of await this.store.list(this.scope)) {
			const srv = this.server.get(d.key);
			if (srv && same(srv.value, d.value)) {
				await this.store.delete(d.key); // already saved
				continue;
			}
			if (!srv && d.value === null) {
				await this.store.delete(d.key);
				continue;
			}
			overlay.set(`${d.participant_id}|${d.criterion_id}`, d.value);
		}
		this.recovered = overlay.size;
		await this.refreshPending();

		if (typeof window !== 'undefined') {
			const online = () => this.flush();
			const offline = () => {
				if (this.pending > 0) this.state = 'offline';
			};
			const hidden = () => {
				if (document.visibilityState === 'hidden') void this.flush();
			};
			window.addEventListener('online', online);
			window.addEventListener('offline', offline);
			document.addEventListener('visibilitychange', hidden);
			this.listeners.push(
				() => window.removeEventListener('online', online),
				() => window.removeEventListener('offline', offline),
				() => document.removeEventListener('visibilitychange', hidden)
			);
		}
		if (overlay.size > 0) void this.flush();
		return overlay;
	}

	destroy() {
		clearTimeout(this.timer);
		for (const off of this.listeners) off();
		this.listeners = [];
	}

	/** Record an edit locally and schedule a save. */
	async setMark(participantId: string, criterionId: string, value: number | null) {
		const store = this.store ?? (this.store = await openDraftStore());
		const key = this.k(participantId, criterionId);
		const existing = await store.get(key);
		const srv = this.server.get(key);
		if (!existing && srv && same(srv.value, value)) return; // nothing changed
		await store.put({
			key,
			scope: this.scope,
			participant_id: participantId,
			criterion_id: criterionId,
			value,
			base_version: existing?.base_version ?? srv?.version ?? 0,
			updated_at: Date.now()
		});
		this.invalid = this.invalid.filter(
			(i) => !(i.participant_id === participantId && i.criterion_id === criterionId)
		);
		await this.refreshPending();
		this.schedule(this.opts.delayMs);
	}

	private schedule(ms: number) {
		clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.flush(), ms);
	}

	private async refreshPending() {
		if (!this.store) return;
		this.pending = (await this.store.list(this.scope)).length;
	}

	/** Send all pending drafts now. Safe to call repeatedly. */
	async flush(): Promise<void> {
		clearTimeout(this.timer);
		if (!this.store) return;
		if (this.inFlight) {
			this.again = true;
			return;
		}
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- internal bookkeeping, never rendered
		const conflictKeys = new Set(this.conflicts.map((c) => c.key));
		const drafts = (await this.store.list(this.scope)).filter((d) => !conflictKeys.has(d.key));
		await this.refreshPending();
		if (drafts.length === 0) {
			if (this.state === 'saving' || this.state === 'offline' || this.state === 'error')
				this.state = 'saved';
			return;
		}
		if (!this.opts.isOnline()) {
			this.state = 'offline';
			return;
		}

		this.inFlight = true;
		this.state = 'saving';
		try {
			const res = await this.opts.fetch(this.opts.endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					submission_id: this.opts.submissionId,
					changes: drafts.map((d) => ({
						participant_id: d.participant_id,
						criterion_id: d.criterion_id,
						value: d.value,
						base_version: d.base_version
					}))
				})
			});
			if (res.status === 401) {
				this.state = 'session';
				return;
			}
			if (res.status === 409) {
				this.state = 'locked';
				return;
			}
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = (await res.json()) as {
				results: SaveResult[];
				last_saved_at: string | null;
				status: string;
			};
			await this.apply(drafts, body.results);
			this.lastSavedAt = body.last_saved_at ?? this.lastSavedAt;
			this.submissionStatus = body.status;
			this.retryMs = 0;
			this.state = 'saved';
		} catch {
			this.state = this.opts.isOnline() ? 'error' : 'offline';
			this.retryMs = Math.min(30_000, Math.max(2_000, this.retryMs * 2));
			this.schedule(this.retryMs);
		} finally {
			this.inFlight = false;
			await this.refreshPending();
			if (this.again) {
				this.again = false;
				this.schedule(0);
			}
		}
	}

	private async apply(sent: Draft[], results: SaveResult[]) {
		const store = this.store!;
		for (const r of results) {
			const key = this.k(r.participant_id, r.criterion_id);
			const draft = sent.find((d) => d.key === key);
			if (!draft) continue;
			if (r.status === 'saved') {
				this.server.set(key, { value: r.value ?? null, version: r.version ?? 0 });
				const current = await store.get(key);
				if (current && same(current.value, draft.value)) await store.delete(key);
				else if (current)
					await store.put({ ...current, base_version: r.version ?? current.base_version });
			} else if (r.status === 'conflict') {
				if (!this.conflicts.some((c) => c.key === key)) {
					this.conflicts = [
						...this.conflicts,
						{
							key,
							participant_id: r.participant_id,
							criterion_id: r.criterion_id,
							mine: draft.value,
							theirs: r.server_value ?? null,
							theirs_version: r.server_version ?? 0,
							theirs_at: r.server_updated_at ?? null
						}
					];
				}
			} else {
				// Cannot ever be saved (e.g. criterion removed). Keep the judge informed.
				await store.delete(key);
				this.invalid = [
					...this.invalid,
					{
						participant_id: r.participant_id,
						criterion_id: r.criterion_id,
						code: r.code ?? 'INVALID'
					}
				];
			}
		}
	}

	/** Judge decides which value wins a conflict. Returns the value now shown. */
	async resolve(conflict: Conflict, keep: 'mine' | 'server'): Promise<number | null> {
		const store = this.store!;
		this.conflicts = this.conflicts.filter((c) => c.key !== conflict.key);
		if (keep === 'server') {
			this.server.set(conflict.key, { value: conflict.theirs, version: conflict.theirs_version });
			await store.delete(conflict.key);
			await this.refreshPending();
			return conflict.theirs;
		}
		const current = await store.get(conflict.key);
		if (current) await store.put({ ...current, base_version: conflict.theirs_version });
		this.schedule(0);
		return current?.value ?? conflict.mine;
	}

	/** After a confirmed final submission, drafts for this submission are obsolete. */
	async clearAll() {
		const store = this.store ?? (await openDraftStore());
		await store.clearScope(this.scope);
		this.pending = 0;
	}
}

/** Pending draft count for a submission, used by the review page. */
export async function pendingDraftCount(userId: string, submissionId: string): Promise<number> {
	const store = await openDraftStore();
	return (await store.list(`${userId}|${submissionId}`)).length;
}

export async function clearDrafts(userId: string, submissionId: string): Promise<void> {
	const store = await openDraftStore();
	await store.clearScope(`${userId}|${submissionId}`);
}

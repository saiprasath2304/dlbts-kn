import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScoreSync, type ServerScore } from './score-sync.svelte';
import { MemoryStore } from './drafts';

const SUB = '00000000-0000-0000-0000-0000000000aa';
const P = '00000000-0000-0000-0000-0000000000p1'.replace('p1', '01');
const C1 = '00000000-0000-0000-0000-0000000000c1'.replace('c1', '11');
const C2 = '00000000-0000-0000-0000-0000000000c2'.replace('c2', '12');

type Change = {
	participant_id: string;
	criterion_id: string;
	value: number | null;
	base_version: number;
};

/** Minimal fake of the save_scores endpoint with per-mark versions. */
function fakeServer(initial: ServerScore[] = []) {
	const marks = new Map(
		initial.map((s) => [
			`${s.participant_id}|${s.criterion_id}`,
			{ value: s.value, version: s.version }
		])
	);
	let online = true;
	let locked = false;
	const calls: Change[][] = [];
	const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
		if (!online) throw new TypeError('Failed to fetch');
		if (locked) return new Response(JSON.stringify({ code: 'SUBMISSION_LOCKED' }), { status: 409 });
		const body = JSON.parse(String(init.body)) as { changes: Change[] };
		calls.push(body.changes);
		const results = body.changes.map((c) => {
			const k = `${c.participant_id}|${c.criterion_id}`;
			const cur = marks.get(k);
			if (cur && cur.value !== c.value && cur.version !== c.base_version) {
				return {
					participant_id: c.participant_id,
					criterion_id: c.criterion_id,
					status: 'conflict',
					server_value: cur.value,
					server_version: cur.version,
					server_updated_at: '2026-10-22T10:00:00Z'
				};
			}
			const version = cur ? (cur.value === c.value ? cur.version : cur.version + 1) : 1;
			marks.set(k, { value: c.value, version });
			return {
				participant_id: c.participant_id,
				criterion_id: c.criterion_id,
				status: 'saved',
				value: c.value,
				version
			};
		});
		return new Response(
			JSON.stringify({
				results,
				status: 'in_progress',
				last_saved_at: '2026-10-22T10:01:00Z',
				version: 1
			}),
			{ status: 200 }
		);
	});
	return {
		fetchImpl: fetchImpl as unknown as typeof fetch,
		marks,
		calls,
		setOnline: (v: boolean) => (online = v),
		lock: () => (locked = true),
		isOnline: () => online,
		/** Simulate another device changing a mark. */
		externalWrite: (p: string, c: string, value: number) => {
			const k = `${p}|${c}`;
			const cur = marks.get(k);
			marks.set(k, { value, version: (cur?.version ?? 0) + 1 });
		}
	};
}

function makeSync(
	server: ReturnType<typeof fakeServer>,
	store: MemoryStore,
	initial: ServerScore[] = []
) {
	return new ScoreSync(
		{
			userId: 'judge-1',
			submissionId: SUB,
			delayMs: 500,
			fetch: server.fetchImpl,
			store,
			isOnline: server.isOnline
		},
		initial,
		null
	);
}

describe('ScoreSync (autosave + offline drafts)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('debounces edits into one save and clears confirmed drafts', async () => {
		const server = fakeServer();
		const store = new MemoryStore();
		const sync = makeSync(server, store);
		await sync.init();
		await sync.setMark(P, C1, 20);
		await sync.setMark(P, C1, 22);
		await sync.setMark(P, C2, 24);
		expect(sync.pending).toBe(2);
		expect(server.calls).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(600);
		expect(server.calls).toHaveLength(1);
		expect(server.calls[0].map((c) => c.value).sort()).toEqual([22, 24]);
		expect(sync.state).toBe('saved');
		expect(sync.pending).toBe(0);
		expect(sync.lastSavedAt).toBe('2026-10-22T10:01:00Z');
		expect(server.marks.get(`${P}|${C1}`)?.value).toBe(22);
	});

	it('keeps marks locally while offline and syncs when back online', async () => {
		const server = fakeServer();
		const store = new MemoryStore();
		const sync = makeSync(server, store);
		await sync.init();
		server.setOnline(false);
		await sync.setMark(P, C1, 21.5);
		await vi.advanceTimersByTimeAsync(600);
		expect(sync.state).toBe('offline');
		expect(sync.pending).toBe(1);
		expect(server.marks.size).toBe(0);
		server.setOnline(true);
		await sync.flush();
		expect(sync.state).toBe('saved');
		expect(sync.pending).toBe(0);
		expect(server.marks.get(`${P}|${C1}`)?.value).toBe(21.5);
	});

	it('retries failed saves with backoff', async () => {
		const server = fakeServer();
		const store = new MemoryStore();
		const sync = new ScoreSync(
			{
				userId: 'judge-1',
				submissionId: SUB,
				delayMs: 100,
				fetch: vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch,
				store,
				isOnline: () => true
			},
			[],
			null
		);
		await sync.init();
		await sync.setMark(P, C1, 5);
		await vi.advanceTimersByTimeAsync(150);
		expect(sync.state).toBe('error');
		expect(sync.pending).toBe(1);
		void server;
	});

	it('recovers drafts after a page refresh and saves them', async () => {
		const server = fakeServer();
		const store = new MemoryStore();
		const first = makeSync(server, store);
		await first.init();
		server.setOnline(false);
		await first.setMark(P, C1, 19);
		await vi.advanceTimersByTimeAsync(600);
		first.destroy(); // tab closed / refreshed

		server.setOnline(true);
		const second = makeSync(server, store);
		const overlay = await second.init();
		expect(overlay.get(`${P}|${C1}`)).toBe(19);
		expect(second.recovered).toBe(1);
		await vi.advanceTimersByTimeAsync(10);
		expect(server.marks.get(`${P}|${C1}`)?.value).toBe(19);
		expect(second.pending).toBe(0);
	});

	it('never silently overwrites newer server data: conflicts need a decision', async () => {
		const initial = [{ participant_id: P, criterion_id: C1, value: 10, version: 1 }];
		const server = fakeServer(initial);
		const store = new MemoryStore();
		const sync = makeSync(server, store, initial);
		await sync.init();
		server.externalWrite(P, C1, 15); // e.g. another device, version 2
		await sync.setMark(P, C1, 12); // based on version 1
		await vi.advanceTimersByTimeAsync(600);
		expect(server.marks.get(`${P}|${C1}`)?.value).toBe(15);
		expect(sync.conflicts).toHaveLength(1);
		expect(sync.conflicts[0]).toMatchObject({ mine: 12, theirs: 15, theirs_version: 2 });
		expect(sync.pending).toBe(1); // draft is kept, not discarded

		const shown = await sync.resolve(sync.conflicts[0], 'mine');
		expect(shown).toBe(12);
		await vi.advanceTimersByTimeAsync(10);
		expect(server.marks.get(`${P}|${C1}`)?.value).toBe(12);
		expect(sync.conflicts).toHaveLength(0);
		expect(sync.pending).toBe(0);
	});

	it('can keep the server value instead', async () => {
		const initial = [{ participant_id: P, criterion_id: C1, value: 10, version: 1 }];
		const server = fakeServer(initial);
		const sync = makeSync(server, new MemoryStore(), initial);
		await sync.init();
		server.externalWrite(P, C1, 15);
		await sync.setMark(P, C1, 12);
		await vi.advanceTimersByTimeAsync(600);
		expect(await sync.resolve(sync.conflicts[0], 'server')).toBe(15);
		expect(sync.pending).toBe(0);
		expect(server.marks.get(`${P}|${C1}`)?.value).toBe(15);
	});

	it('reports a locked submission and keeps the unsaved draft', async () => {
		const server = fakeServer();
		const sync = makeSync(server, new MemoryStore());
		await sync.init();
		server.lock();
		await sync.setMark(P, C1, 7);
		await vi.advanceTimersByTimeAsync(600);
		expect(sync.state).toBe('locked');
		expect(sync.pending).toBe(1);
	});

	it('clears drafts after final submission', async () => {
		const server = fakeServer();
		const store = new MemoryStore();
		const sync = makeSync(server, store);
		await sync.init();
		server.setOnline(false);
		await sync.setMark(P, C1, 3);
		await sync.clearAll();
		expect(await store.list(`judge-1|${SUB}`)).toEqual([]);
	});
});

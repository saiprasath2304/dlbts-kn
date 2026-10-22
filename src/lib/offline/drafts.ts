/**
 * Browser-local storage for marks that have not yet been confirmed by the
 * server. Only marks are stored (never credentials or tokens). Drafts are
 * provisional: nothing here counts as saved or submitted.
 */
import { openDB, type IDBPDatabase } from 'idb';

export interface Draft {
	/** `${scope}|${participantId}|${criterionId}` */
	key: string;
	/** `${userId}|${submissionId}` */
	scope: string;
	participant_id: string;
	criterion_id: string;
	value: number | null;
	/** Server version of the mark this edit was based on (0 = none). */
	base_version: number;
	updated_at: number;
}

export interface DraftStore {
	list(scope: string): Promise<Draft[]>;
	get(key: string): Promise<Draft | undefined>;
	put(draft: Draft): Promise<void>;
	delete(key: string): Promise<void>;
	clearScope(scope: string): Promise<void>;
	readonly persistent: boolean;
}

const DB_NAME = 'judging-drafts';
const STORE = 'drafts';

export function draftKey(scope: string, participantId: string, criterionId: string) {
	return `${scope}|${participantId}|${criterionId}`;
}

class IdbStore implements DraftStore {
	readonly persistent = true;
	constructor(private db: IDBPDatabase) {}
	list(scope: string) {
		return this.db.getAllFromIndex(STORE, 'scope', scope) as Promise<Draft[]>;
	}
	get(key: string) {
		return this.db.get(STORE, key) as Promise<Draft | undefined>;
	}
	async put(draft: Draft) {
		await this.db.put(STORE, draft);
	}
	async delete(key: string) {
		await this.db.delete(STORE, key);
	}
	async clearScope(scope: string) {
		const tx = this.db.transaction(STORE, 'readwrite');
		for (const key of await tx.store.index('scope').getAllKeys(scope)) await tx.store.delete(key);
		await tx.done;
	}
}

/** Fallback when IndexedDB is unavailable (some private modes): survives network loss, not reloads. */
export class MemoryStore implements DraftStore {
	readonly persistent = false;
	private map = new Map<string, Draft>();
	async list(scope: string) {
		return [...this.map.values()].filter((d) => d.scope === scope);
	}
	async get(key: string) {
		return this.map.get(key);
	}
	async put(draft: Draft) {
		this.map.set(draft.key, { ...draft });
	}
	async delete(key: string) {
		this.map.delete(key);
	}
	async clearScope(scope: string) {
		for (const [k, d] of this.map) if (d.scope === scope) this.map.delete(k);
	}
}

let storePromise: Promise<DraftStore> | null = null;

export function openDraftStore(): Promise<DraftStore> {
	storePromise ??= (async () => {
		try {
			if (typeof indexedDB === 'undefined') return new MemoryStore();
			const db = await openDB(DB_NAME, 1, {
				upgrade(db) {
					const s = db.createObjectStore(STORE, { keyPath: 'key' });
					s.createIndex('scope', 'scope');
				}
			});
			return new IdbStore(db);
		} catch {
			return new MemoryStore();
		}
	})();
	return storePromise;
}

import Dexie from 'dexie';
import type { DataSnapshot } from '../types';

export type TableName = keyof DataSnapshot;
export type RowOf<T extends TableName> = DataSnapshot[T][number];
export type StorageKind = 'indexeddb' | 'localstorage' | 'memory';

/** Storage-engine–agnostic persistence contract used by the data store. */
export interface Persistence {
  readonly kind: StorageKind;
  load(): Promise<DataSnapshot>;
  put<T extends TableName>(table: T, rows: RowOf<T>[]): Promise<void>;
  remove(table: TableName, ids: string[]): Promise<void>;
  replace(snapshot: DataSnapshot): Promise<void>;
}

export const TABLES: TableName[] = ['exercises', 'routines', 'workouts', 'measurements'];

export const emptySnapshot = (): DataSnapshot => ({
  exercises: [],
  routines: [],
  workouts: [],
  measurements: [],
});

// ---------------------------------------------------------------------------
// IndexedDB (primary) via Dexie
// ---------------------------------------------------------------------------

class DexiePersistence implements Persistence {
  readonly kind: StorageKind = 'indexeddb';
  private readonly db: Dexie;

  constructor(db: Dexie) {
    this.db = db;
  }

  static async open(name = 'forge'): Promise<DexiePersistence> {
    const db = new Dexie(name);
    db.version(1).stores({
      exercises: 'id',
      routines: 'id, order',
      workouts: 'id, startedAt',
      measurements: 'id, date',
    });
    await db.open();
    return new DexiePersistence(db);
  }

  async load(): Promise<DataSnapshot> {
    const [exercises, routines, workouts, measurements] = await Promise.all(
      TABLES.map((t) => this.db.table(t).toArray()),
    );
    return { exercises, routines, workouts, measurements } as DataSnapshot;
  }

  async put<T extends TableName>(table: T, rows: RowOf<T>[]) {
    if (rows.length) await this.db.table(table).bulkPut(rows);
  }

  async remove(table: TableName, ids: string[]) {
    if (ids.length) await this.db.table(table).bulkDelete(ids);
  }

  async replace(snapshot: DataSnapshot) {
    const tables = TABLES.map((t) => this.db.table(t));
    await this.db.transaction('rw', tables, async () => {
      for (const t of TABLES) {
        await this.db.table(t).clear();
        await this.db.table(t).bulkPut(snapshot[t]);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Key/value fallback (localStorage, then memory)
// ---------------------------------------------------------------------------

interface KVBackend {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

class KVPersistence implements Persistence {
  readonly kind: StorageKind;
  private readonly backend: KVBackend;
  private cache: DataSnapshot | null = null;

  constructor(kind: StorageKind, backend: KVBackend) {
    this.kind = kind;
    this.backend = backend;
  }

  private key(t: TableName) {
    return `forge:db:${t}`;
  }

  private read(): DataSnapshot {
    if (this.cache) return this.cache;
    const snap = emptySnapshot();
    for (const t of TABLES) {
      try {
        const raw = this.backend.get(this.key(t));
        if (raw) (snap[t] as unknown[]) = JSON.parse(raw);
      } catch {
        // Corrupt table — start it fresh rather than failing the whole app.
      }
    }
    this.cache = snap;
    return snap;
  }

  private write(t: TableName) {
    this.backend.set(this.key(t), JSON.stringify(this.read()[t]));
  }

  async load() {
    return structuredClone(this.read());
  }

  async put<T extends TableName>(table: T, rows: RowOf<T>[]) {
    const snap = this.read();
    const byId = new Map((snap[table] as RowOf<T>[]).map((r) => [r.id, r]));
    for (const r of rows) byId.set(r.id, r);
    (snap[table] as RowOf<T>[]) = [...byId.values()];
    this.write(table);
  }

  async remove(table: TableName, ids: string[]) {
    const drop = new Set(ids);
    const snap = this.read();
    (snap[table] as { id: string }[]) = (snap[table] as { id: string }[]).filter((r) => !drop.has(r.id));
    this.write(table);
  }

  async replace(snapshot: DataSnapshot) {
    this.cache = structuredClone(snapshot);
    for (const t of TABLES) this.write(t);
  }
}

function localStorageBackend(): KVBackend | null {
  try {
    const probe = '__forge_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return {
      get: (k) => localStorage.getItem(k),
      set: (k, v) => localStorage.setItem(k, v),
    };
  } catch {
    return null;
  }
}

function memoryBackend(): KVBackend {
  const map = new Map<string, string>();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Opens the best available storage engine: IndexedDB → localStorage → memory.
 * IndexedDB can be missing or hang (some private-browsing modes), so it is
 * probed with a timeout before falling back.
 */
export async function openPersistence(): Promise<Persistence> {
  if (typeof indexedDB !== 'undefined') {
    try {
      return await withTimeout(DexiePersistence.open(), 4000);
    } catch (err) {
      console.warn('[forge] IndexedDB unavailable, falling back to localStorage.', err);
    }
  }
  const ls = localStorageBackend();
  if (ls) return new KVPersistence('localstorage', ls);
  console.warn('[forge] No persistent storage available; data will not survive a reload.');
  return new KVPersistence('memory', memoryBackend());
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

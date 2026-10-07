import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { emptySnapshot, openPersistence } from './persistence';
import type { Routine } from '../types';

const routine = (id: string, order: number): Routine => ({
  id,
  name: id,
  order,
  exercises: [],
  createdAt: 1,
  updatedAt: 1,
});

describe('IndexedDB persistence', () => {
  it('opens IndexedDB and round-trips rows', async () => {
    const db = await openPersistence();
    expect(db.kind).toBe('indexeddb');

    await db.put('routines', [routine('a', 0), routine('b', 1)]);
    await db.put('routines', [{ ...routine('a', 0), name: 'renamed' }]);
    await db.remove('routines', ['b']);

    const snap = await db.load();
    expect(snap.routines).toEqual([{ ...routine('a', 0), name: 'renamed' }]);
  });

  it('replaces the full snapshot atomically', async () => {
    const db = await openPersistence();
    await db.replace({ ...emptySnapshot(), routines: [routine('z', 0)] });
    const snap = await db.load();
    expect(snap.routines.map((r) => r.id)).toEqual(['z']);
    expect(snap.workouts).toEqual([]);
  });
});

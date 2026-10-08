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

  it('stores the food diary, saved meals and water', async () => {
    const db = await openPersistence();
    const nutrients = { kcal: 100, protein: 5, carbs: 10, fat: 3 };
    const entry = {
      id: 'e1',
      day: '2026-10-08',
      meal: 'lunch' as const,
      name: 'Soup',
      quantity: 1,
      unit: 'g' as const,
      grams: 0,
      nutrients,
      createdAt: 1,
    };
    await db.put('foodEntries', [entry]);
    await db.put('savedMeals', [{ id: 'm1', name: 'Lunch', items: [entry], createdAt: 1 }]);
    await db.put('water', [{ id: '2026-10-08', ml: 750 }]);
    await db.put('foods', [
      { id: 'custom-food-1', name: 'Bar', per100: nutrients, source: 'custom' as const, createdAt: 1 },
    ]);
    const snap = await db.load();
    expect(snap.foodEntries).toEqual([entry]);
    expect(snap.savedMeals[0].items[0].name).toBe('Soup');
    expect(snap.water).toEqual([{ id: '2026-10-08', ml: 750 }]);
    expect(snap.foods.map((f) => f.id)).toEqual(['custom-food-1']);
  });
});

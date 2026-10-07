import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet } from '../types';
import {
  lifetimeTotals,
  mostImproved,
  repZones,
  targetStatus,
  tonnageComparison,
  trainingTimes,
  workoutRecords,
} from './insights';

const set = (weight: number, reps: number, type: WorkoutSet['type'] = 'normal'): WorkoutSet => ({
  id: Math.random().toString(36),
  type,
  weight,
  reps,
  rpe: null,
  rir: null,
  completed: true,
});

const workout = (start: Date, sets: WorkoutSet[], minutes = 60, exerciseId = 'bench-press'): Workout => ({
  id: Math.random().toString(36),
  name: 'w',
  startedAt: start.getTime(),
  endedAt: start.getTime() + minutes * 60_000,
  exercises: [{ id: 'e', exerciseId, sets }],
});

describe('insights', () => {
  it('splits working sets into rep zones (ignoring warm-ups)', () => {
    const z = repZones([
      workout(new Date(2026, 9, 5, 18), [set(100, 3), set(80, 8), set(80, 10), set(40, 15), set(40, 20, 'warmup')]),
    ]);
    expect(z.map((x) => x.sets)).toEqual([1, 2, 1]);
    expect(z[1].share).toBeCloseTo(0.5);
  });

  it('counts weekdays (Mon-first) and parts of the day', () => {
    const t = trainingTimes([
      workout(new Date(2026, 9, 5, 7), []), // Mon morning
      workout(new Date(2026, 9, 7, 18), []), // Wed evening
      workout(new Date(2026, 9, 11, 1), []), // Sun night (1 am)
    ]);
    expect(t.weekdays).toEqual([1, 0, 1, 0, 0, 0, 1]);
    expect(t.parts.map((p) => p.count)).toEqual([1, 0, 1, 1]);
  });

  it('ranks the most improved lifts by e1RM % change', () => {
    const ws = [
      workout(new Date(2026, 8, 1, 18), [set(100, 5)]),
      workout(new Date(2026, 9, 1, 18), [set(110, 5)]),
      workout(new Date(2026, 8, 2, 18), [set(100, 5)], 60, 'squat'),
      workout(new Date(2026, 9, 2, 18), [set(130, 5)], 60, 'squat'),
    ];
    const top = mostImproved(ws, 0);
    expect(top.map((t) => t.exerciseId)).toEqual(['squat', 'bench-press']);
    expect(top[0].pct).toBeCloseTo(0.3);
  });

  it('finds records and lifetime totals', () => {
    const ws = [
      workout(new Date(2026, 9, 1, 18), [set(100, 5), set(100, 5)], 45),
      workout(new Date(2026, 9, 3, 18), [set(120, 3)], 90),
    ];
    const r = workoutRecords(ws);
    expect(r.longest).toBe(ws[1]);
    expect(r.heaviest).toBe(ws[0]);
    expect(r.bestWeek?.count).toBe(2);
    const l = lifetimeTotals(ws);
    expect(l).toMatchObject({ volume: 1360, sets: 3, reps: 13, workouts: 2, exercises: 1 });
    expect(l.hours).toBeCloseTo(2.25);
  });

  it('makes tonnage tangible', () => {
    expect(tonnageComparison(19_200)).toBe('≈ 1.6 city buses');
    expect(tonnageComparison(9_600)).toBe('≈ 1.2 T. rexes');
    expect(tonnageComparison(6_000)).toBe('≈ 1 African elephant');
    expect(tonnageComparison(240)).toBe('50% of a grand piano');
  });

  it('grades weekly sets against 10–20', () => {
    expect([0, 4, 12, 26].map(targetStatus)).toEqual(['none', 'under', 'on', 'over']);
  });
});

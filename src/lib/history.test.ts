import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet } from '../types';
import { computeWorkoutPRs, getHistoryIndex, lastSession, matchPreviousSets, setLabels } from './history';

let n = 0;
const set = (
  weight: number | null,
  reps: number | null,
  type: WorkoutSet['type'] = 'normal',
  completed = true,
): WorkoutSet => ({
  id: `s${++n}`,
  type,
  weight,
  reps,
  rpe: null,
  rir: null,
  completed,
});

const workout = (id: string, day: number, exercises: Record<string, WorkoutSet[]>, finished = true): Workout => ({
  id,
  name: id,
  startedAt: day * 86_400_000,
  endedAt: finished ? day * 86_400_000 + 3_600_000 : undefined,
  exercises: Object.entries(exercises).map(([exerciseId, sets], i) => ({ id: `${id}-e${i}`, exerciseId, sets })),
});

describe('getHistoryIndex', () => {
  const w1 = workout('w1', 1, { bench: [set(60, 10, 'warmup'), set(100, 5), set(100, 5)] });
  const w2 = workout('w2', 3, { bench: [set(105, 3)], squat: [set(140, 5)] });
  const active = workout('w3', 4, { bench: [set(200, 1)] }, false);
  const index = getHistoryIndex([w1, w2, active]);

  it('ignores unfinished workouts and sorts newest first', () => {
    expect(index.sorted.map((w) => w.id)).toEqual(['w2', 'w1']);
  });

  it('computes bests excluding warm-ups', () => {
    const b = index.bests.get('bench')!;
    expect(b.weight).toBe(105);
    expect(b.reps).toBe(5);
    expect(b.volume).toBe(500);
    expect(b.e1rm).toBeCloseTo(116.667, 2);
  });

  it('memoizes on array identity', () => {
    const arr = [w1, w2];
    expect(getHistoryIndex(arr)).toBe(getHistoryIndex(arr));
  });

  it('finds the last session', () => {
    expect(lastSession(index, 'bench')?.workoutId).toBe('w2');
    expect(lastSession(index, 'bench', 'w2')?.workoutId).toBe('w1');
    expect(lastSession(index, 'deadlift')).toBeUndefined();
  });
});

describe('computeWorkoutPRs', () => {
  const history = getHistoryIndex([workout('h', 1, { bench: [set(100, 5), set(90, 8)] })]);

  it('detects weight, reps, volume and e1RM records', () => {
    const s = set(102.5, 9);
    const prs = computeWorkoutPRs(workout('a', 2, { bench: [s] }, false), history);
    expect(prs.get(s.id)?.sort()).toEqual(['e1rm', 'reps', 'volume', 'weight']);
  });

  it('only awards the first set that beats a record within a session', () => {
    const a = set(105, 3);
    const b = set(105, 3);
    const prs = computeWorkoutPRs(workout('a', 2, { bench: [a, b] }, false), history);
    expect(prs.get(a.id)).toContain('weight');
    expect(prs.has(b.id)).toBe(false);
  });

  it('ignores warm-ups, incomplete sets and first-ever exercises', () => {
    const warm = set(200, 10, 'warmup');
    const open = set(200, 10, 'normal', false);
    const fresh = set(50, 10);
    const prs = computeWorkoutPRs(workout('a', 2, { bench: [warm, open], row: [fresh] }, false), history);
    expect(prs.size).toBe(0);
  });
});

describe('matchPreviousSets', () => {
  it('pairs warm-ups with warm-ups and working sets with working sets', () => {
    const prev = [set(60, 10, 'warmup'), set(100, 5), set(100, 4)];
    const cur = [set(null, null), set(null, null, 'warmup'), set(null, null)];
    const matched = matchPreviousSets(cur, prev);
    expect(matched[0]?.weight).toBe(100);
    expect(matched[1]?.type).toBe('warmup');
    expect(matched[2]?.reps).toBe(4);
  });
});

describe('setLabels', () => {
  it('numbers working sets and letters the rest', () => {
    const labels = setLabels([set(1, 1, 'warmup'), set(1, 1), set(1, 1), set(1, 1, 'drop'), set(1, 1, 'failure')]);
    expect(labels).toEqual(['W', '1', '2', 'D', 'F']);
  });
});

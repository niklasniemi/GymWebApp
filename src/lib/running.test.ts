import { describe, expect, it } from 'vitest';
import type { RunData } from '../types';
import {
  formatPace,
  formatRunTime,
  newRunRecords,
  paceSeconds,
  parseRunTime,
  riegel,
  runCalories,
  runRecords,
  weeklyDistance,
  type RunWorkout,
} from './running';

const run = (
  id: string,
  distance: number,
  duration: number,
  startedAt = 0,
  extra: Partial<RunData> = {},
): RunWorkout => ({
  id,
  name: id,
  startedAt,
  endedAt: startedAt + duration * 1000,
  exercises: [],
  run: { type: 'outdoor', distance, duration, ...extra },
});

describe('running basics', () => {
  it('formats time and pace in km and miles', () => {
    expect(formatRunTime(1500)).toBe('25:00');
    expect(formatRunTime(3725)).toBe('1:02:05');
    const r = { distance: 5000, duration: 1500 };
    expect(formatPace(paceSeconds(r, 'kg'), 'kg')).toBe('5:00 /km');
    expect(formatPace(paceSeconds(r, 'lb'), 'lb')).toBe('8:03 /mi');
  });

  it('parses typed times', () => {
    expect(parseRunTime('25:30')).toBe(1530);
    expect(parseRunTime('1:02:05')).toBe(3725);
    expect(parseRunTime('42')).toBe(2520);
    expect(parseRunTime('ab')).toBeNull();
  });

  it('estimates energy from distance, body weight and climb', () => {
    expect(runCalories({ type: 'outdoor', distance: 10000, duration: 3000 }, 70)).toBe(630);
    expect(runCalories({ type: 'outdoor', distance: 10000, duration: 3000, elevation: 200 }, 70)).toBe(650);
  });
});

describe('running records', () => {
  it('finds longest, fastest and Riegel best efforts', () => {
    const runs = [run('a', 5000, 1500), run('b', 10000, 3000), run('c', 3000, 840)];
    const r = runRecords(runs);
    expect(r.longest?.id).toBe('b');
    expect(r.fastest?.id).toBe('c');
    expect(r.efforts['5k']?.workoutId).toBe('b');
    expect(r.efforts['5k']?.time).toBeCloseTo(riegel(3000, 10000, 5000), 5);
    expect(r.efforts['10k']?.time).toBe(3000);
    expect(r.efforts.half).toBeUndefined();
  });

  it('reports records a new run sets, but none for the very first run', () => {
    const earlier = [run('a', 5000, 1500)];
    expect(newRunRecords(run('first', 5000, 1400), [])).toEqual([]);
    expect(newRunRecords(run('b', 6000, 1700), earlier)).toEqual(['Longest run', 'Fastest pace', 'Best 5K']);
  });

  it('sums distance per week', () => {
    const now = new Date(2026, 9, 8, 12).getTime();
    const weeks = weeklyDistance(
      [run('a', 5000, 1500, now - 86_400_000), run('b', 8000, 2500, now - 9 * 86_400_000)],
      3,
      now,
    );
    expect(weeks.map((w) => w.distance)).toEqual([0, 8000, 5000]);
  });
});

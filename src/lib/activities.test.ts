import { describe, expect, it } from 'vitest';
import type { Workout } from '../types';
import { activityCalories, formatActiveTime, sportSummary, type ActivityWorkout } from './activities';
import { effortFactor } from './momentum';
import { workoutCalories } from './nutrition';

const act = (
  id: string,
  sport: ActivityWorkout['activity']['sport'],
  minutes: number,
  rpe?: number,
): ActivityWorkout => ({
  id,
  name: id,
  startedAt: 0,
  endedAt: minutes * 60_000,
  exercises: [],
  activity: { sport, duration: minutes * 60, rpe },
});

describe('activities', () => {
  it('estimates energy from MET, weight, time and effort', () => {
    // Tennis 7.3 MET → (7.3 − 1) × 80 kg × 1 h = 504 kcal
    expect(activityCalories(act('a', 'tennis', 60).activity, 80)).toBe(504);
    expect(activityCalories(act('b', 'padel', 90, 9).activity, 80)).toBe(690); // 5 × 80 × 1.5 × 1.15
    expect(workoutCalories(act('c', 'padel', 60) as Workout, 80)).toBe(400);
  });

  it('summarises time per sport', () => {
    const s = sportSummary([act('a', 'padel', 60), act('b', 'tennis', 90), act('c', 'padel', 45)]);
    expect(s.map((r) => [r.sport, r.sessions, r.seconds])).toEqual([
      ['padel', 2, 6300],
      ['tennis', 1, 5400],
    ]);
    expect(formatActiveTime(6300)).toBe('1 h 45 min');
  });

  it('feeds the fire relative to earlier sessions of the same sport', () => {
    const earlier = [act('1', 'padel', 60), act('2', 'padel', 60), act('3', 'padel', 60)];
    expect(effortFactor(act('x', 'padel', 120), earlier)).toBeGreaterThan(effortFactor(act('y', 'padel', 60), earlier));
    // A long padel session isn't judged against lifting volume (which would floor it at 0.6).
    expect(effortFactor(act('z', 'padel', 60), [])).toBeCloseTo(1, 5);
  });
});

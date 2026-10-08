import { describe, expect, it } from 'vitest';
import type { BodyMeasurement } from '../types';
import { formatWeeks, weightGoalStatus, weightTrend } from './weightGoal';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 8).getTime();
const weigh = (daysAgo: number, kg: number): BodyMeasurement => ({
  id: String(daysAgo),
  date: NOW - daysAgo * DAY,
  values: { weight: kg },
});

describe('weight trend', () => {
  it('fits kg per week over recent weigh-ins', () => {
    const m = [weigh(21, 82), weigh(14, 81.5), weigh(7, 81), weigh(0, 80.5)];
    expect(weightTrend(m, NOW)).toBeCloseTo(-0.5, 5);
  });

  it('needs enough data', () => {
    expect(weightTrend([weigh(2, 80), weigh(1, 80), weigh(0, 79)], NOW)).toBeNull(); // < 1 week span
    expect(weightTrend([weigh(14, 80), weigh(0, 79)], NOW)).toBeNull(); // < 3 points
  });
});

describe('weight goal status', () => {
  const goal = { targetKg: 75, startKg: 85, startedAt: NOW - 30 * DAY };

  it('computes progress and both ETAs', () => {
    const s = weightGoalStatus(goal, 80, 0.5, -0.4, NOW);
    expect(s.direction).toBe('lose');
    expect(s.remainingKg).toBe(5);
    expect(s.progress).toBe(0.5);
    expect(s.plannedWeeks).toBe(10);
    expect(s.trendWeeks).toBeCloseTo(12.5, 5);
    expect(s.plannedDate).toBe(NOW + 10 * 7 * DAY);
  });

  it('ignores a trend heading the wrong way, and detects reaching the target', () => {
    expect(weightGoalStatus(goal, 80, 0.5, 0.3, NOW).trendWeeks).toBeNull();
    const done = weightGoalStatus(goal, 74.9, 0.5, -0.4, NOW);
    expect(done.reached).toBe(true);
    expect(done.progress).toBe(1);
  });

  it('works for gaining', () => {
    const s = weightGoalStatus({ targetKg: 80, startKg: 75, startedAt: 0 }, 76, 0.25, 0.25, NOW);
    expect(s.direction).toBe('gain');
    expect(s.remainingKg).toBe(4);
    expect(s.plannedWeeks).toBe(16);
  });

  it('formats durations', () => {
    expect(formatWeeks(3.2)).toBe('≈ 3 weeks');
    expect(formatWeeks(20)).toBe('≈ 5 months');
  });
});

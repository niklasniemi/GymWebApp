import type { BodyMeasurement } from '../types';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export interface WeightGoal {
  targetKg: number;
  /** Weight when the goal was set — the 0 % point of the progress bar. */
  startKg: number;
  startedAt: number;
}

export interface WeightGoalStatus {
  direction: 'lose' | 'gain';
  currentKg: number;
  /** kg still to go (always ≥ 0). */
  remainingKg: number;
  /** 0–1 from start weight to target. */
  progress: number;
  reached: boolean;
  /** Weeks to target at the planned weekly rate (null when no rate). */
  plannedWeeks: number | null;
  plannedDate: number | null;
  /** Actual kg/week from recent weigh-ins (negative = losing); null without enough data. */
  trendPerWeek: number | null;
  /** Weeks to target at the current trend, when it points toward the target. */
  trendWeeks: number | null;
  trendDate: number | null;
}

/**
 * Least-squares slope (kg/week) of weigh-ins in the last `days` days. Needs
 * at least 3 weigh-ins spanning a week, so a single heavy morning can't
 * swing the forecast.
 */
export function weightTrend(measurements: BodyMeasurement[], now = Date.now(), days = 28): number | null {
  const pts = measurements
    .filter((m) => typeof m.values.weight === 'number' && m.date >= now - days * DAY && m.date <= now)
    .map((m) => ({ x: (m.date - now) / WEEK, y: m.values.weight as number }));
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p.x);
  if (Math.max(...xs) - Math.min(...xs) < 1) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den > 0 ? num / den : null;
}

/** Where you are on the way to a target weight, and when you'll get there. */
export function weightGoalStatus(
  goal: WeightGoal,
  currentKg: number,
  ratePerWeek: number,
  trendPerWeek: number | null,
  now = Date.now(),
): WeightGoalStatus {
  const direction = goal.targetKg < goal.startKg ? 'lose' : 'gain';
  const sign = direction === 'lose' ? -1 : 1;
  const remainingKg = Math.max(0, sign * (goal.targetKg - currentKg));
  const span = Math.abs(goal.targetKg - goal.startKg);
  const done = sign * (currentKg - goal.startKg);
  const progress = span > 0 ? Math.min(1, Math.max(0, done / span)) : 1;
  const reached = remainingKg <= 0.05;

  const plannedWeeks = reached ? 0 : ratePerWeek > 0 ? remainingKg / ratePerWeek : null;
  // A trend counts only when it heads toward the target at a meaningful pace (≥ 50 g/week).
  const towards = trendPerWeek !== null && sign * trendPerWeek >= 0.05 ? Math.abs(trendPerWeek) : null;
  const trendWeeks = reached ? 0 : towards ? remainingKg / towards : null;

  return {
    direction,
    currentKg,
    remainingKg,
    progress,
    reached,
    plannedWeeks,
    plannedDate: plannedWeeks !== null ? now + plannedWeeks * WEEK : null,
    trendPerWeek,
    trendWeeks,
    trendDate: trendWeeks !== null ? now + trendWeeks * WEEK : null,
  };
}

/** "≈ 12 weeks", "≈ 5 months", "≈ 1.5 years". */
export function formatWeeks(weeks: number): string {
  if (weeks < 1) return 'under a week';
  if (weeks < 10) return `≈ ${Math.round(weeks)} week${Math.round(weeks) === 1 ? '' : 's'}`;
  const months = weeks / 4.345;
  if (months < 18) return `≈ ${Math.round(months)} months`;
  return `≈ ${Math.round((months / 12) * 2) / 2} years`;
}

import type { RunData, RunType, Unit, Workout } from '../types';
import { addDays, startOfWeek } from './format';

/*
 * Runs are logged after the fact and stored as workouts with `run` data and
 * no exercises, so they count toward the weekly goal, streaks and the fire.
 * Distances are canonical metres; display follows the weight unit
 * (kg → km, lb → miles).
 */

export const M_PER_MILE = 1609.344;

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  outdoor: 'Outdoor',
  treadmill: 'Treadmill',
  trail: 'Trail',
};

export type RunWorkout = Workout & { run: RunData };

export const isRun = (w: Workout): w is RunWorkout => w.run !== undefined;

export const distanceUnit = (unit: Unit) => (unit === 'kg' ? 'km' : 'mi');

/** Metres → km or miles. */
export const toDisplayDistance = (m: number, unit: Unit) => m / (unit === 'kg' ? 1000 : M_PER_MILE);
export const fromDisplayDistance = (v: number, unit: Unit) => v * (unit === 'kg' ? 1000 : M_PER_MILE);

export function formatDistance(m: number, unit: Unit, withUnit = true): string {
  const v = toDisplayDistance(m, unit);
  const s = v.toLocaleString(undefined, { maximumFractionDigits: v >= 100 ? 0 : v >= 10 ? 1 : 2 });
  return withUnit ? `${s} ${distanceUnit(unit)}` : s;
}

/** h:mm:ss or m:ss. */
export function formatRunTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Seconds per km (or mile). */
export function paceSeconds(run: Pick<RunData, 'distance' | 'duration'>, unit: Unit): number {
  const d = toDisplayDistance(run.distance, unit);
  return d > 0 ? run.duration / d : 0;
}

export function formatPace(secPerUnit: number, unit: Unit, withUnit = true): string {
  if (!Number.isFinite(secPerUnit) || secPerUnit <= 0) return '–';
  return `${formatRunTime(secPerUnit)}${withUnit ? ` /${distanceUnit(unit)}` : ''}`;
}

export function speedKmh(run: Pick<RunData, 'distance' | 'duration'>): number {
  return run.duration > 0 ? run.distance / 1000 / (run.duration / 3600) : 0;
}

export function runNameForTime(ts: number): string {
  const h = new Date(ts).getHours();
  if (h < 5) return 'Night Run';
  if (h < 12) return 'Morning Run';
  if (h < 17) return 'Afternoon Run';
  if (h < 21) return 'Evening Run';
  return 'Night Run';
}

/**
 * Net energy of a run: ≈ 0.9 kcal per kg per km on the flat (running costs
 * about 1 kcal/kg/km gross, minus resting), plus ~10 kcal per 100 m climbed
 * per 70 kg. Treadmill runs cost slightly less (no air resistance).
 */
export function runCalories(run: RunData, weightKg: number): number {
  const km = run.distance / 1000;
  const flat = 0.9 * weightKg * km * (run.type === 'treadmill' ? 0.95 : 1);
  const climb = ((run.elevation ?? 0) / 100) * 10 * (weightKg / 70);
  return Math.round(flat + climb);
}

/** Riegel's endurance model: predicted time for distance d2 from a run of d1 in t1. */
export const riegel = (t1: number, d1: number, d2: number) => t1 * Math.pow(d2 / d1, 1.06);

export const BEST_EFFORTS = [
  { key: '5k', label: '5K', distance: 5000 },
  { key: '10k', label: '10K', distance: 10000 },
  { key: 'half', label: 'Half marathon', distance: 21097.5 },
] as const;
export type BestEffortKey = (typeof BEST_EFFORTS)[number]['key'];

/**
 * Best estimated time for a target distance: from runs at least that long
 * (a whole run is an upper bound on the split, scaled down with Riegel), or
 * slightly shorter runs (≥ 90 %), scaled up.
 */
function bestEffort(runs: RunWorkout[], distance: number): { time: number; workoutId: string } | null {
  let best: { time: number; workoutId: string } | null = null;
  for (const w of runs) {
    const { distance: d, duration: t } = w.run;
    if (d < distance * 0.9 || t <= 0) continue;
    const time = riegel(t, d, distance);
    if (!best || time < best.time) best = { time, workoutId: w.id };
  }
  return best;
}

export interface RunRecords {
  longest: RunWorkout | null;
  fastest: RunWorkout | null;
  efforts: Partial<Record<BestEffortKey, { time: number; workoutId: string }>>;
}

/** Longest run, fastest pace (runs ≥ 1 km) and estimated best 5K / 10K / half. */
export function runRecords(runs: RunWorkout[]): RunRecords {
  let longest: RunWorkout | null = null;
  let fastest: RunWorkout | null = null;
  for (const w of runs) {
    if (!longest || w.run.distance > longest.run.distance) longest = w;
    if (w.run.distance >= 1000 && w.run.duration > 0) {
      if (!fastest || w.run.duration / w.run.distance < fastest.run.duration / fastest.run.distance) fastest = w;
    }
  }
  const efforts: RunRecords['efforts'] = {};
  for (const e of BEST_EFFORTS) {
    const b = bestEffort(runs, e.distance);
    if (b) efforts[e.key] = b;
  }
  return { longest, fastest, efforts };
}

/** Records a new run sets compared with earlier runs (labels for a toast). */
export function newRunRecords(run: RunWorkout, earlier: RunWorkout[]): string[] {
  if (!earlier.length) return [];
  const before = runRecords(earlier);
  const after = runRecords([...earlier, run]);
  const out: string[] = [];
  if (after.longest?.id === run.id && before.longest && run.run.distance > before.longest.run.distance)
    out.push('Longest run');
  if (after.fastest?.id === run.id && before.fastest) out.push('Fastest pace');
  for (const e of BEST_EFFORTS) {
    const prev = before.efforts[e.key];
    const next = after.efforts[e.key];
    if (next?.workoutId === run.id && prev && next.time < prev.time) out.push(`Best ${e.label}`);
  }
  return out;
}

/** Total distance per week (Monday start) for the last `weeks` weeks, oldest first. */
export function weeklyDistance(runs: RunWorkout[], weeks: number, now = Date.now()) {
  const thisWeek = startOfWeek(now);
  const out = Array.from({ length: weeks }, (_, i) => ({ week: addDays(thisWeek, -7 * (weeks - 1 - i)), distance: 0 }));
  const first = out[0].week;
  for (const w of runs) {
    if (w.startedAt < first) continue;
    const i = out.findIndex((b, j) => w.startedAt >= b.week && (j === out.length - 1 || w.startedAt < out[j + 1].week));
    if (i >= 0) out[i].distance += w.run.distance;
  }
  return out;
}

/** Parses "h:mm:ss", "mm:ss" or plain minutes into seconds. */
export function parseRunTime(input: string): number | null {
  const parts = input
    .trim()
    .split(':')
    .map((p) => p.trim());
  if (!parts.length || parts.some((p) => p === '' || !/^\d+([.,]\d+)?$/.test(p))) return null;
  const nums = parts.map((p) => Number(p.replace(',', '.')));
  if (nums.length === 1) return Math.round(nums[0] * 60);
  if (nums.length === 2) return Math.round(nums[0] * 60 + nums[1]);
  if (nums.length === 3) return Math.round(nums[0] * 3600 + nums[1] * 60 + nums[2]);
  return null;
}

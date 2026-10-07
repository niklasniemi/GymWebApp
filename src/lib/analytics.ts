import type { BodyMeasurement, Exercise, MeasurementKey, MuscleGroup, PRType, Workout, WorkoutSet } from '../types';
import { MUSCLE_GROUPS } from '../types';
import { addDays, formatShortDate, startOfDay, startOfWeek } from './format';
import { workoutVolume } from './history';

export type RangeKey = '1w' | '4w' | '12w' | '6m' | '1y' | 'all';

export const RANGES: { value: RangeKey; label: string; days: number | null }[] = [
  { value: '1w', label: '1W', days: 7 },
  { value: '4w', label: '4W', days: 28 },
  { value: '12w', label: '12W', days: 84 },
  { value: '6m', label: '6M', days: 182 },
  { value: '1y', label: '1Y', days: 365 },
  { value: 'all', label: 'All', days: null },
];

export function rangeStart(range: RangeKey, now = Date.now()): number {
  const days = RANGES.find((r) => r.value === range)?.days;
  return days ? startOfDay(addDays(now, -days + 1)) : 0;
}

export function inRange(workouts: Workout[], range: RangeKey): Workout[] {
  const from = rangeStart(range);
  return workouts.filter((w) => w.startedAt >= from);
}

export interface Bucket {
  key: string;
  label: string;
  value: number;
}

/** Volume per week (short ranges) or per month (long ranges), zero-filled. */
/** Bucket granularity for a range: days for 1W, weeks up to 6M, months beyond. */
export const bucketUnit = (range: RangeKey): 'day' | 'week' | 'month' =>
  range === '1w' ? 'day' : range === '1y' || range === 'all' ? 'month' : 'week';

/** Zero-filled per-period totals of `value(workout)` for a range. */
export function periodBuckets(
  workouts: Workout[],
  range: RangeKey,
  value: (w: Workout) => number,
  now = Date.now(),
  reduce: 'sum' | 'mean' = 'sum',
): Bucket[] {
  const unit = bucketUnit(range);
  const from = range === 'all' ? Math.min(now, ...workouts.map((w) => w.startedAt)) : rangeStart(range, now);
  const keyOf = (ts: number) => {
    if (unit === 'day') return startOfDay(ts);
    if (unit === 'week') return startOfWeek(ts);
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  };
  const next = (t: number) => {
    if (unit === 'day') return addDays(t, 1);
    if (unit === 'week') return addDays(t, 7);
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  };
  const sums = new Map<number, { total: number; n: number }>();
  // Zero-fill so gaps in training are visible.
  for (let t = keyOf(from); t <= now; t = next(t)) sums.set(t, { total: 0, n: 0 });
  for (const w of workouts) {
    if (w.startedAt < from) continue;
    const b = sums.get(keyOf(w.startedAt)) ?? { total: 0, n: 0 };
    b.total += value(w);
    b.n++;
    sums.set(keyOf(w.startedAt), b);
  }
  return [...sums.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, b]) => ({
      key: String(k),
      label:
        unit === 'day'
          ? new Date(k).toLocaleDateString(undefined, { weekday: 'short' })
          : unit === 'month'
            ? new Date(k).toLocaleDateString(undefined, {
                month: 'short',
                year: range === 'all' ? '2-digit' : undefined,
              })
            : formatShortDate(k),
      value: reduce === 'mean' ? (b.n ? b.total / b.n : 0) : b.total,
    }));
}

/** Volume per day (1W), week, or month (1Y / All), zero-filled. */
export function volumeBuckets(workouts: Workout[], range: RangeKey, now = Date.now()): Bucket[] {
  return periodBuckets(workouts, range, workoutVolume, now);
}

export interface HeatCell {
  date: number;
  count: number;
  volume: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/** Day grid for the last `weeks` weeks (Mon → Sun columns), with quantile levels. */
export function frequencyGrid(workouts: Workout[], weeks = 18, now = Date.now()): HeatCell[][] {
  const start = addDays(startOfWeek(now), -(weeks - 1) * 7);
  const byDay = new Map<number, { count: number; volume: number }>();
  for (const w of workouts) {
    if (w.startedAt < start) continue;
    const d = startOfDay(w.startedAt);
    const cur = byDay.get(d) ?? { count: 0, volume: 0 };
    cur.count++;
    cur.volume += workoutVolume(w);
    byDay.set(d, cur);
  }
  const volumes = [...byDay.values()].map((v) => v.volume).sort((a, b) => a - b);
  const q = (p: number) => volumes[Math.min(volumes.length - 1, Math.floor(p * volumes.length))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const today = startOfDay(now);

  const columns: HeatCell[][] = [];
  for (let wk = 0; wk < weeks; wk++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, wk * 7 + d);
      const v = byDay.get(date);
      let level: HeatCell['level'] = 0;
      if (v) level = v.volume <= cuts[0] ? 1 : v.volume <= cuts[1] ? 2 : v.volume <= cuts[2] ? 3 : 4;
      col.push({ date, count: v?.count ?? 0, volume: v?.volume ?? 0, level, future: date > today });
    }
    columns.push(col);
  }
  return columns;
}

/** Working sets per primary muscle group. */
export function muscleSplit(
  workouts: Workout[],
  exercises: Map<string, Exercise>,
): { muscle: MuscleGroup; sets: number }[] {
  const counts = new Map<MuscleGroup, number>(MUSCLE_GROUPS.map((m) => [m, 0]));
  for (const w of workouts) {
    for (const we of w.exercises) {
      const m = exercises.get(we.exerciseId)?.primaryMuscle;
      if (!m) continue;
      counts.set(m, (counts.get(m) ?? 0) + we.sets.filter((s) => s.type !== 'warmup').length);
    }
  }
  return [...counts.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

export interface PREvent {
  workoutId: string;
  date: number;
  exerciseId: string;
  set: WorkoutSet;
  prs: PRType[];
}

export function recentPRs(sortedDesc: Workout[], limit = 8): PREvent[] {
  const out: PREvent[] = [];
  for (const w of sortedDesc) {
    for (const we of w.exercises) {
      for (const s of we.sets) {
        if (s.prs?.length)
          out.push({ workoutId: w.id, date: w.startedAt, exerciseId: we.exerciseId, set: s, prs: s.prs });
      }
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Body measurements
// ---------------------------------------------------------------------------

export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  weight: 'Body weight',
  bodyFat: 'Body fat',
  neck: 'Neck',
  shoulders: 'Shoulders',
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  biceps: 'Biceps',
  thigh: 'Thigh',
  calf: 'Calf',
};

/**
 * Exponentially smoothed trend (à la "The Hacker's Diet"): filters daily
 * water-weight noise so the real direction is visible.
 */
export function measurementSeries(entries: BodyMeasurement[], key: MeasurementKey, alpha = 0.35) {
  const points = entries
    .filter((e) => typeof e.values[key] === 'number')
    .sort((a, b) => a.date - b.date)
    .map((e) => ({ date: e.date, value: e.values[key] as number }));
  let trend: number | null = null;
  return points.map((p) => {
    trend = trend === null ? p.value : trend + alpha * (p.value - trend);
    return { ...p, trend };
  });
}

/** Change of the latest value vs. the closest entry ≥ `days` ago. */
export function measurementDelta(entries: BodyMeasurement[], key: MeasurementKey, days = 30) {
  const series = entries.filter((e) => typeof e.values[key] === 'number').sort((a, b) => b.date - a.date);
  if (series.length < 2) return null;
  const latest = series[0];
  const cutoff = addDays(latest.date, -days);
  const base = series.find((e) => e.date <= cutoff) ?? series[series.length - 1];
  return (latest.values[key] as number) - (base.values[key] as number);
}

/** Round axis ticks from 0: steps of 1, 2, 2.5 or 5 × 10ⁿ. */
export function niceTicks(max: number, intervals = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / intervals;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/** Round ticks spanning [min, max] for charts that don't start at zero. */
export function niceRangeTicks(min: number, max: number, intervals = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max - min < 1e-9) {
    const pad = Math.max(1, Math.abs(max) * 0.05);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / intervals;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.max(0, Math.floor(min / step) * step);
  const ticks: number[] = [];
  for (let v = start; v <= Math.ceil(max / step) * step + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

import type { Exercise, Workout } from '../types';
import { estimate1RM } from './calc';
import { addDays, startOfWeek } from './format';
import { getHistoryIndex, sessionSeries, workoutSetCount, workoutVolume } from './history';

const working = (w: Workout) => w.exercises.flatMap((e) => e.sets.filter((s) => s.completed && s.type !== 'warmup'));

// ---------------------------------------------------------------------------
// Rep ranges
// ---------------------------------------------------------------------------

export const REP_ZONES = [
  { id: 'strength', label: 'Strength', range: '1–5 reps', min: 1, max: 5 },
  { id: 'hypertrophy', label: 'Hypertrophy', range: '6–12 reps', min: 6, max: 12 },
  { id: 'endurance', label: 'Endurance', range: '13+ reps', min: 13, max: Infinity },
] as const;

export function repZones(
  workouts: Workout[],
): { id: string; label: string; range: string; sets: number; share: number }[] {
  const counts = REP_ZONES.map(() => 0);
  for (const w of workouts) {
    for (const s of working(w)) {
      const r = s.reps ?? 0;
      const i = REP_ZONES.findIndex((z) => r >= z.min && r <= z.max);
      if (i >= 0) counts[i]++;
    }
  }
  const total = counts.reduce((a, b) => a + b, 0);
  return REP_ZONES.map((z, i) => ({
    id: z.id,
    label: z.label,
    range: z.range,
    sets: counts[i],
    share: total ? counts[i] / total : 0,
  }));
}

// ---------------------------------------------------------------------------
// When you train
// ---------------------------------------------------------------------------

export const DAY_PARTS = [
  { id: 'morning', label: 'Morning', from: 5, to: 11 },
  { id: 'midday', label: 'Midday', from: 11, to: 17 },
  { id: 'evening', label: 'Evening', from: 17, to: 22 },
  { id: 'night', label: 'Night', from: 22, to: 29 },
] as const;

export function trainingTimes(workouts: Workout[]) {
  const weekdays = Array(7).fill(0) as number[]; // Mon..Sun
  const parts = DAY_PARTS.map(() => 0);
  for (const w of workouts) {
    const d = new Date(w.startedAt);
    weekdays[(d.getDay() + 6) % 7]++;
    const h = d.getHours() < 5 ? d.getHours() + 24 : d.getHours();
    const i = DAY_PARTS.findIndex((p) => h >= p.from && h < p.to);
    if (i >= 0) parts[i]++;
  }
  return { weekdays, parts: DAY_PARTS.map((p, i) => ({ ...p, count: parts[i] })) };
}

// ---------------------------------------------------------------------------
// Most improved lifts (e1RM, first vs last session in the window)
// ---------------------------------------------------------------------------

export function mostImproved(workouts: Workout[], from: number, limit = 5) {
  const index = getHistoryIndex(workouts);
  const out: { exerciseId: string; first: number; last: number; change: number; pct: number; sessions: number }[] = [];
  for (const [id, sessions] of index.sessions) {
    const pts = sessionSeries(sessions).filter((p) => p.date >= from && p.e1rm > 0);
    if (pts.length < 2) continue;
    const first = pts[0].e1rm;
    const last = pts[pts.length - 1].e1rm;
    out.push({ exerciseId: id, first, last, change: last - first, pct: (last - first) / first, sessions: pts.length });
  }
  return out.sort((a, b) => b.pct - a.pct).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export function workoutRecords(workouts: Workout[]) {
  const finished = workouts.filter((w) => w.endedAt);
  const longest = maxBy(finished, (w) => (w.endedAt ?? w.startedAt) - w.startedAt);
  const heaviest = maxBy(finished, workoutVolume);
  const mostSets = maxBy(finished, workoutSetCount);
  const weeks = new Map<number, number>();
  for (const w of finished) weeks.set(startOfWeek(w.startedAt), (weeks.get(startOfWeek(w.startedAt)) ?? 0) + 1);
  const bestWeek = [...weeks.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  let heaviestSet: { exerciseId: string; e1rm: number; date: number } | null = null;
  for (const w of finished) {
    for (const we of w.exercises) {
      for (const s of we.sets) {
        if (s.type === 'warmup') continue;
        const e = estimate1RM(s.weight, s.reps);
        if (!heaviestSet || e > heaviestSet.e1rm)
          heaviestSet = { exerciseId: we.exerciseId, e1rm: e, date: w.startedAt };
      }
    }
  }
  return {
    longest,
    heaviest,
    mostSets,
    bestWeek: bestWeek ? { start: bestWeek[0], count: bestWeek[1] } : null,
    heaviestSet,
  };
}

function maxBy<T>(items: T[], score: (t: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const it of items) {
    const s = score(it);
    if (s > bestScore) {
      best = it;
      bestScore = s;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Lifetime totals
// ---------------------------------------------------------------------------

const HEAVY_THINGS = [
  { name: 'grand pianos', one: 'grand piano', kg: 480 },
  { name: 'cars', one: 'car', kg: 1_500 },
  { name: 'African elephants', one: 'African elephant', kg: 6_000 },
  { name: 'T. rexes', one: 'T. rex', kg: 8_000 },
  { name: 'city buses', one: 'city bus', kg: 12_000 },
  { name: 'blue whales', one: 'blue whale', kg: 150_000 },
  { name: 'Boeing 747s', one: 'Boeing 747', kg: 400_000 },
];

/** "≈ 3.2 African elephants" — picks the biggest object you've out-lifted. */
export function tonnageComparison(kg: number): string | null {
  const thing = [...HEAVY_THINGS].reverse().find((t) => kg >= t.kg);
  if (!thing) return kg > 0 ? `${Math.round((kg / HEAVY_THINGS[0].kg) * 100)}% of a grand piano` : null;
  const n = kg / thing.kg;
  const count = n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '');
  return `≈ ${count} ${count === '1' ? thing.one : thing.name}`;
}

export function lifetimeTotals(workouts: Workout[]) {
  let volume = 0;
  let sets = 0;
  let reps = 0;
  let ms = 0;
  const exercises = new Set<string>();
  for (const w of workouts) {
    if (!w.endedAt) continue;
    volume += workoutVolume(w);
    ms += w.endedAt - w.startedAt;
    for (const we of w.exercises) {
      exercises.add(we.exerciseId);
      for (const s of we.sets) {
        if (!s.completed || s.type === 'warmup') continue;
        sets++;
        reps += s.reps ?? 0;
      }
    }
  }
  return { volume, sets, reps, hours: ms / 3_600_000, exercises: exercises.size, workouts: workouts.length };
}

// ---------------------------------------------------------------------------
// Weekly sets per muscle vs. an evidence-based 10–20 sets/week range
// ---------------------------------------------------------------------------

export const WEEKLY_SET_TARGET = { min: 10, max: 20 } as const;

export type TargetStatus = 'none' | 'under' | 'on' | 'over';

export function targetStatus(sets: number): TargetStatus {
  if (sets <= 0) return 'none';
  if (sets < WEEKLY_SET_TARGET.min) return 'under';
  if (sets <= WEEKLY_SET_TARGET.max) return 'on';
  return 'over';
}

/** Workouts in the last 7 days (rolling) — for weekly muscle targets. */
export function lastSevenDays(workouts: Workout[], now = Date.now()) {
  const from = addDays(now, -7);
  return workouts.filter((w) => w.startedAt >= from);
}

export type { Exercise };

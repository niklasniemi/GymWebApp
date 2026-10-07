import { exerciseMuscles, MUSCLES, type Muscle } from '../data/anatomy';
import type { Exercise, Routine, Workout } from '../types';
import { addDays, startOfDay } from './format';

export type MuscleLoad = Record<Muscle, number>;

/** A secondary mover gets half the credit of a primary mover. */
export const SECONDARY_WEIGHT = 0.5;

export const emptyLoad = (): MuscleLoad => Object.fromEntries(MUSCLES.map((m) => [m, 0])) as MuscleLoad;

function credit(load: MuscleLoad, ex: Exercise | undefined, sets: number) {
  if (!ex || sets <= 0) return;
  const { primary, secondary } = exerciseMuscles(ex);
  for (const m of primary) load[m] += sets;
  for (const m of secondary) load[m] += sets * SECONDARY_WEIGHT;
}

/** Effective working sets per muscle across workouts (completed, non-warm-up). */
export function workoutsMuscleLoad(workouts: Workout[], exercises: Map<string, Exercise>): MuscleLoad {
  const load = emptyLoad();
  for (const w of workouts) {
    for (const we of w.exercises) {
      const sets = we.sets.filter((s) => s.completed && s.type !== 'warmup').length;
      credit(load, exercises.get(we.exerciseId), sets);
    }
  }
  return load;
}

/** Planned sets per muscle for a routine template. */
export function routineMuscleLoad(routine: Pick<Routine, 'exercises'>, exercises: Map<string, Exercise>): MuscleLoad {
  const load = emptyLoad();
  for (const re of routine.exercises) credit(load, exercises.get(re.exerciseId), re.sets);
  return load;
}

/**
 * 0–1 heat per muscle, relative to the most-trained muscle. `floor` keeps a
 * single set from looking maxed out (e.g. 10 sets for a week).
 */
export function toHeat(load: MuscleLoad, floor = 0): MuscleLoad {
  const max = Math.max(floor, ...MUSCLES.map((m) => load[m]));
  const heat = emptyLoad();
  if (max <= 0) return heat;
  for (const m of MUSCLES) heat[m] = Math.min(1, load[m] / max);
  return heat;
}

export function rankMuscles(load: MuscleLoad): { muscle: Muscle; sets: number }[] {
  return MUSCLES.map((muscle) => ({ muscle, sets: load[muscle] })).sort((a, b) => b.sets - a.sets);
}

export type MuscleRange = 'day' | 'week' | 'month' | 'year';

export const MUSCLE_RANGES: { value: MuscleRange; label: string; floor: number; noun: string }[] = [
  { value: 'day', label: 'Today', floor: 3, noun: 'today' },
  { value: 'week', label: 'Week', floor: 10, noun: 'in the last 7 days' },
  { value: 'month', label: 'Month', floor: 30, noun: 'in the last 30 days' },
  { value: 'year', label: 'Year', floor: 200, noun: 'in the last year' },
];

export function muscleRangeStart(range: MuscleRange, now = Date.now()): number {
  const today = startOfDay(now);
  if (range === 'day') return today;
  if (range === 'week') return addDays(today, -6);
  if (range === 'month') return addDays(today, -29);
  return addDays(today, -364);
}

// ---------------------------------------------------------------------------
// Heat colors — a warm sequential ramp; untrained muscles stay neutral.
// ---------------------------------------------------------------------------

const STOPS: [number, string][] = [
  [0.04, '#fde68a'],
  [0.35, '#fb923c'],
  [0.7, '#ef4444'],
  [1, '#b91c1c'],
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${((1 << 24) | (c(r1, r2) << 16) | (c(g1, g2) << 8) | c(b1, b2)).toString(16).slice(1)}`;
}

/** Heat 0 → neutral body colour; >0 → pale yellow → orange → red → deep red. */
export function heatColor(heat: number, neutral: string): string {
  if (!(heat > 0)) return neutral;
  if (heat <= STOPS[0][0]) return mix(neutral, STOPS[0][1], heat / STOPS[0][0]);
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    const [t0, c0] = STOPS[i - 1];
    if (heat <= t1) return mix(c0, c1, (heat - t0) / (t1 - t0));
  }
  return STOPS[STOPS.length - 1][1];
}

export const HEAT_LEGEND = ['#fde68a', '#fb923c', '#ef4444', '#b91c1c'];

/** Untrained-muscle colour — matches the translucent body in the 3D view. */
export const BODY_NEUTRAL = { light: '#b9c7d9', dark: '#4f6a91' };

import type { Workout } from '../types';
import { addDays, startOfDay } from './format';
import { workoutSetCount, workoutVolume } from './history';

/*
 * Momentum ("the fire").
 *
 * Every workout adds fuel that decays exponentially (time constant TAU days).
 * Fuel per workout is sized from the weekly goal so that training exactly
 * `goal` times a week with typical sessions holds the fire at ~72–100 %:
 *
 *   average level ≈ fuel × (goal / 7 days) × TAU  →  fuel = TARGET × 7 / (goal × TAU)
 *
 * Effort scales the fuel: a session's volume and working sets are compared
 * with the median of your previous sessions, so a heavy day burns brighter
 * than a light one, relative to *you*.
 */

export const TAU_DAYS = 5;
const TARGET_AVERAGE = 92;
const DAY = 86_400_000;
const BASELINE_SESSIONS = 12;
const DEFAULT_SETS = 15;

export const fuelPerWorkout = (goal: number) => (TARGET_AVERAGE * 7) / (Math.max(1, goal) * TAU_DAYS);

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Effort multiplier (0.6–1.5) of a session relative to the previous ones. */
export function effortFactor(workout: Workout, previous: Workout[]): number {
  const recent = previous.slice(-BASELINE_SESSIONS);
  const sets = workoutSetCount(workout);
  const volume = workoutVolume(workout);
  const medSets = recent.length >= 3 ? median(recent.map(workoutSetCount)) : DEFAULT_SETS;
  const medVolume = recent.length >= 3 ? median(recent.map(workoutVolume)) : 0;
  const setRatio = medSets > 0 ? sets / medSets : 1;
  const relative = medVolume > 0 ? 0.5 * setRatio + 0.5 * (volume / medVolume) : setRatio;
  return Math.min(1.5, Math.max(0.6, 0.55 + 0.45 * relative));
}

export interface FuelEvent {
  at: number;
  fuel: number;
}

const cache = new WeakMap<Workout[], Map<number, FuelEvent[]>>();

/** Fuel events for all finished workouts (effort uses only earlier sessions). Memoised. */
export function fuelEvents(workouts: Workout[], goal: number): FuelEvent[] {
  let byGoal = cache.get(workouts);
  if (!byGoal) {
    byGoal = new Map();
    cache.set(workouts, byGoal);
  }
  const hit = byGoal.get(goal);
  if (hit) return hit;
  const finished = workouts.filter((w) => w.endedAt).sort((a, b) => a.startedAt - b.startedAt);
  const base = fuelPerWorkout(goal);
  const events = finished.map((w, i) => ({
    at: w.endedAt ?? w.startedAt,
    fuel: base * effortFactor(w, finished.slice(Math.max(0, i - BASELINE_SESSIONS), i)),
  }));
  byGoal.set(goal, events);
  return events;
}

/** Fuel a workout in progress has added so far (grows with every completed set). */
export function liveFuel(active: Workout | null, workouts: Workout[], goal: number, at: number): FuelEvent | null {
  if (!active || workoutSetCount(active) === 0) return null;
  const finished = workouts.filter((w) => w.endedAt).sort((a, b) => a.startedAt - b.startedAt);
  // Effort is measured on the sets done so far, so the flame grows set by set.
  return { at, fuel: fuelPerWorkout(goal) * effortFactor(active, finished) };
}

/** Raw (unclamped) momentum at time t. */
export function momentumAt(events: FuelEvent[], t: number): number {
  let level = 0;
  for (const e of events) {
    if (e.at > t) continue;
    const age = (t - e.at) / DAY;
    if (age > TAU_DAYS * 8) continue;
    level += e.fuel * Math.exp(-age / TAU_DAYS);
  }
  return level;
}

export const clampLevel = (raw: number) => Math.max(0, Math.min(100, raw));

export interface FireStage {
  min: number;
  label: string;
  blurb: string;
}

export const FIRE_STAGES: FireStage[] = [
  { min: 0, label: 'Embers', blurb: 'Barely glowing — one session rekindles it.' },
  { min: 8, label: 'Kindling', blurb: 'A spark is there. Feed it.' },
  { min: 30, label: 'Burning', blurb: 'Steady flame. Keep the rhythm.' },
  { min: 55, label: 'On fire', blurb: 'Strong momentum — you are on track.' },
  { min: 82, label: 'Inferno', blurb: 'Maximum heat. Unstoppable.' },
];

export const fireStage = (level: number) => [...FIRE_STAGES].reverse().find((s) => level >= s.min) ?? FIRE_STAGES[0];

/** Level each day (end of day) for the last `days` days — for the history chart. */
export function momentumHistory(
  events: FuelEvent[],
  days: number,
  now = Date.now(),
): { date: number; value: number }[] {
  const today = startOfDay(now);
  const out: { date: number; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const t = i === 0 ? now : day + DAY - 1;
    out.push({ date: day, value: Math.round(clampLevel(momentumAt(events, t))) });
  }
  return out;
}

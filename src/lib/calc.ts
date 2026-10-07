import type { WorkoutSet } from '../types';
import { round } from './utils';

/**
 * Estimated one-rep max via the Epley formula: 1RM = w × (1 + r / 30).
 * A single rep *is* the 1RM, so r = 1 returns the weight itself.
 */
export function estimate1RM(weight: number | null, reps: number | null): number {
  if (!weight || !reps || reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Inverse Epley: the weight you could move for `reps` given a 1RM. */
export function weightForReps(oneRepMax: number, reps: number): number {
  if (reps <= 1) return oneRepMax;
  return oneRepMax / (1 + reps / 30);
}

export function setVolume(set: Pick<WorkoutSet, 'weight' | 'reps'>): number {
  return (set.weight ?? 0) * (set.reps ?? 0);
}

// ---------------------------------------------------------------------------
// Plate math
// ---------------------------------------------------------------------------

export const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
export const LB_PLATES = [45, 35, 25, 10, 5, 2.5] as const;
export const DEFAULT_KG_PLATES = [20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_LB_PLATES = [45, 35, 25, 10, 5, 2.5];

export interface PlateCount {
  plate: number;
  count: number;
}

export interface PlateResult {
  /** Plates for ONE side, heaviest first. */
  perSide: PlateCount[];
  /** Same as perSide, flattened from the collar inward → outward. */
  stack: number[];
  achieved: number;
  /** target − achieved; > 0 when the exact weight isn't loadable. */
  remainder: number;
  belowBar: boolean;
}

/**
 * Greedy per-side breakdown. Works in integer milli-units so that
 * 1.25 kg / 2.5 lb plates never accumulate floating-point drift.
 */
export function calculatePlates(target: number, bar: number, available: readonly number[]): PlateResult {
  if (!(target > bar)) {
    return { perSide: [], stack: [], achieved: bar, remainder: 0, belowBar: target < bar };
  }
  const SCALE = 1000;
  let remaining = Math.round(((target - bar) / 2) * SCALE);
  const perSide: PlateCount[] = [];
  for (const plate of [...available].sort((a, b) => b - a)) {
    const p = Math.round(plate * SCALE);
    if (p <= 0) continue;
    const count = Math.floor(remaining / p);
    if (count > 0) {
      perSide.push({ plate, count });
      remaining -= count * p;
    }
  }
  const perSideTotal = perSide.reduce((acc, { plate, count }) => acc + plate * count, 0);
  const achieved = round(bar + perSideTotal * 2, 3);
  return {
    perSide,
    stack: perSide.flatMap(({ plate, count }) => Array<number>(count).fill(plate)),
    achieved,
    remainder: round(target - achieved, 3),
    belowBar: false,
  };
}

/** Smallest total jump that available plates allow (one pair of the smallest plate). */
export function smallestIncrement(available: readonly number[]): number {
  const min = Math.min(...available.filter((p) => p > 0));
  return Number.isFinite(min) ? min * 2 : 0;
}

// ---------------------------------------------------------------------------
// Warm-ups
// ---------------------------------------------------------------------------

export interface WarmupScheme {
  id: 'standard' | 'heavy' | 'quick';
  label: string;
  description: string;
  emptyBar?: boolean;
  steps: { pct: number; reps: number }[];
}

export const WARMUP_SCHEMES: WarmupScheme[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: '3 ramp-up sets for most working sets.',
    steps: [
      { pct: 0.4, reps: 10 },
      { pct: 0.6, reps: 5 },
      { pct: 0.8, reps: 3 },
    ],
  },
  {
    id: 'heavy',
    label: 'Heavy',
    description: 'Longer ramp for near-max singles and triples.',
    emptyBar: true,
    steps: [
      { pct: 0.4, reps: 5 },
      { pct: 0.55, reps: 4 },
      { pct: 0.7, reps: 3 },
      { pct: 0.8, reps: 2 },
      { pct: 0.9, reps: 1 },
    ],
  },
  {
    id: 'quick',
    label: 'Quick',
    description: '2 sets when you are already warm.',
    steps: [
      { pct: 0.5, reps: 8 },
      { pct: 0.75, reps: 3 },
    ],
  },
];

export interface WarmupSet {
  pct: number;
  reps: number;
  weight: number;
}

export interface WarmupOptions {
  /** Lightest loadable weight (the bar for barbell lifts). */
  minWeight?: number;
  /** Rounding increment for loadable weights. */
  increment: number;
}

export function generateWarmups(working: number, scheme: WarmupScheme, opts: WarmupOptions): WarmupSet[] {
  const { minWeight = 0, increment } = opts;
  if (!(working > 0)) return [];
  const out: WarmupSet[] = [];
  const push = (pct: number, reps: number, raw: number) => {
    let weight = increment > 0 ? Math.round(raw / increment) * increment : raw;
    weight = round(Math.max(minWeight, weight), 3);
    if (weight >= working) return;
    const prev = out[out.length - 1];
    if (prev && weight <= prev.weight) return;
    out.push({ pct, reps, weight });
  };
  if (scheme.emptyBar && minWeight > 0) push(minWeight / working, 10, minWeight);
  for (const step of scheme.steps) push(step.pct, step.reps, working * step.pct);
  return out;
}

import { describe, expect, it } from 'vitest';
import {
  calculatePlates,
  DEFAULT_KG_PLATES,
  DEFAULT_LB_PLATES,
  estimate1RM,
  generateWarmups,
  smallestIncrement,
  WARMUP_SCHEMES,
  weightForReps,
} from './calc';

describe('estimate1RM (Epley)', () => {
  it('applies w × (1 + r/30)', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.667, 3);
    expect(estimate1RM(100, 10)).toBeCloseTo(133.333, 3);
  });
  it('treats a single as the true 1RM', () => {
    expect(estimate1RM(140, 1)).toBe(140);
  });
  it('returns 0 for missing or invalid input', () => {
    expect(estimate1RM(null, 5)).toBe(0);
    expect(estimate1RM(100, 0)).toBe(0);
    expect(estimate1RM(0, 10)).toBe(0);
  });
  it('inverts cleanly', () => {
    const orm = estimate1RM(100, 8);
    expect(weightForReps(orm, 8)).toBeCloseTo(100, 6);
  });
});

describe('calculatePlates', () => {
  it('breaks 140 kg on a 20 kg bar into per-side plates', () => {
    const r = calculatePlates(140, 20, DEFAULT_KG_PLATES);
    expect(r.perSide).toEqual([{ plate: 20, count: 3 }]);
    expect(r.achieved).toBe(140);
    expect(r.remainder).toBe(0);
  });

  it('handles fractional plates without float drift', () => {
    const r = calculatePlates(102.5, 20, DEFAULT_KG_PLATES);
    // 41.25 per side = 20 + 20 + 1.25
    expect(r.perSide).toEqual([
      { plate: 20, count: 2 },
      { plate: 1.25, count: 1 },
    ]);
    expect(r.stack).toEqual([20, 20, 1.25]);
    expect(r.remainder).toBe(0);
  });

  it('supports pounds with a 45 lb bar', () => {
    const r = calculatePlates(315, 45, DEFAULT_LB_PLATES);
    expect(r.perSide).toEqual([{ plate: 45, count: 3 }]);
    const r2 = calculatePlates(185, 45, DEFAULT_LB_PLATES);
    // 70 per side = 45 + 25
    expect(r2.perSide).toEqual([
      { plate: 45, count: 1 },
      { plate: 25, count: 1 },
    ]);
  });

  it('reports the closest loadable weight when exact is impossible', () => {
    const r = calculatePlates(101, 20, DEFAULT_KG_PLATES);
    expect(r.achieved).toBe(100);
    expect(r.remainder).toBe(1);
  });

  it('flags targets lighter than the bar', () => {
    const r = calculatePlates(15, 20, DEFAULT_KG_PLATES);
    expect(r.belowBar).toBe(true);
    expect(r.perSide).toEqual([]);
  });

  it('respects plate availability (women’s 15 kg bar, no 20s)', () => {
    const r = calculatePlates(75, 15, [15, 10, 5, 2.5, 1.25]);
    // 30 per side = 15 + 15
    expect(r.perSide).toEqual([{ plate: 15, count: 2 }]);
  });
});

describe('smallestIncrement', () => {
  it('is one pair of the smallest plate', () => {
    expect(smallestIncrement(DEFAULT_KG_PLATES)).toBe(2.5);
    expect(smallestIncrement(DEFAULT_LB_PLATES)).toBe(5);
  });
});

describe('generateWarmups', () => {
  const standard = WARMUP_SCHEMES.find((s) => s.id === 'standard')!;
  const heavy = WARMUP_SCHEMES.find((s) => s.id === 'heavy')!;

  it('produces 40/60/80% ramp rounded to loadable weights', () => {
    const sets = generateWarmups(100, standard, { minWeight: 20, increment: 2.5 });
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([
      [40, 10],
      [60, 5],
      [80, 3],
    ]);
  });

  it('never goes below the bar or reaches the working weight', () => {
    const sets = generateWarmups(40, standard, { minWeight: 20, increment: 2.5 });
    expect(sets.every((s) => s.weight >= 20 && s.weight < 40)).toBe(true);
    // 40% (16) clamps to the bar; 60% (24) rounds to 25; 80% (32) to 32.5.
    expect(sets.map((s) => s.weight)).toEqual([20, 25, 32.5]);
  });

  it('deduplicates steps that round to the same weight', () => {
    const sets = generateWarmups(30, standard, { minWeight: 20, increment: 2.5 });
    // 12 and 18 both clamp to 20; 24 rounds to 25.
    expect(sets.map((s) => s.weight)).toEqual([20, 25]);
  });

  it('starts heavy schemes with the empty bar', () => {
    const sets = generateWarmups(200, heavy, { minWeight: 20, increment: 2.5 });
    expect(sets[0]).toMatchObject({ weight: 20, reps: 10 });
    expect(sets[sets.length - 1].weight).toBe(180);
  });

  it('returns nothing without a working weight', () => {
    expect(generateWarmups(0, standard, { increment: 2.5 })).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import type { BodyMeasurement } from '../types';
import { measurementDelta, measurementSeries, niceTicks } from './analytics';

describe('niceTicks', () => {
  it('produces round steps from zero', () => {
    expect(niceTicks(2513)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(180)).toEqual([0, 50, 100, 150, 200]);
    expect(niceTicks(9)).toEqual([0, 2.5, 5, 7.5, 10]);
  });
  it('handles empty data', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe('body measurement trend', () => {
  const day = 86_400_000;
  const entries: BodyMeasurement[] = [80, 81, 79, 80.5].map((w, i) => ({
    id: String(i),
    date: (i + 1) * 10 * day,
    values: { weight: w },
  }));

  it('smooths with an exponential moving average', () => {
    const s = measurementSeries(entries, 'weight', 0.5);
    expect(s.map((p) => p.trend)).toEqual([80, 80.5, 79.75, 80.125]);
  });

  it('computes the 30-day delta from the latest entry', () => {
    // latest 80.5 (day 40) vs. closest entry on/before day 10 → 80
    expect(measurementDelta(entries, 'weight', 30)).toBeCloseTo(0.5);
  });
});

describe('niceRangeTicks', () => {
  it('spans the data with round steps', async () => {
    const { niceRangeTicks } = await import('./analytics');
    expect(niceRangeTicks(116.7, 119.6)).toEqual([116, 117, 118, 119, 120]);
    expect(niceRangeTicks(80, 95)).toEqual([80, 85, 90, 95]);
  });
});

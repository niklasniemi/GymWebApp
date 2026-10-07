import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet } from '../types';
import { addDays, startOfWeek } from './format';
import { goalStatus, streakReminder } from './goals';
import { clampLevel, effortFactor, fireStage, fuelEvents, momentumAt } from './momentum';

const sets = (n: number, weight = 100): WorkoutSet[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    type: 'normal',
    weight,
    reps: 5,
    rpe: null,
    rir: null,
    completed: true,
  }));

let id = 0;
const workout = (at: number, nSets = 15, weight = 100): Workout => ({
  id: `w${++id}`,
  name: 'w',
  startedAt: at,
  endedAt: at + 3_600_000,
  exercises: [{ id: 'e', exerciseId: 'bench-press', sets: sets(nSets, weight) }],
});

// A Wednesday noon, so the week has started and has days left.
const WED = new Date(2026, 9, 7, 12).getTime();
const MON = startOfWeek(WED);
const at = (weekOffset: number, day: number) => addDays(MON, weekOffset * 7 + day) + 18 * 3_600_000;

describe('goal streaks', () => {
  it('counts only weeks that met the goal', () => {
    const ws = [
      // 3 weeks ago: 3 (met) · 2 weeks ago: 3 (met) · last week: 3 (met)
      ...[0, 2, 4].map((d) => workout(at(-3, d))),
      ...[0, 2, 4].map((d) => workout(at(-2, d))),
      ...[1, 3, 5].map((d) => workout(at(-1, d))),
      // this week: 1 so far
      workout(at(0, 0)),
    ];
    const s = goalStatus(ws, 3, WED);
    expect(s.thisWeek).toBe(1);
    expect(s.remaining).toBe(2);
    expect(s.streak).toBe(3); // current week still in play
    expect(s.daysLeft).toBe(5); // Wed..Sun
  });

  it('breaks when a past week missed the goal, and adds the current week once met', () => {
    const ws = [
      ...[0, 2, 4].map((d) => workout(at(-2, d))),
      ...[0, 2].map((d) => workout(at(-1, d))), // missed: 2/3
      ...[0, 1, 2].map((d) => workout(at(0, d))),
    ];
    expect(goalStatus(ws, 3, WED).streak).toBe(1);
  });

  it('warns when the week ends within two days and the goal is open', () => {
    const SAT = addDays(MON, 5) + 12 * 3_600_000;
    const ws = [...[0, 2, 4].map((d) => workout(at(-1, d))), workout(at(0, 1))];
    const s = goalStatus(ws, 3, SAT);
    expect(s.atRisk).toBe(true);
    expect(s.daysLeft).toBe(2);
    expect(streakReminder(s)?.title).toBe('Your 1-week streak ends in 2 days');
  });
});

describe('momentum', () => {
  it('stays near the top when training exactly to goal with typical sessions', () => {
    const ws = [];
    for (let week = -6; week <= 0; week++) for (const d of [0, 2, 4]) ws.push(workout(at(week, d)));
    const events = fuelEvents(ws, 3);
    // Friday evening right after the 3rd session, and Monday morning before the next.
    const peak = clampLevel(momentumAt(events, at(0, 4) + 7_200_000));
    const trough = clampLevel(momentumAt(events, addDays(MON, 7) + 3_600_000));
    expect(peak).toBeGreaterThan(90);
    expect(trough).toBeGreaterThan(60);
  });

  it('decays when training stops', () => {
    const ws = [0, 2, 4].map((d) => workout(at(-3, d)));
    const events = fuelEvents(ws, 3);
    const after = momentumAt(events, at(-3, 4) + 3_600_000);
    const later = momentumAt(events, at(-1, 4));
    expect(later).toBeLessThan(after * 0.1);
    expect(fireStage(clampLevel(later)).label).toBe('Embers');
  });

  it('rewards heavier-than-usual sessions and discounts light ones', () => {
    const prev = [0, 1, 2, 3].map((d) => workout(at(-1, d), 15, 100));
    expect(effortFactor(workout(at(0, 0), 30, 120), prev)).toBeGreaterThan(1.3);
    expect(effortFactor(workout(at(0, 0), 6, 60), prev)).toBeLessThan(0.8);
    expect(effortFactor(workout(at(0, 0), 15, 100), prev)).toBeCloseTo(1, 1);
  });

  it('scales fuel to the weekly goal', () => {
    const one = fuelEvents([workout(at(0, 0))], 1)[0].fuel;
    const five = fuelEvents([workout(at(0, 0))], 5)[0].fuel;
    expect(one / five).toBeCloseTo(5, 5);
  });
});

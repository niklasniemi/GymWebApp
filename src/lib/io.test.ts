import { describe, expect, it } from 'vitest';
import { BUILTIN_EXERCISES } from '../data/exercises';
import type { Exercise, Workout } from '../types';
import { createBackup, ImportError, parseBackup, parseCSV, workoutsFromCSV, workoutsToCSV } from './io';

const custom: Exercise = {
  id: 'custom-1',
  name: 'Landmine Press, "Kneeling"',
  primaryMuscle: 'shoulders',
  secondaryMuscles: [],
  equipment: 'barbell',
  custom: true,
  createdAt: 1,
};

const workout: Workout = {
  id: 'w1',
  name: 'Push, heavy',
  startedAt: Date.UTC(2026, 0, 5, 17),
  endedAt: Date.UTC(2026, 0, 5, 18),
  notes: 'Felt strong\nslept well',
  exercises: [
    {
      id: 'we1',
      exerciseId: 'bench-press',
      sets: [
        { id: 'a', type: 'warmup', weight: 60, reps: 10, rpe: null, rir: null, completed: true },
        {
          id: 'b',
          type: 'normal',
          weight: 102.5,
          reps: 5,
          rpe: 8.5,
          rir: null,
          completed: true,
          prs: ['weight', 'e1rm'],
        },
      ],
    },
    {
      id: 'we2',
      exerciseId: 'custom-1',
      sets: [{ id: 'c', type: 'normal', weight: 30, reps: 12, rpe: null, rir: 2, completed: true }],
    },
  ],
};

describe('parseCSV', () => {
  it('handles quotes, escaped quotes, commas and newlines', () => {
    const rows = parseCSV('a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'he said "hi"', 'line1\nline2'],
    ]);
  });
});

describe('CSV round trip', () => {
  const map = new Map([...BUILTIN_EXERCISES, custom].map((e) => [e.id, e]));

  it('exports one row per set and re-imports the same structure', () => {
    const csv = workoutsToCSV([workout], map);
    // Header + 3 sets; the embedded \n in the notes stays inside its quoted cell.
    expect(parseCSV(csv)).toHaveLength(1 + 3);
    const data = workoutsFromCSV(csv, [custom]);
    expect(data.workouts).toHaveLength(1);
    const w = data.workouts[0];
    expect(w.name).toBe('Push, heavy');
    expect(w.notes).toBe('Felt strong\nslept well');
    expect(w.exercises.map((e) => e.exerciseId)).toEqual(['bench-press', 'custom-1']);
    expect(w.exercises[0].sets.map((s) => [s.type, s.weight, s.reps, s.rpe])).toEqual([
      ['warmup', 60, 10, null],
      ['normal', 102.5, 5, 8.5],
    ]);
    expect(w.exercises[0].sets[1].prs).toEqual(['weight', 'e1rm']);
    expect(data.exercises).toHaveLength(0);
  });

  it('recreates unknown exercises as custom ones', () => {
    const csv = workoutsToCSV([workout], map);
    const data = workoutsFromCSV(csv, []);
    expect(data.exercises).toHaveLength(1);
    expect(data.exercises[0]).toMatchObject({ name: custom.name, primaryMuscle: 'shoulders', custom: true });
    expect(data.workouts[0].exercises[1].exerciseId).toBe(data.exercises[0].id);
  });

  it('rejects files without the required columns', () => {
    expect(() => workoutsFromCSV('foo,bar\n1,2', [])).toThrow(ImportError);
  });
});

describe('JSON backup', () => {
  it('round-trips and sanitizes', () => {
    const backup = createBackup(
      { exercises: [custom], routines: [], workouts: [workout], measurements: [] },
      {
        theme: 'dark',
        glass: true,
        autoPowerSaver: true,
        unit: 'kg',
        defaultRest: 90,
        autoStartRest: true,
        effortMetric: 'rpe',
        haptics: true,
        sound: true,
        keepAwake: true,
      },
    );
    const { data, settings } = parseBackup(JSON.stringify(backup));
    expect(data.workouts[0]).toEqual(workout);
    expect(data.exercises[0].name).toBe(custom.name);
    expect(settings?.theme).toBe('dark');
  });

  it('drops malformed records instead of failing', () => {
    const { data } = parseBackup(
      JSON.stringify({
        app: 'forge',
        workouts: [{ id: 'ok', startedAt: 1, exercises: [] }, { nope: true }, 'garbage'],
        measurements: [{ id: 'm', date: 1, values: { weight: 80, bogus: 5, bodyFat: -2 } }],
      }),
    );
    expect(data.workouts.map((w) => w.id)).toEqual(['ok']);
    expect(data.measurements[0].values).toEqual({ weight: 80 });
  });

  it('rejects non-backup JSON', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow(ImportError);
    expect(() => parseBackup('not json')).toThrow(ImportError);
  });
});

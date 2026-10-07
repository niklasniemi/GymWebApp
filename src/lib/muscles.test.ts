import { describe, expect, it } from 'vitest';
import { BUILTIN_MUSCLE_MAP, exerciseMuscles, MUSCLES } from '../data/anatomy';
import { BUILTIN_EXERCISES } from '../data/exercises';
import type { Exercise, Workout } from '../types';
import { heatColor, routineMuscleLoad, toHeat, workoutsMuscleLoad } from './muscles';
import { buildAdjacency, classifyVertex, vertexHeat } from '../components/body/bodyRig';
import { parseSegments } from '../store/ui';

const exMap = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));

describe('anatomy mapping', () => {
  it('maps every built-in exercise to valid muscles', () => {
    for (const ex of BUILTIN_EXERCISES) {
      expect(BUILTIN_MUSCLE_MAP[ex.id], ex.id).toBeDefined();
      const { primary, secondary } = exerciseMuscles(ex);
      expect(primary.length, ex.id).toBeGreaterThan(0);
      for (const m of [...primary, ...secondary]) expect(MUSCLES).toContain(m);
    }
  });

  it('derives targets for custom exercises from their groups', () => {
    const custom: Exercise = {
      id: 'custom-x',
      name: 'Landmine Row',
      primaryMuscle: 'back',
      secondaryMuscles: ['arms'],
      equipment: 'barbell',
      custom: true,
      createdAt: 0,
    };
    expect(exerciseMuscles(custom)).toEqual({ primary: ['lats'], secondary: ['biceps', 'triceps'] });
  });
});

describe('muscle load', () => {
  it('credits primary movers fully and assisting muscles by half', () => {
    const load = routineMuscleLoad({ exercises: [{ id: 'a', exerciseId: 'bench-press', sets: 4, reps: '5' }] }, exMap);
    expect(load.chest).toBe(4);
    expect(load.triceps).toBe(2);
    expect(load.shoulders).toBe(2);
    expect(load.quads).toBe(0);
  });

  it('counts only completed working sets from workouts', () => {
    const w: Workout = {
      id: 'w',
      name: 'w',
      startedAt: 0,
      endedAt: 1,
      exercises: [
        {
          id: 'e',
          exerciseId: 'squat',
          sets: [
            { id: '1', type: 'warmup', weight: 60, reps: 5, rpe: null, rir: null, completed: true },
            { id: '2', type: 'normal', weight: 100, reps: 5, rpe: null, rir: null, completed: true },
            { id: '3', type: 'normal', weight: 100, reps: 5, rpe: null, rir: null, completed: false },
          ],
        },
      ],
    };
    const load = workoutsMuscleLoad([w], exMap);
    expect(load.quads).toBe(1);
    expect(load.glutes).toBe(1);
    expect(load.hamstrings).toBe(0.5);
  });

  it('normalises heat relative to the hottest muscle, with a floor', () => {
    const load = routineMuscleLoad({ exercises: [{ id: 'a', exerciseId: 'db-curl', sets: 2, reps: '10' }] }, exMap);
    expect(toHeat(load).biceps).toBe(1);
    expect(toHeat(load, 10).biceps).toBeCloseTo(0.2);
  });

  it('keeps untrained muscles neutral and heats trained ones', () => {
    expect(heatColor(0, '#123456')).toBe('#123456');
    expect(heatColor(1, '#123456')).toBe('#b91c1c');
    expect(heatColor(0.5, '#123456')).not.toBe('#123456');
  });
});

describe('body rig classification (normalised A-pose coordinates)', () => {
  const front = [0, 0, 1] as const;
  const back = [0, 0, -1] as const;
  it.each([
    ['chest', [0.05, 0.75, 0.09], front],
    ['lats', [0.05, 0.72, -0.09], back],
    ['abs', [0.02, 0.6, 0.08], front],
    ['lowerBack', [0.02, 0.58, -0.08], back],
    ['glutes', [0.06, 0.48, -0.09], back],
    ['quads', [0.08, 0.36, 0.06], front],
    ['hamstrings', [0.08, 0.36, -0.06], back],
    ['calves', [0.08, 0.18, -0.05], back],
    ['forearms', [0.28, 0.65, -0.03], front],
    ['traps', [0.04, 0.83, -0.06], back],
  ] as const)('%s', (muscle, [x, y, z], [nx, ny, nz]) => {
    expect(classifyVertex(x, y, z, nx, ny, nz)).toBe(muscle);
  });

  it('leaves head, hands and feet neutral', () => {
    expect(classifyVertex(0, 0.95, 0.05, 0, 0, 1)).toBeNull();
    expect(classifyVertex(0.4, 0.57, -0.03, 0, 0, 1)).toBeNull();
    expect(classifyVertex(0.09, 0.02, 0.08, 0, 0, 1)).toBeNull();
  });

  it('separates biceps (front) from triceps (back) on the upper arm', () => {
    expect(classifyVertex(0.17, 0.72, 0.0, 0, 0, 1)).toBe('biceps');
    expect(classifyVertex(0.17, 0.72, -0.06, 0, 0, -1)).toBe('triceps');
  });
});

describe('vertex heat smoothing', () => {
  it('blurs heat into neighbours without exceeding the source', () => {
    // A strip of 4 vertices: 0-1-2-3, only vertex 0 is "chest".
    const adjacency = buildAdjacency([0, 1, 2, 1, 2, 3], 4);
    const ids = new Uint8Array([MUSCLES.indexOf('chest') + 1, 0, 0, 0]);
    const heat = MUSCLES.map((m) => (m === 'chest' ? 1 : 0));
    const out = vertexHeat(ids, heat, adjacency, new Float32Array(4), 1);
    expect(out[0]).toBeGreaterThan(out[1]);
    expect(out[1]).toBeGreaterThan(0);
    expect(Math.max(...out)).toBeLessThanOrEqual(1);
  });
});

describe('router', () => {
  it('parses tab, sub-route and encoded params', () => {
    expect(parseSegments('#/analytics/strength/bench-press')).toEqual(['analytics', 'strength', 'bench-press']);
    expect(parseSegments('#/routines/exercises?x=1')).toEqual(['routines', 'exercises']);
    expect(parseSegments('#/analytics/strength/custom%2Fa')).toEqual(['analytics', 'strength', 'custom/a']);
    expect(parseSegments('')).toEqual([]);
  });
});

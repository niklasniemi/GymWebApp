import { SAMPLE_ROUTINES } from '../data/exercises';
import type { Routine, Workout } from '../types';
import { uid } from './utils';

/** Turns a finished workout into a reusable routine template. */
export function routineFromWorkout(workout: Workout, order: number): Routine {
  const now = Date.now();
  return {
    id: uid(),
    name: workout.name,
    order,
    createdAt: now,
    updatedAt: now,
    exercises: workout.exercises.map((we) => {
      const working = we.sets.filter((s) => s.type !== 'warmup');
      const reps = working.map((s) => s.reps ?? 0).filter((r) => r > 0);
      const min = Math.min(...reps);
      const max = Math.max(...reps);
      return {
        id: uid(),
        exerciseId: we.exerciseId,
        sets: Math.max(1, working.length),
        reps: we.targetReps ?? (reps.length ? (min === max ? String(min) : `${min}-${max}`) : '8-12'),
        restSeconds: we.restSeconds,
      };
    }),
  };
}

export function sampleRoutines(startOrder: number): Routine[] {
  const now = Date.now();
  return SAMPLE_ROUTINES.map((r, i) => ({
    id: uid(),
    name: r.name,
    notes: r.notes,
    order: startOrder + i,
    createdAt: now,
    updatedAt: now,
    exercises: r.exercises.map(([exerciseId, sets, reps, restSeconds]) => ({
      id: uid(),
      exerciseId,
      sets,
      reps,
      restSeconds,
    })),
  }));
}

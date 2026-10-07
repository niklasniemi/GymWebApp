import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { computeWorkoutPRs, getHistoryIndex, inSessionHints, lastSession, matchPreviousSets } from '../lib/history';
import { workoutNameForTime } from '../lib/format';
import { uid } from '../lib/utils';
import type { PRType, Routine, SetType, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { SET_TYPES } from '../types';
import { useData } from './data';
import { createDebouncedStorage } from './storage';

export type SetPatch = Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rpe' | 'rir' | 'type'>>;

export type ToggleResult =
  { status: 'completed'; set: WorkoutSet } | { status: 'uncompleted'; set: WorkoutSet } | { status: 'missing-reps' };

interface StartOptions {
  routine?: Routine;
  /** Repeat the structure of a past workout. */
  template?: Workout;
  name?: string;
}

interface ActiveWorkoutState {
  workout: Workout | null;
  start: (opts?: StartOptions) => void;
  rename: (name: string) => void;
  setNotes: (notes: string) => void;
  addExercises: (exerciseIds: string[]) => void;
  removeExercise: (weId: string) => void;
  moveExercise: (weId: string, dir: -1 | 1) => void;
  replaceExercise: (weId: string, exerciseId: string) => void;
  setRest: (weId: string, seconds: number) => void;
  setExerciseNotes: (weId: string, notes: string) => void;
  addSet: (weId: string) => string | undefined;
  addWarmups: (weId: string, sets: { weight: number; reps: number }[]) => void;
  updateSet: (weId: string, setId: string, patch: SetPatch) => void;
  cycleSetType: (weId: string, setId: string) => void;
  removeSet: (weId: string, setId: string) => void;
  /** Re-inserts a set (undo for delete). */
  insertSet: (weId: string, set: WorkoutSet, index: number) => void;
  toggleSet: (weId: string, setId: string) => ToggleResult;
  /** Persists completed sets to history and clears the session. */
  finish: () => Workout | null;
  discard: () => void;
}

export const newSet = (
  type: SetType = 'normal',
  weight: number | null = null,
  reps: number | null = null,
): WorkoutSet => ({
  id: uid(),
  type,
  weight,
  reps,
  rpe: null,
  rir: null,
  completed: false,
});

function history() {
  return getHistoryIndex(useData.getState().workouts);
}

/** New exercise entry, mirroring the previous session's set structure. */
function createEntry(exerciseId: string, opts: { sets?: number; reps?: string; rest?: number } = {}): WorkoutExercise {
  const last = lastSession(history(), exerciseId);
  let sets: WorkoutSet[];
  if (opts.sets) {
    sets = Array.from({ length: opts.sets }, () => newSet());
  } else if (last) {
    sets = last.sets.map((s) => newSet(s.type));
  } else {
    sets = [newSet(), newSet(), newSet()];
  }
  return { id: uid(), exerciseId, sets, restSeconds: opts.rest, targetReps: opts.reps };
}

type Updater = (we: WorkoutExercise) => WorkoutExercise;

export const useActiveWorkout = create<ActiveWorkoutState>()(
  persist(
    (set, get) => {
      /** Immutable update of one exercise, preserving every other reference for memoization. */
      const updateExercise = (weId: string, fn: Updater) => {
        const w = get().workout;
        if (!w) return;
        let changed = false;
        const exercises = w.exercises.map((we) => {
          if (we.id !== weId) return we;
          changed = true;
          return fn(we);
        });
        if (changed) set({ workout: { ...w, exercises } });
      };

      const updateSetIn = (weId: string, setId: string, fn: (s: WorkoutSet) => WorkoutSet) =>
        updateExercise(weId, (we) => ({ ...we, sets: we.sets.map((s) => (s.id === setId ? fn(s) : s)) }));

      return {
        workout: null,

        start: (opts = {}) => {
          const now = Date.now();
          let exercises: WorkoutExercise[] = [];
          if (opts.routine) {
            exercises = opts.routine.exercises.map((re) =>
              createEntry(re.exerciseId, { sets: re.sets, reps: re.reps, rest: re.restSeconds }),
            );
            useData.getState().saveRoutine({ ...opts.routine, lastUsedAt: now });
          } else if (opts.template) {
            exercises = opts.template.exercises.map((we) => ({
              id: uid(),
              exerciseId: we.exerciseId,
              restSeconds: we.restSeconds,
              targetReps: we.targetReps,
              sets: we.sets.map((s) => newSet(s.type)),
            }));
          }
          set({
            workout: {
              id: uid(),
              name: opts.name ?? opts.routine?.name ?? opts.template?.name ?? workoutNameForTime(now),
              routineId: opts.routine?.id ?? opts.template?.routineId,
              startedAt: now,
              exercises,
            },
          });
        },

        rename: (name) => {
          const w = get().workout;
          if (w) set({ workout: { ...w, name } });
        },

        setNotes: (notes) => {
          const w = get().workout;
          if (w) set({ workout: { ...w, notes } });
        },

        addExercises: (ids) => {
          const w = get().workout;
          if (!w) return;
          set({ workout: { ...w, exercises: [...w.exercises, ...ids.map((id) => createEntry(id))] } });
        },

        removeExercise: (weId) => {
          const w = get().workout;
          if (w) set({ workout: { ...w, exercises: w.exercises.filter((we) => we.id !== weId) } });
        },

        moveExercise: (weId, dir) => {
          const w = get().workout;
          if (!w) return;
          const i = w.exercises.findIndex((we) => we.id === weId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= w.exercises.length) return;
          const exercises = w.exercises.slice();
          [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
          set({ workout: { ...w, exercises } });
        },

        replaceExercise: (weId, exerciseId) =>
          updateExercise(weId, (we) => ({
            ...createEntry(exerciseId, { sets: we.sets.length, reps: we.targetReps, rest: we.restSeconds }),
            id: we.id,
          })),

        setRest: (weId, seconds) => updateExercise(weId, (we) => ({ ...we, restSeconds: seconds })),

        setExerciseNotes: (weId, notes) => updateExercise(weId, (we) => ({ ...we, notes })),

        addSet: (weId) => {
          let id: string | undefined;
          updateExercise(weId, (we) => {
            const last = we.sets[we.sets.length - 1];
            const copy = last && last.type !== 'warmup';
            const s = newSet(
              copy && last.type !== 'drop' ? last.type : 'normal',
              copy ? last.weight : null,
              copy ? last.reps : null,
            );
            id = s.id;
            return { ...we, sets: [...we.sets, s] };
          });
          return id;
        },

        addWarmups: (weId, warmups) =>
          updateExercise(weId, (we) => ({
            ...we,
            sets: [
              ...warmups.map((w) => newSet('warmup', w.weight, w.reps)),
              ...we.sets.filter((s) => s.type !== 'warmup' || s.completed),
            ],
          })),

        updateSet: (weId, setId, patch) => updateSetIn(weId, setId, (s) => ({ ...s, ...patch })),

        cycleSetType: (weId, setId) =>
          updateSetIn(weId, setId, (s) => ({
            ...s,
            type: SET_TYPES[(SET_TYPES.indexOf(s.type) + 1) % SET_TYPES.length],
          })),

        removeSet: (weId, setId) =>
          updateExercise(weId, (we) => ({ ...we, sets: we.sets.filter((s) => s.id !== setId) })),

        insertSet: (weId, set, index) =>
          updateExercise(weId, (we) => {
            if (we.sets.some((s) => s.id === set.id)) return we;
            const sets = we.sets.slice();
            sets.splice(Math.min(index, sets.length), 0, set);
            return { ...we, sets };
          }),

        toggleSet: (weId, setId) => {
          const w = get().workout;
          const we = w?.exercises.find((x) => x.id === weId);
          const current = we?.sets.find((s) => s.id === setId);
          if (!w || !we || !current) return { status: 'missing-reps' };

          if (current.completed) {
            const next = { ...current, completed: false, completedAt: undefined };
            updateSetIn(weId, setId, () => next);
            return { status: 'uncompleted', set: next };
          }

          // Auto-fill blanks from last session so "just tap ✓" logs a repeat.
          const i = we.sets.indexOf(current);
          const prev =
            matchPreviousSets(we.sets, lastSession(history(), we.exerciseId)?.sets)[i] ?? inSessionHints(we.sets)[i];
          const weight = current.weight ?? prev?.weight ?? null;
          const reps = current.reps ?? prev?.reps ?? null;
          if (reps === null || reps <= 0) return { status: 'missing-reps' };

          const next: WorkoutSet = { ...current, weight, reps, completed: true, completedAt: Date.now() };
          updateSetIn(weId, setId, () => next);
          return { status: 'completed', set: next };
        },

        finish: () => {
          const w = get().workout;
          if (!w) return null;
          const prs = computeWorkoutPRs(w, history());
          const exercises = w.exercises
            .map((we) => ({
              ...we,
              sets: we.sets
                .filter((s) => s.completed)
                .map((s) => {
                  const p = prs.get(s.id);
                  return p ? { ...s, prs: p } : { ...s, prs: undefined };
                }),
            }))
            .filter((we) => we.sets.length > 0);
          if (!exercises.length) return null;
          const finished: Workout = { ...w, exercises, endedAt: Date.now() };
          useData.getState().saveWorkout(finished);
          set({ workout: null });
          return finished;
        },

        discard: () => set({ workout: null }),
      };
    },
    {
      name: 'forge:active-workout',
      version: 1,
      storage: createJSONStorage(() => createDebouncedStorage(250)),
      partialize: (s) => ({ workout: s.workout }),
    },
  ),
);

const prCache = new WeakMap<Workout, { index: ReturnType<typeof history>; prs: Map<string, PRType[]> }>();

/** PR map for the active workout, computed once per workout revision. */
export function getActivePRs(workout: Workout): Map<string, PRType[]> {
  const index = history();
  const hit = prCache.get(workout);
  if (hit && hit.index === index) return hit.prs;
  const prs = computeWorkoutPRs(workout, index);
  prCache.set(workout, { index, prs });
  return prs;
}

/**
 * Comma-joined PR types for one set ('' when none). Returning a primitive
 * means a set row only re-renders when its own PR status changes.
 */
export function useSetPRs(setId: string): string {
  return useActiveWorkout((s) => (s.workout ? (getActivePRs(s.workout).get(setId)?.join(',') ?? '') : ''));
}

import { create } from 'zustand';
import { BUILTIN_EXERCISES } from '../data/exercises';
import {
  emptySnapshot,
  openPersistence,
  requestPersistentStorage,
  type Persistence,
  type StorageKind,
  type TableName,
  type RowOf,
} from '../db/persistence';
import { getHistoryIndex } from '../lib/history';
import type { BodyMeasurement, DataSnapshot, Exercise, Routine, Workout } from '../types';
import { toast } from './toast';

export type ImportMode = 'merge' | 'replace';

interface DataState extends DataSnapshot {
  status: 'loading' | 'ready' | 'error';
  storage: StorageKind | null;
  persisted: boolean;
  init: () => Promise<void>;
  saveExercise: (e: Exercise) => void;
  /** Deletes a custom exercise, or archives it if history references it. */
  deleteExercise: (id: string) => 'deleted' | 'archived';
  saveRoutine: (r: Routine) => void;
  deleteRoutine: (id: string) => void;
  reorderRoutines: (ids: string[]) => void;
  saveWorkout: (w: Workout) => void;
  deleteWorkout: (id: string) => void;
  saveMeasurement: (m: BodyMeasurement) => void;
  deleteMeasurement: (id: string) => void;
  importData: (data: DataSnapshot, mode: ImportMode) => Promise<void>;
  clearAll: () => Promise<void>;
}

let db: Persistence | null = null;
let initPromise: Promise<void> | null = null;

const sortWorkouts = (w: Workout[]) => [...w].sort((a, b) => b.startedAt - a.startedAt);
const sortRoutines = (r: Routine[]) => [...r].sort((a, b) => a.order - b.order);
const sortMeasurements = (m: BodyMeasurement[]) => [...m].sort((a, b) => b.date - a.date);
const builtinIds = new Set(BUILTIN_EXERCISES.map((e) => e.id));
const withBuiltins = (custom: Exercise[]) => [...BUILTIN_EXERCISES, ...custom.filter((e) => !builtinIds.has(e.id))];

function onWriteError(err: unknown) {
  console.error('[forge] write failed', err);
  toast.error('Could not save', 'Your browser refused the write. Export a backup to be safe.');
}

function write<T extends TableName>(table: T, rows: RowOf<T>[]) {
  db?.put(table, rows).catch(onWriteError);
}

function remove(table: TableName, ids: string[]) {
  db?.remove(table, ids).catch(onWriteError);
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map(base.map((x) => [x.id, x]));
  for (const x of incoming) map.set(x.id, x);
  return [...map.values()];
}

export const useData = create<DataState>()((set, get) => ({
  ...emptySnapshot(),
  exercises: BUILTIN_EXERCISES,
  status: 'loading',
  storage: null,
  persisted: false,

  init: () => {
    initPromise ??= (async () => {
      try {
        db = await openPersistence();
        const snap = await db.load();
        set({
          exercises: withBuiltins(snap.exercises),
          routines: sortRoutines(snap.routines),
          workouts: sortWorkouts(snap.workouts),
          measurements: sortMeasurements(snap.measurements),
          storage: db.kind,
          status: 'ready',
        });
        requestPersistentStorage().then((persisted) => set({ persisted }));
      } catch (err) {
        console.error('[forge] failed to load data', err);
        set({ status: 'error' });
      }
    })();
    return initPromise;
  },

  saveExercise: (e) => {
    const exercise = { ...e, custom: true };
    set({ exercises: upsert(get().exercises, exercise) });
    write('exercises', [exercise]);
  },

  deleteExercise: (id) => {
    const used = get().workouts.some((w) => w.exercises.some((we) => we.exerciseId === id));
    // Routines can simply drop the exercise.
    const routines = get().routines.map((r) =>
      r.exercises.some((x) => x.exerciseId === id)
        ? { ...r, exercises: r.exercises.filter((x) => x.exerciseId !== id), updatedAt: Date.now() }
        : r,
    );
    const changedRoutines = routines.filter((r, i) => r !== get().routines[i]);
    if (changedRoutines.length) write('routines', changedRoutines);

    if (used) {
      const ex = get().exercises.find((x) => x.id === id);
      if (ex) {
        const archived = { ...ex, archived: true };
        set({ exercises: upsert(get().exercises, archived), routines });
        write('exercises', [archived]);
      }
      return 'archived';
    }
    set({ exercises: get().exercises.filter((x) => x.id !== id), routines });
    remove('exercises', [id]);
    return 'deleted';
  },

  saveRoutine: (r) => {
    set({ routines: sortRoutines(upsert(get().routines, r)) });
    write('routines', [r]);
  },

  deleteRoutine: (id) => {
    set({ routines: get().routines.filter((r) => r.id !== id) });
    remove('routines', [id]);
  },

  reorderRoutines: (ids) => {
    const byId = new Map(get().routines.map((r) => [r.id, r]));
    const next = ids
      .map((id, order) => {
        const r = byId.get(id);
        return r && r.order !== order ? { ...r, order } : r;
      })
      .filter((r): r is Routine => Boolean(r));
    const changed = next.filter((r) => r !== byId.get(r.id));
    set({ routines: next });
    write('routines', changed);
  },

  saveWorkout: (w) => {
    set({ workouts: sortWorkouts(upsert(get().workouts, w)) });
    write('workouts', [w]);
  },

  deleteWorkout: (id) => {
    set({ workouts: get().workouts.filter((w) => w.id !== id) });
    remove('workouts', [id]);
  },

  saveMeasurement: (m) => {
    set({ measurements: sortMeasurements(upsert(get().measurements, m)) });
    write('measurements', [m]);
  },

  deleteMeasurement: (id) => {
    set({ measurements: get().measurements.filter((m) => m.id !== id) });
    remove('measurements', [id]);
  },

  importData: async (data, mode) => {
    const current = get();
    const custom = (list: Exercise[]) => list.filter((e) => e.custom && !builtinIds.has(e.id));
    const next: DataSnapshot =
      mode === 'replace'
        ? { ...data, exercises: custom(data.exercises) }
        : {
            exercises: mergeById(custom(current.exercises), custom(data.exercises)),
            routines: mergeById(current.routines, data.routines),
            workouts: mergeById(current.workouts, data.workouts),
            measurements: mergeById(current.measurements, data.measurements),
          };
    await db?.replace(next);
    set({
      exercises: withBuiltins(next.exercises),
      routines: sortRoutines(next.routines),
      workouts: sortWorkouts(next.workouts),
      measurements: sortMeasurements(next.measurements),
    });
  },

  clearAll: async () => {
    await db?.replace(emptySnapshot());
    set({ ...emptySnapshot(), exercises: BUILTIN_EXERCISES });
  },
}));

// ---------------------------------------------------------------------------
// Derived selectors (memoized on array identity)
// ---------------------------------------------------------------------------

const mapCache = new WeakMap<Exercise[], Map<string, Exercise>>();

export function getExerciseMap(exercises: Exercise[]): Map<string, Exercise> {
  let map = mapCache.get(exercises);
  if (!map) {
    map = new Map(exercises.map((e) => [e.id, e]));
    mapCache.set(exercises, map);
  }
  return map;
}

export const useExerciseMap = () => useData((s) => getExerciseMap(s.exercises));
export const useHistoryIndex = () => useData((s) => getHistoryIndex(s.workouts));

export function exerciseName(map: Map<string, Exercise>, id: string): string {
  return map.get(id)?.name ?? 'Unknown exercise';
}

/** Snapshot of user data for export (custom exercises only). */
export function getSnapshot(): DataSnapshot {
  const { exercises, routines, workouts, measurements } = useData.getState();
  return { exercises: exercises.filter((e) => e.custom), routines, workouts, measurements };
}

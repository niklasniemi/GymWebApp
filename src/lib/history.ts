import type { PRType, Workout, WorkoutSet } from '../types';
import { estimate1RM, setVolume } from './calc';

export interface ExerciseBests {
  weight: number;
  reps: number;
  volume: number;
  e1rm: number;
}

export interface ExerciseSession {
  workoutId: string;
  date: number;
  sets: WorkoutSet[];
}

export interface HistoryIndex {
  /** Finished workouts, newest first. */
  sorted: Workout[];
  /** Sessions per exercise, oldest first. */
  sessions: Map<string, ExerciseSession[]>;
  bests: Map<string, ExerciseBests>;
}

const EMPTY_BESTS: ExerciseBests = { weight: 0, reps: 0, volume: 0, e1rm: 0 };

const cache = new WeakMap<Workout[], HistoryIndex>();

/**
 * Derived lookups over the workout log. Memoized on array identity — the data
 * store replaces the array on every write, so this recomputes exactly once per
 * change no matter how many components ask.
 */
export function getHistoryIndex(workouts: Workout[]): HistoryIndex {
  const hit = cache.get(workouts);
  if (hit) return hit;

  const finished = workouts.filter((w) => w.endedAt);
  const sorted = [...finished].sort((a, b) => b.startedAt - a.startedAt);
  const sessions = new Map<string, ExerciseSession[]>();
  const bests = new Map<string, ExerciseBests>();

  for (let i = sorted.length - 1; i >= 0; i--) {
    const w = sorted[i];
    for (const we of w.exercises) {
      const done = we.sets.filter((s) => s.completed);
      if (!done.length) continue;
      const list = sessions.get(we.exerciseId);
      const session = { workoutId: w.id, date: w.startedAt, sets: done };
      if (list) list.push(session);
      else sessions.set(we.exerciseId, [session]);

      const b = bests.get(we.exerciseId) ?? { ...EMPTY_BESTS };
      for (const s of done) accumulate(b, s);
      bests.set(we.exerciseId, b);
    }
  }

  const index = { sorted, sessions, bests };
  cache.set(workouts, index);
  return index;
}

function accumulate(b: ExerciseBests, s: WorkoutSet) {
  if (s.type === 'warmup') return;
  const w = s.weight ?? 0;
  const r = s.reps ?? 0;
  if (r <= 0) return;
  b.weight = Math.max(b.weight, w);
  b.reps = Math.max(b.reps, r);
  b.volume = Math.max(b.volume, setVolume(s));
  b.e1rm = Math.max(b.e1rm, estimate1RM(w, r));
}

/** Most recent session of an exercise, optionally excluding a workout. */
export function lastSession(index: HistoryIndex, exerciseId: string, excludeWorkoutId?: string) {
  const list = index.sessions.get(exerciseId);
  if (!list) return undefined;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].workoutId !== excludeWorkoutId) return list[i];
  }
  return undefined;
}

/**
 * Pairs each current set with the equivalent set from last time: warm-ups map
 * to warm-ups and working sets to working sets, by position.
 */
export function matchPreviousSets(current: WorkoutSet[], previous: WorkoutSet[] | undefined) {
  const result: (WorkoutSet | undefined)[] = [];
  if (!previous?.length) return current.map(() => undefined);
  const prevWarm = previous.filter((s) => s.type === 'warmup');
  const prevWork = previous.filter((s) => s.type !== 'warmup');
  let wi = 0;
  let ki = 0;
  for (const s of current) {
    result.push(s.type === 'warmup' ? prevWarm[wi++] : prevWork[ki++]);
  }
  return result;
}

/**
 * For each set, the closest earlier set in the same session (warm-ups match
 * warm-ups) that has values — used as a placeholder when there is no
 * previous session, so straight sets can be logged with a single tap.
 */
export function inSessionHints(sets: WorkoutSet[]): (WorkoutSet | undefined)[] {
  let lastWarm: WorkoutSet | undefined;
  let lastWork: WorkoutSet | undefined;
  return sets.map((s) => {
    const warm = s.type === 'warmup';
    const hint = warm ? lastWarm : lastWork;
    if (s.reps !== null) {
      if (warm) lastWarm = s;
      else lastWork = s;
    }
    return hint;
  });
}

const EPS = 1e-6;

/**
 * Evaluates which records a completed set breaks, given the historical bests
 * and the running bests from earlier sets in the same session (mutated).
 * First-ever sessions never award PRs — everything would be a record.
 */
export function evaluateSet(set: WorkoutSet, historical: ExerciseBests | undefined, running: ExerciseBests): PRType[] {
  if (!set.completed || set.type === 'warmup') return [];
  const w = set.weight ?? 0;
  const r = set.reps ?? 0;
  if (r <= 0) return [];
  const vol = w * r;
  const e1rm = estimate1RM(w, r);
  const prs: PRType[] = [];
  if (historical) {
    const best = (k: keyof ExerciseBests) => Math.max(historical[k], running[k]);
    if (w > 0 && w > best('weight') + EPS) prs.push('weight');
    if (r > best('reps')) prs.push('reps');
    if (w > 0 && vol > best('volume') + EPS) prs.push('volume');
    if (w > 0 && e1rm > best('e1rm') + EPS) prs.push('e1rm');
  }
  accumulate(running, set);
  return prs;
}

/** PRs for every set in a workout, evaluated in order. */
export function computeWorkoutPRs(workout: Workout, index: HistoryIndex): Map<string, PRType[]> {
  const out = new Map<string, PRType[]>();
  const running = new Map<string, ExerciseBests>();
  for (const we of workout.exercises) {
    const r = running.get(we.exerciseId) ?? { ...EMPTY_BESTS };
    running.set(we.exerciseId, r);
    const hist = index.bests.get(we.exerciseId);
    for (const s of we.sets) {
      const prs = evaluateSet(s, hist, r);
      if (prs.length) out.set(s.id, prs);
    }
  }
  return out;
}

/** Display labels: warm-ups "W", drop "D", failure "F", working sets numbered. */
export function setLabels(sets: WorkoutSet[]): string[] {
  let n = 0;
  return sets.map((s) => {
    if (s.type === 'warmup') return 'W';
    n++;
    return s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : String(n);
  });
}

export const PR_LABELS: Record<PRType, string> = {
  weight: 'Heaviest weight',
  reps: 'Most reps',
  volume: 'Best set volume',
  e1rm: 'Est. 1RM',
};

export function workoutVolume(w: Workout): number {
  let total = 0;
  for (const we of w.exercises) {
    for (const s of we.sets) if (s.completed && s.type !== 'warmup') total += setVolume(s);
  }
  return total;
}

export function workoutSetCount(w: Workout): number {
  let n = 0;
  for (const we of w.exercises) for (const s of we.sets) if (s.completed && s.type !== 'warmup') n++;
  return n;
}

export function workoutPRCount(w: Workout): number {
  let n = 0;
  for (const we of w.exercises) for (const s of we.sets) if (s.prs?.length) n++;
  return n;
}

export interface SessionPoint {
  date: number;
  e1rm: number;
  weight: number;
  volume: number;
  reps: number;
}

/** One data point per session for strength curves. */
export function sessionSeries(sessions: ExerciseSession[] | undefined): SessionPoint[] {
  if (!sessions) return [];
  return sessions.map((s) => {
    const p: SessionPoint = { date: s.date, e1rm: 0, weight: 0, volume: 0, reps: 0 };
    for (const set of s.sets) {
      if (set.type === 'warmup') continue;
      p.e1rm = Math.max(p.e1rm, estimate1RM(set.weight, set.reps));
      p.weight = Math.max(p.weight, set.weight ?? 0);
      p.reps = Math.max(p.reps, set.reps ?? 0);
      p.volume += setVolume(set);
    }
    return p;
  });
}

/** Best (heaviest e1RM) working set of a session — the "top set". */
export function topSet(sets: WorkoutSet[]): WorkoutSet | undefined {
  let best: WorkoutSet | undefined;
  let bestScore = -1;
  for (const s of sets) {
    if (s.type === 'warmup') continue;
    const score = estimate1RM(s.weight, s.reps) || (s.reps ?? 0) / 1000;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

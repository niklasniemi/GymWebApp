import { BUILTIN_EXERCISES } from '../data/exercises';
import {
  EQUIPMENT,
  MEAL_SLOTS,
  MEASUREMENT_KEYS,
  MUSCLE_GROUPS,
  SET_TYPES,
  type BackupFile,
  type BodyMeasurement,
  type DataSnapshot,
  type Equipment,
  type Exercise,
  type Food,
  type FoodEntry,
  type MealItem,
  type MuscleGroup,
  type Nutrients,
  type PRType,
  type Routine,
  type SavedMeal,
  type Settings,
  type SetType,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type WaterLog,
} from '../types';
import { MEAL_LABELS } from './nutrition';
import { uid } from './utils';

// ---------------------------------------------------------------------------
// JSON backup
// ---------------------------------------------------------------------------

export function createBackup(
  data: DataSnapshot,
  settings: Settings,
  favorites: string[] = [],
  nutrition?: unknown,
): BackupFile {
  return {
    app: 'forge',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    favorites,
    nutrition,
    ...data,
  };
}

export class ImportError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

function cleanSet(raw: unknown): WorkoutSet | null {
  if (!isObj(raw)) return null;
  const prs = Array.isArray(raw.prs)
    ? (raw.prs.filter((p) => ['weight', 'reps', 'volume', 'e1rm'].includes(p as string)) as PRType[])
    : undefined;
  return {
    id: str(raw.id) || uid(),
    type: oneOf(raw.type, SET_TYPES, 'normal'),
    weight: num(raw.weight),
    reps: num(raw.reps),
    rpe: num(raw.rpe),
    rir: num(raw.rir),
    completed: raw.completed !== false,
    completedAt: num(raw.completedAt) ?? undefined,
    prs: prs?.length ? prs : undefined,
  };
}

function cleanWorkout(raw: unknown): Workout | null {
  if (!isObj(raw) || !str(raw.id) || num(raw.startedAt) === null || !Array.isArray(raw.exercises)) return null;
  const exercises: WorkoutExercise[] = raw.exercises
    .filter(isObj)
    .filter((we) => str(we.exerciseId))
    .map((we) => ({
      id: str(we.id) || uid(),
      exerciseId: str(we.exerciseId),
      sets: (Array.isArray(we.sets) ? we.sets : []).map(cleanSet).filter((s): s is WorkoutSet => s !== null),
      restSeconds: num(we.restSeconds) ?? undefined,
      targetReps: str(we.targetReps) || undefined,
      notes: str(we.notes) || undefined,
    }));
  const startedAt = num(raw.startedAt) as number;
  return {
    id: str(raw.id),
    name: str(raw.name, 'Workout'),
    routineId: str(raw.routineId) || undefined,
    startedAt,
    endedAt: num(raw.endedAt) ?? startedAt,
    exercises,
    notes: str(raw.notes) || undefined,
  };
}

function cleanExercise(raw: unknown): Exercise | null {
  if (!isObj(raw) || !str(raw.id) || !str(raw.name)) return null;
  return {
    id: str(raw.id),
    name: str(raw.name).slice(0, 80),
    primaryMuscle: oneOf(raw.primaryMuscle, MUSCLE_GROUPS, 'core'),
    secondaryMuscles: Array.isArray(raw.secondaryMuscles)
      ? raw.secondaryMuscles.filter((m): m is MuscleGroup => MUSCLE_GROUPS.includes(m as MuscleGroup))
      : [],
    equipment: oneOf(raw.equipment, EQUIPMENT, 'other'),
    custom: true,
    archived: raw.archived === true || undefined,
    notes: str(raw.notes) || undefined,
    createdAt: num(raw.createdAt) ?? Date.now(),
  };
}

function cleanRoutine(raw: unknown, i: number): Routine | null {
  if (!isObj(raw) || !str(raw.id) || !Array.isArray(raw.exercises)) return null;
  return {
    id: str(raw.id),
    name: str(raw.name, 'Routine'),
    notes: str(raw.notes) || undefined,
    order: num(raw.order) ?? i,
    createdAt: num(raw.createdAt) ?? Date.now(),
    updatedAt: num(raw.updatedAt) ?? Date.now(),
    lastUsedAt: num(raw.lastUsedAt) ?? undefined,
    exercises: raw.exercises
      .filter(isObj)
      .filter((e) => str(e.exerciseId))
      .map((e) => ({
        id: str(e.id) || uid(),
        exerciseId: str(e.exerciseId),
        sets: Math.max(1, Math.round(num(e.sets) ?? 3)),
        reps: str(e.reps, '8-12'),
        restSeconds: num(e.restSeconds) ?? undefined,
      })),
  };
}

function cleanMeasurement(raw: unknown): BodyMeasurement | null {
  if (!isObj(raw) || !str(raw.id) || num(raw.date) === null || !isObj(raw.values)) return null;
  const values: BodyMeasurement['values'] = {};
  for (const k of MEASUREMENT_KEYS) {
    const v = num((raw.values as Record<string, unknown>)[k]);
    if (v !== null && v > 0) values[k] = v;
  }
  return { id: str(raw.id), date: num(raw.date) as number, values, notes: str(raw.notes) || undefined };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const clampNum = (v: unknown, max = 100_000) => {
  const n = num(v);
  return n === null || n < 0 ? 0 : Math.min(n, max);
};

function cleanNutrients(raw: unknown): Nutrients | null {
  if (!isObj(raw) || num(raw.kcal) === null) return null;
  const out: Nutrients = {
    kcal: clampNum(raw.kcal),
    protein: clampNum(raw.protein),
    carbs: clampNum(raw.carbs),
    fat: clampNum(raw.fat),
  };
  if (num(raw.fiber) !== null) out.fiber = clampNum(raw.fiber);
  if (num(raw.sugar) !== null) out.sugar = clampNum(raw.sugar);
  return out;
}

function cleanFood(raw: unknown): Food | null {
  if (!isObj(raw) || !str(raw.id) || !str(raw.name)) return null;
  const per100 = cleanNutrients(raw.per100);
  if (!per100) return null;
  const serving =
    isObj(raw.serving) && (num(raw.serving.grams) ?? 0) > 0
      ? { grams: num(raw.serving.grams) as number, label: str(raw.serving.label, 'serving').slice(0, 60) }
      : undefined;
  return {
    id: str(raw.id),
    name: str(raw.name).slice(0, 120),
    brand: str(raw.brand).slice(0, 80) || undefined,
    barcode: str(raw.barcode).slice(0, 32) || undefined,
    per100,
    serving,
    liquid: raw.liquid === true || undefined,
    source: raw.source === 'off' ? 'off' : 'custom',
    createdAt: num(raw.createdAt) ?? Date.now(),
  };
}

function cleanMealItem(raw: unknown): MealItem | null {
  if (!isObj(raw) || !str(raw.name)) return null;
  const nutrients = cleanNutrients(raw.nutrients);
  if (!nutrients) return null;
  return {
    foodId: str(raw.foodId) || undefined,
    name: str(raw.name).slice(0, 120),
    brand: str(raw.brand).slice(0, 80) || undefined,
    quantity: clampNum(raw.quantity),
    unit: raw.unit === 'serving' ? 'serving' : 'g',
    grams: clampNum(raw.grams),
    servingLabel: str(raw.servingLabel).slice(0, 60) || undefined,
    liquid: raw.liquid === true || undefined,
    nutrients,
  };
}

function cleanFoodEntry(raw: unknown): FoodEntry | null {
  if (!isObj(raw) || !str(raw.id) || !DAY_RE.test(str(raw.day))) return null;
  const item = cleanMealItem(raw);
  if (!item) return null;
  return {
    ...item,
    id: str(raw.id),
    day: str(raw.day),
    meal: oneOf(raw.meal, MEAL_SLOTS, 'snack'),
    createdAt: num(raw.createdAt) ?? Date.now(),
  };
}

function cleanSavedMeal(raw: unknown): SavedMeal | null {
  if (!isObj(raw) || !str(raw.id) || !Array.isArray(raw.items)) return null;
  const items = raw.items.map(cleanMealItem).filter((x): x is MealItem => x !== null);
  if (!items.length) return null;
  return {
    id: str(raw.id),
    name: str(raw.name, 'Meal').slice(0, 80),
    items,
    createdAt: num(raw.createdAt) ?? Date.now(),
  };
}

function cleanWater(raw: unknown): WaterLog | null {
  if (!isObj(raw) || !DAY_RE.test(str(raw.id))) return null;
  return { id: str(raw.id), ml: clampNum(raw.ml, 20_000) };
}

/** Parses and sanitizes a backup file. Never trusts the input shape. */
export function parseBackup(text: string): {
  data: DataSnapshot;
  settings?: Partial<Settings>;
  favorites?: string[];
  nutrition?: unknown;
} {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('This file is not valid JSON.');
  }
  if (!isObj(raw) || (raw.app !== 'forge' && !Array.isArray(raw.workouts))) {
    throw new ImportError('This does not look like a Forge backup.');
  }
  const arr = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as unknown[]) : []);
  const data: DataSnapshot = {
    exercises: arr('exercises')
      .map(cleanExercise)
      .filter((x): x is Exercise => x !== null),
    routines: arr('routines')
      .map(cleanRoutine)
      .filter((x): x is Routine => x !== null),
    workouts: arr('workouts')
      .map(cleanWorkout)
      .filter((x): x is Workout => x !== null),
    measurements: arr('measurements')
      .map(cleanMeasurement)
      .filter((x): x is BodyMeasurement => x !== null),
    foods: arr('foods')
      .map(cleanFood)
      .filter((x): x is Food => x !== null),
    foodEntries: arr('foodEntries')
      .map(cleanFoodEntry)
      .filter((x): x is FoodEntry => x !== null),
    savedMeals: arr('savedMeals')
      .map(cleanSavedMeal)
      .filter((x): x is SavedMeal => x !== null),
    water: arr('water')
      .map(cleanWater)
      .filter((x): x is WaterLog => x !== null),
  };
  const settings = isObj(raw.settings) ? (raw.settings as Partial<Settings>) : undefined;
  const favorites = Array.isArray(raw.favorites)
    ? raw.favorites.filter((x): x is string => typeof x === 'string').slice(0, 1000)
    : undefined;
  return { data, settings, favorites, nutrition: isObj(raw.nutrition) ? raw.nutrition : undefined };
}

// ---------------------------------------------------------------------------
// CSV (one row per set — spreadsheet friendly)
// ---------------------------------------------------------------------------

export const CSV_COLUMNS = [
  'workout_id',
  'workout_name',
  'started_at',
  'ended_at',
  'exercise_id',
  'exercise_name',
  'primary_muscle',
  'equipment',
  'exercise_order',
  'set_order',
  'set_type',
  'weight_kg',
  'reps',
  'rpe',
  'rir',
  'personal_records',
  'workout_notes',
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function workoutsToCSV(workouts: Workout[], exercises: Map<string, Exercise>): string {
  const lines: string[] = [CSV_COLUMNS.join(',')];
  const sorted = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  for (const w of sorted) {
    w.exercises.forEach((we, ei) => {
      const ex = exercises.get(we.exerciseId);
      we.sets.forEach((s, si) => {
        lines.push(
          [
            w.id,
            w.name,
            new Date(w.startedAt).toISOString(),
            w.endedAt ? new Date(w.endedAt).toISOString() : '',
            we.exerciseId,
            ex?.name ?? 'Unknown exercise',
            ex?.primaryMuscle ?? '',
            ex?.equipment ?? '',
            ei + 1,
            si + 1,
            s.type,
            s.weight ?? '',
            s.reps ?? '',
            s.rpe ?? '',
            s.rir ?? '',
            s.prs?.join('|') ?? '',
            si === 0 && ei === 0 ? (w.notes ?? '') : '',
          ]
            .map(csvCell)
            .join(','),
        );
      });
    });
  }
  return lines.join('\r\n');
}

/** RFC 4180 parser: quoted fields, escaped quotes, CRLF/LF, embedded newlines. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Converts a Forge CSV export back into workouts. Unknown exercises are
 * matched by name, or recreated as custom exercises.
 */
export function workoutsFromCSV(text: string, existing: Exercise[]): DataSnapshot {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new ImportError('The CSV file is empty.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: (typeof CSV_COLUMNS)[number]) => header.indexOf(name);
  for (const required of ['workout_id', 'started_at', 'exercise_name', 'reps'] as const) {
    if (col(required) === -1) throw new ImportError(`Missing column “${required}”. Use a CSV exported from Forge.`);
  }

  const byId = new Map([...BUILTIN_EXERCISES, ...existing].map((e) => [e.id, e]));
  const byName = new Map([...BUILTIN_EXERCISES, ...existing].map((e) => [e.name.toLowerCase(), e]));
  const created = new Map<string, Exercise>();

  const resolveExercise = (id: string, name: string, muscle: string, equipment: string): string => {
    if (id && byId.has(id)) return id;
    const known = byName.get(name.toLowerCase()) ?? created.get(name.toLowerCase());
    if (known) return known.id;
    const ex: Exercise = {
      id: `custom-${uid()}`,
      name: name || 'Imported exercise',
      primaryMuscle: oneOf(muscle, MUSCLE_GROUPS, 'core'),
      secondaryMuscles: [],
      equipment: oneOf(equipment, EQUIPMENT, 'other') as Equipment,
      custom: true,
      createdAt: Date.now(),
    };
    created.set(ex.name.toLowerCase(), ex);
    return ex.id;
  };

  const workouts = new Map<string, Workout>();
  const exerciseSlots = new Map<string, WorkoutExercise>();
  const get = (r: string[], name: (typeof CSV_COLUMNS)[number]) => {
    const i = col(name);
    return i === -1 ? '' : (r[i] ?? '').trim();
  };
  const optNum = (v: string) => {
    if (v === '') return null;
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  for (const r of rows.slice(1)) {
    const wid = get(r, 'workout_id');
    const started = Date.parse(get(r, 'started_at'));
    if (!wid || Number.isNaN(started)) continue;
    let w = workouts.get(wid);
    if (!w) {
      const ended = Date.parse(get(r, 'ended_at'));
      w = {
        id: wid,
        name: get(r, 'workout_name') || 'Imported workout',
        startedAt: started,
        endedAt: Number.isNaN(ended) ? started : ended,
        exercises: [],
        notes: get(r, 'workout_notes') || undefined,
      };
      workouts.set(wid, w);
    }
    const exerciseId = resolveExercise(
      get(r, 'exercise_id'),
      get(r, 'exercise_name'),
      get(r, 'primary_muscle'),
      get(r, 'equipment'),
    );
    const slotKey = `${wid}:${get(r, 'exercise_order') || exerciseId}`;
    let we = exerciseSlots.get(slotKey);
    if (!we) {
      we = { id: uid(), exerciseId, sets: [] };
      exerciseSlots.set(slotKey, we);
      w.exercises.push(we);
    }
    const prs = get(r, 'personal_records')
      .split('|')
      .filter((p): p is PRType => ['weight', 'reps', 'volume', 'e1rm'].includes(p));
    we.sets.push({
      id: uid(),
      type: oneOf(get(r, 'set_type'), SET_TYPES, 'normal') as SetType,
      weight: optNum(get(r, 'weight_kg')),
      reps: optNum(get(r, 'reps')),
      rpe: optNum(get(r, 'rpe')),
      rir: optNum(get(r, 'rir')),
      completed: true,
      prs: prs.length ? prs : undefined,
    });
  }

  if (!workouts.size) throw new ImportError('No workouts found in this CSV.');
  return {
    exercises: [...created.values()],
    routines: [],
    workouts: [...workouts.values()],
    measurements: [],
    foods: [],
    foodEntries: [],
    savedMeals: [],
    water: [],
  };
}

/** Food diary as CSV: one row per logged item (export only). */
export function foodDiaryToCSV(entries: FoodEntry[]): string {
  const cols = ['date', 'meal', 'food', 'brand', 'amount_g', 'portion', 'kcal', 'protein_g', 'carbs_g', 'fat_g'];
  const order = new Map(MEAL_SLOTS.map((m, i) => [m, i]));
  const sorted = [...entries].sort(
    (a, b) =>
      a.day.localeCompare(b.day) || (order.get(a.meal) ?? 0) - (order.get(b.meal) ?? 0) || a.createdAt - b.createdAt,
  );
  const lines = [cols.join(',')];
  for (const e of sorted) {
    lines.push(
      [
        e.day,
        MEAL_LABELS[e.meal],
        e.name,
        e.brand ?? '',
        e.grams ? Math.round(e.grams) : '',
        e.unit === 'serving' ? `${e.quantity} × ${e.servingLabel ?? 'serving'}` : '',
        Math.round(e.nutrients.kcal),
        Math.round(e.nutrients.protein * 10) / 10,
        Math.round(e.nutrients.carbs * 10) / 10,
        Math.round(e.nutrients.fat * 10) / 10,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\r\n');
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * Hands a file to the user: the native share sheet on phones (so it can go
 * to Files, AirDrop, Drive…), a regular download elsewhere.
 */
export async function deliverFile(
  filename: string,
  content: string,
  mime: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([content], { type: mime });
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return 'cancelled';
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

export function datedFilename(base: string, ext: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

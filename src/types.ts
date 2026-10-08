export type Unit = 'kg' | 'lb';

export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'other'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

export type PRType = 'weight' | 'reps' | 'volume' | 'e1rm';
export type ThemePref = 'system' | 'light' | 'dark';
export const ACCENTS = ['blue', 'violet', 'teal', 'green', 'orange', 'pink', 'red', 'graphite'] as const;
export type AccentId = (typeof ACCENTS)[number];
export type EffortMetric = 'rpe' | 'rir' | 'off';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  custom: boolean;
  /** Custom exercises referenced by history are archived instead of deleted. */
  archived?: boolean;
  notes?: string;
  createdAt: number;
}

/** All weights are stored canonically in kilograms. */
export interface WorkoutSet {
  id: string;
  type: SetType;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  completed: boolean;
  completedAt?: number;
  /** PRs achieved by this set, stamped when the workout is finished. */
  prs?: PRType[];
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
  restSeconds?: number;
  /** Target rep range carried over from a routine, e.g. "8-12". */
  targetReps?: string;
  notes?: string;
}

export const RUN_TYPES = ['outdoor', 'treadmill', 'trail'] as const;
export type RunType = (typeof RUN_TYPES)[number];

/** A run logged after the fact (no live tracking). Stored on a Workout with no exercises. */
export interface RunData {
  type: RunType;
  /** Metres. */
  distance: number;
  /** Moving time in seconds. */
  duration: number;
  /** Elevation gain in metres. */
  elevation?: number;
  /** Average heart rate (bpm). */
  avgHr?: number;
  /** Perceived effort 1–10. */
  rpe?: number;
}

export const SPORTS = [
  'tennis',
  'padel',
  'badminton',
  'squash',
  'tableTennis',
  'football',
  'basketball',
  'floorball',
  'iceHockey',
  'volleyball',
  'golf',
  'cycling',
  'swimming',
  'walking',
  'hiking',
  'skiing',
  'rowing',
  'climbing',
  'martialArts',
  'yoga',
  'dance',
  'other',
] as const;
export type Sport = (typeof SPORTS)[number];

/** A sport or activity session logged afterwards (tennis, padel, cycling…). */
export interface ActivityData {
  sport: Sport;
  /** Seconds. */
  duration: number;
  /** Metres, for distance sports (cycling, swimming, walking…). */
  distance?: number;
  avgHr?: number;
  /** Perceived effort 1–10. */
  rpe?: number;
}

export interface Workout {
  id: string;
  name: string;
  routineId?: string;
  startedAt: number;
  endedAt?: number;
  /**
   * Set while back-filling a past workout: the session's real end time. On
   * finish it becomes `endedAt` (instead of "now").
   */
  plannedEnd?: number;
  exercises: WorkoutExercise[];
  notes?: string;
  /** Present for runs; strength workouts leave it undefined. */
  run?: RunData;
  /** Present for other sports and activities. */
  activity?: ActivityData;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds?: number;
}

export interface Routine {
  id: string;
  name: string;
  notes?: string;
  exercises: RoutineExercise[];
  order: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}

export const MEASUREMENT_KEYS = [
  'weight',
  'bodyFat',
  'neck',
  'shoulders',
  'chest',
  'waist',
  'hips',
  'biceps',
  'thigh',
  'calf',
] as const;
export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];

/** weight in kg, bodyFat in %, circumferences in cm. */
export interface BodyMeasurement {
  id: string;
  date: number;
  values: Partial<Record<MeasurementKey, number>>;
  notes?: string;
}

export interface Settings {
  theme: ThemePref;
  glass: boolean;
  /** Automatically drop to solid surfaces on low battery / reduced transparency. */
  autoPowerSaver: boolean;
  unit: Unit;
  defaultRest: number;
  autoStartRest: boolean;
  effortMetric: EffortMetric;
  haptics: boolean;
  /** Soft click sounds that stand in for vibration (iPhone has no web haptics). */
  hapticSound: boolean;
  sound: boolean;
  keepAwake: boolean;
  /** Main accent colour. */
  accent: AccentId;
  /** Target workouts per week — drives the fire, streak and goal widgets. */
  weeklyGoal: number;
  /** Shown on the profile page. */
  name: string;
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
}

export type FoodCategory =
  'protein' | 'dairy' | 'grains' | 'fruit' | 'vegetables' | 'legumes' | 'fats' | 'snacks' | 'drinks' | 'meals';

/** A food definition. Nutrients are per 100 g (or 100 ml for liquids). */
export interface Food {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  per100: Nutrients;
  /** A typical serving, e.g. { grams: 30, label: '1 slice' }. */
  serving?: { grams: number; label: string };
  liquid?: boolean;
  category?: FoodCategory;
  source: 'builtin' | 'custom' | 'off';
  createdAt: number;
}

export type PortionUnit = 'g' | 'serving';

/** One logged food. Nutrients are a snapshot, so editing a food never rewrites history. */
export interface FoodEntry {
  id: string;
  /** Local calendar day, yyyy-mm-dd. */
  day: string;
  meal: MealSlot;
  /** Absent for quick-add calories. */
  foodId?: string;
  name: string;
  brand?: string;
  quantity: number;
  unit: PortionUnit;
  /** Resolved weight in g/ml (0 for quick add). */
  grams: number;
  servingLabel?: string;
  liquid?: boolean;
  nutrients: Nutrients;
  createdAt: number;
}

export type MealItem = Omit<FoodEntry, 'id' | 'day' | 'meal' | 'createdAt'>;

/** A reusable combination of foods ("Overnight oats + coffee"). */
export interface SavedMeal {
  id: string;
  name: string;
  items: MealItem[];
  createdAt: number;
}

/** Water drunk on a day (id = yyyy-mm-dd). */
export interface WaterLog {
  id: string;
  ml: number;
}

export interface DataSnapshot {
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  measurements: BodyMeasurement[];
  foods: Food[];
  foodEntries: FoodEntry[];
  savedMeals: SavedMeal[];
  water: WaterLog[];
}

export interface BackupFile extends DataSnapshot {
  app: 'forge';
  version: 1;
  exportedAt: string;
  settings?: Partial<Settings>;
  /** Starred exercise ids. */
  favorites?: string[];
  /** Nutrition goals & profile. */
  nutrition?: unknown;
}

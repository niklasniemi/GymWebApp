export type Unit = 'kg' | 'lb';

export const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'other'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

export type PRType = 'weight' | 'reps' | 'volume' | 'e1rm';
export type ThemePref = 'system' | 'light' | 'dark';
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

export interface Workout {
  id: string;
  name: string;
  routineId?: string;
  startedAt: number;
  endedAt?: number;
  exercises: WorkoutExercise[];
  notes?: string;
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
  sound: boolean;
  keepAwake: boolean;
}

export interface DataSnapshot {
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  measurements: BodyMeasurement[];
}

export interface BackupFile extends DataSnapshot {
  app: 'forge';
  version: 1;
  exportedAt: string;
  settings?: Partial<Settings>;
  /** Starred exercise ids. */
  favorites?: string[];
}

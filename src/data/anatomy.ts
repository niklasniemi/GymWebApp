import type { Exercise, MuscleGroup } from '../types';

/** Detailed muscle regions drawn on the 3D body map. */
export const MUSCLES = [
  'chest',
  'shoulders',
  'rearDelts',
  'biceps',
  'triceps',
  'forearms',
  'traps',
  'lats',
  'lowerBack',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_NAMES: Record<Muscle, string> = {
  chest: 'Chest',
  shoulders: 'Front & side delts',
  rearDelts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  traps: 'Traps',
  lats: 'Lats & upper back',
  lowerBack: 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
};

/** Which side of the body faces the camera best for each muscle. */
export const MUSCLE_FACING: Record<Muscle, 'front' | 'back'> = {
  chest: 'front',
  shoulders: 'front',
  rearDelts: 'back',
  biceps: 'front',
  triceps: 'back',
  forearms: 'front',
  traps: 'back',
  lats: 'back',
  lowerBack: 'back',
  abs: 'front',
  obliques: 'front',
  glutes: 'back',
  quads: 'front',
  hamstrings: 'back',
  adductors: 'front',
  calves: 'back',
};

export interface MuscleTargets {
  primary: Muscle[];
  secondary: Muscle[];
}

type Map = Record<string, [primary: Muscle[], secondary: Muscle[]]>;

/** Hand-mapped targets for every built-in exercise. */
const BUILTIN: Map = {
  'bench-press': [['chest'], ['shoulders', 'triceps']],
  'incline-bench-press': [['chest', 'shoulders'], ['triceps']],
  'decline-bench-press': [['chest'], ['triceps']],
  'db-bench-press': [['chest'], ['shoulders', 'triceps']],
  'db-incline-press': [['chest', 'shoulders'], ['triceps']],
  'db-fly': [['chest'], ['shoulders']],
  'cable-crossover': [['chest'], ['shoulders']],
  'cable-fly-low': [['chest'], ['shoulders']],
  'chest-press-machine': [['chest'], ['triceps', 'shoulders']],
  'pec-deck': [['chest'], []],
  'push-up': [['chest'], ['triceps', 'shoulders', 'abs']],
  'dip-chest': [['chest', 'triceps'], ['shoulders']],

  deadlift: [
    ['lowerBack', 'glutes', 'hamstrings'],
    ['quads', 'traps', 'lats', 'forearms'],
  ],
  'barbell-row': [['lats'], ['rearDelts', 'biceps', 'traps', 'lowerBack']],
  'pendlay-row': [['lats'], ['rearDelts', 'biceps', 'traps']],
  'rack-pull': [
    ['lowerBack', 'traps'],
    ['glutes', 'hamstrings', 'forearms'],
  ],
  'db-row': [['lats'], ['rearDelts', 'biceps']],
  'pull-up': [['lats'], ['biceps', 'rearDelts', 'forearms']],
  'chin-up': [['lats', 'biceps'], ['forearms']],
  'lat-pulldown': [['lats'], ['biceps', 'rearDelts']],
  'seated-cable-row': [['lats'], ['traps', 'rearDelts', 'biceps']],
  'straight-arm-pulldown': [['lats'], ['triceps']],
  't-bar-row': [['lats'], ['traps', 'rearDelts', 'biceps']],
  'machine-row': [['lats'], ['traps', 'rearDelts', 'biceps']],
  'back-extension': [['lowerBack'], ['glutes', 'hamstrings']],

  squat: [
    ['quads', 'glutes'],
    ['adductors', 'lowerBack', 'hamstrings'],
  ],
  'front-squat': [['quads'], ['glutes', 'abs']],
  'romanian-deadlift': [['hamstrings', 'glutes'], ['lowerBack']],
  'hip-thrust': [['glutes'], ['hamstrings']],
  'bulgarian-split-squat': [['quads', 'glutes'], ['adductors']],
  'db-lunge': [
    ['quads', 'glutes'],
    ['hamstrings', 'calves'],
  ],
  'goblet-squat': [['quads', 'glutes'], ['abs']],
  'leg-press': [['quads'], ['glutes']],
  'hack-squat': [['quads'], ['glutes']],
  'leg-extension': [['quads'], []],
  'lying-leg-curl': [['hamstrings'], ['calves']],
  'seated-leg-curl': [['hamstrings'], []],
  'standing-calf-raise': [['calves'], []],
  'seated-calf-raise': [['calves'], []],
  'cable-pull-through': [['glutes', 'hamstrings'], ['lowerBack']],
  'bodyweight-squat': [['quads', 'glutes'], []],

  'overhead-press': [['shoulders'], ['triceps', 'traps', 'abs']],
  'push-press': [['shoulders'], ['triceps', 'quads']],
  'db-shoulder-press': [['shoulders'], ['triceps']],
  'arnold-press': [['shoulders'], ['triceps']],
  'lateral-raise': [['shoulders'], ['traps']],
  'rear-delt-fly': [['rearDelts'], ['traps']],
  'cable-lateral-raise': [['shoulders'], []],
  'face-pull': [['rearDelts'], ['traps']],
  'shoulder-press-machine': [['shoulders'], ['triceps']],
  'reverse-pec-deck': [['rearDelts'], ['traps']],
  'upright-row': [['shoulders', 'traps'], ['biceps']],

  'barbell-curl': [['biceps'], ['forearms']],
  'ez-bar-curl': [['biceps'], ['forearms']],
  'db-curl': [['biceps'], ['forearms']],
  'hammer-curl': [['biceps', 'forearms'], []],
  'incline-db-curl': [['biceps'], []],
  'preacher-curl': [['biceps'], []],
  'cable-curl': [['biceps'], ['forearms']],
  'close-grip-bench': [['triceps'], ['chest', 'shoulders']],
  'skull-crusher': [['triceps'], []],
  'triceps-pushdown': [['triceps'], []],
  'overhead-triceps-extension': [['triceps'], []],
  'db-overhead-extension': [['triceps'], []],
  'bench-dip': [['triceps'], ['chest', 'shoulders']],
  'wrist-curl': [['forearms'], []],

  plank: [['abs'], ['obliques']],
  'hanging-leg-raise': [['abs'], ['obliques', 'forearms']],
  crunch: [['abs'], []],
  'cable-crunch': [['abs'], ['obliques']],
  'ab-wheel': [['abs'], ['lats', 'obliques']],
  'russian-twist': [['obliques'], ['abs']],
  'pallof-press': [['obliques'], ['abs']],
  'ab-machine': [['abs'], []],
  'farmers-walk': [
    ['forearms', 'traps'],
    ['abs', 'obliques', 'calves'],
  ],
};

/** Fallback for custom exercises, derived from their muscle-group tags. */
const GROUP_PRIMARY: Record<MuscleGroup, Muscle[]> = {
  chest: ['chest'],
  back: ['lats'],
  legs: ['quads', 'glutes'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],
  core: ['abs'],
};

const GROUP_SECONDARY: Record<MuscleGroup, Muscle[]> = {
  chest: ['chest'],
  back: ['lats', 'traps'],
  legs: ['quads', 'hamstrings', 'glutes'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],
  core: ['abs', 'obliques'],
};

const cache = new WeakMap<Exercise, MuscleTargets>();

export function exerciseMuscles(ex: Exercise): MuscleTargets {
  const hit = cache.get(ex);
  if (hit) return hit;
  const mapped = BUILTIN[ex.id];
  let targets: MuscleTargets;
  if (mapped) {
    targets = { primary: mapped[0], secondary: mapped[1] };
  } else {
    const primary = [...new Set(GROUP_PRIMARY[ex.primaryMuscle])];
    const secondary = [...new Set(ex.secondaryMuscles.flatMap((g) => GROUP_SECONDARY[g]))].filter(
      (m) => !primary.includes(m),
    );
    targets = { primary, secondary };
  }
  cache.set(ex, targets);
  return targets;
}

/** Exposed for tests: every built-in exercise must be mapped. */
export const BUILTIN_MUSCLE_MAP = BUILTIN;

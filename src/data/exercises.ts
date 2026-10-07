import type { Equipment, Exercise, MuscleGroup } from '../types';

type Seed = [id: string, name: string, primary: MuscleGroup, equipment: Equipment, secondary?: MuscleGroup[]];

const SEED: Seed[] = [
  // Chest
  ['bench-press', 'Bench Press', 'chest', 'barbell', ['shoulders', 'arms']],
  ['incline-bench-press', 'Incline Bench Press', 'chest', 'barbell', ['shoulders', 'arms']],
  ['decline-bench-press', 'Decline Bench Press', 'chest', 'barbell', ['arms']],
  ['db-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbell', ['shoulders', 'arms']],
  ['db-incline-press', 'Incline Dumbbell Press', 'chest', 'dumbbell', ['shoulders', 'arms']],
  ['db-fly', 'Dumbbell Fly', 'chest', 'dumbbell'],
  ['cable-crossover', 'Cable Crossover', 'chest', 'cable'],
  ['cable-fly-low', 'Low-to-High Cable Fly', 'chest', 'cable', ['shoulders']],
  ['chest-press-machine', 'Chest Press', 'chest', 'machine', ['arms']],
  ['pec-deck', 'Pec Deck', 'chest', 'machine'],
  ['push-up', 'Push-Up', 'chest', 'bodyweight', ['arms', 'core']],
  ['dip-chest', 'Chest Dip', 'chest', 'bodyweight', ['arms', 'shoulders']],

  // Back
  ['deadlift', 'Deadlift', 'back', 'barbell', ['legs', 'core']],
  ['barbell-row', 'Barbell Row', 'back', 'barbell', ['arms']],
  ['pendlay-row', 'Pendlay Row', 'back', 'barbell', ['arms']],
  ['rack-pull', 'Rack Pull', 'back', 'barbell', ['legs']],
  ['db-row', 'One-Arm Dumbbell Row', 'back', 'dumbbell', ['arms']],
  ['pull-up', 'Pull-Up', 'back', 'bodyweight', ['arms']],
  ['chin-up', 'Chin-Up', 'back', 'bodyweight', ['arms']],
  ['lat-pulldown', 'Lat Pulldown', 'back', 'cable', ['arms']],
  ['seated-cable-row', 'Seated Cable Row', 'back', 'cable', ['arms']],
  ['straight-arm-pulldown', 'Straight-Arm Pulldown', 'back', 'cable'],
  ['t-bar-row', 'T-Bar Row', 'back', 'machine', ['arms']],
  ['machine-row', 'Machine Row', 'back', 'machine', ['arms']],
  ['back-extension', 'Back Extension', 'back', 'bodyweight', ['legs', 'core']],

  // Legs
  ['squat', 'Back Squat', 'legs', 'barbell', ['core']],
  ['front-squat', 'Front Squat', 'legs', 'barbell', ['core']],
  ['romanian-deadlift', 'Romanian Deadlift', 'legs', 'barbell', ['back']],
  ['hip-thrust', 'Hip Thrust', 'legs', 'barbell'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'legs', 'dumbbell', ['core']],
  ['db-lunge', 'Walking Lunge', 'legs', 'dumbbell'],
  ['goblet-squat', 'Goblet Squat', 'legs', 'dumbbell', ['core']],
  ['leg-press', 'Leg Press', 'legs', 'machine'],
  ['hack-squat', 'Hack Squat', 'legs', 'machine'],
  ['leg-extension', 'Leg Extension', 'legs', 'machine'],
  ['lying-leg-curl', 'Lying Leg Curl', 'legs', 'machine'],
  ['seated-leg-curl', 'Seated Leg Curl', 'legs', 'machine'],
  ['standing-calf-raise', 'Standing Calf Raise', 'legs', 'machine'],
  ['seated-calf-raise', 'Seated Calf Raise', 'legs', 'machine'],
  ['cable-pull-through', 'Cable Pull-Through', 'legs', 'cable', ['back']],
  ['bodyweight-squat', 'Air Squat', 'legs', 'bodyweight'],

  // Shoulders
  ['overhead-press', 'Overhead Press', 'shoulders', 'barbell', ['arms', 'core']],
  ['push-press', 'Push Press', 'shoulders', 'barbell', ['legs', 'arms']],
  ['db-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell', ['arms']],
  ['arnold-press', 'Arnold Press', 'shoulders', 'dumbbell', ['arms']],
  ['lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell'],
  ['rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell', ['back']],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', 'cable'],
  ['face-pull', 'Face Pull', 'shoulders', 'cable', ['back']],
  ['shoulder-press-machine', 'Shoulder Press', 'shoulders', 'machine', ['arms']],
  ['reverse-pec-deck', 'Reverse Pec Deck', 'shoulders', 'machine', ['back']],
  ['upright-row', 'Upright Row', 'shoulders', 'barbell', ['arms']],

  // Arms
  ['barbell-curl', 'Barbell Curl', 'arms', 'barbell'],
  ['ez-bar-curl', 'EZ-Bar Curl', 'arms', 'barbell'],
  ['db-curl', 'Dumbbell Curl', 'arms', 'dumbbell'],
  ['hammer-curl', 'Hammer Curl', 'arms', 'dumbbell'],
  ['incline-db-curl', 'Incline Dumbbell Curl', 'arms', 'dumbbell'],
  ['preacher-curl', 'Preacher Curl', 'arms', 'machine'],
  ['cable-curl', 'Cable Curl', 'arms', 'cable'],
  ['close-grip-bench', 'Close-Grip Bench Press', 'arms', 'barbell', ['chest']],
  ['skull-crusher', 'Skull Crusher', 'arms', 'barbell'],
  ['triceps-pushdown', 'Triceps Pushdown', 'arms', 'cable'],
  ['overhead-triceps-extension', 'Overhead Cable Extension', 'arms', 'cable'],
  ['db-overhead-extension', 'Dumbbell Overhead Extension', 'arms', 'dumbbell'],
  ['bench-dip', 'Bench Dip', 'arms', 'bodyweight', ['chest']],
  ['wrist-curl', 'Wrist Curl', 'arms', 'dumbbell'],

  // Core
  ['plank', 'Plank', 'core', 'bodyweight'],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'core', 'bodyweight'],
  ['crunch', 'Crunch', 'core', 'bodyweight'],
  ['cable-crunch', 'Cable Crunch', 'core', 'cable'],
  ['ab-wheel', 'Ab Wheel Rollout', 'core', 'other'],
  ['russian-twist', 'Russian Twist', 'core', 'bodyweight'],
  ['pallof-press', 'Pallof Press', 'core', 'cable'],
  ['ab-machine', 'Ab Crunch Machine', 'core', 'machine'],
  ['farmers-walk', "Farmer's Walk", 'core', 'dumbbell', ['arms', 'legs']],
];

export const BUILTIN_EXERCISES: Exercise[] = SEED.map(([id, name, primaryMuscle, equipment, secondary]) => ({
  id,
  name,
  primaryMuscle,
  equipment,
  secondaryMuscles: secondary ?? [],
  custom: false,
  createdAt: 0,
}));

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  other: 'Other',
};

interface SampleRoutine {
  name: string;
  notes: string;
  exercises: [exerciseId: string, sets: number, reps: string, rest?: number][];
}

/** Starter templates offered when the routine list is empty. */
export const SAMPLE_ROUTINES: SampleRoutine[] = [
  {
    name: 'Push',
    notes: 'Chest, shoulders & triceps',
    exercises: [
      ['bench-press', 4, '5-8', 180],
      ['db-incline-press', 3, '8-12', 120],
      ['overhead-press', 3, '6-10', 150],
      ['lateral-raise', 3, '12-15', 60],
      ['triceps-pushdown', 3, '10-15', 60],
    ],
  },
  {
    name: 'Pull',
    notes: 'Back & biceps',
    exercises: [
      ['deadlift', 3, '3-5', 180],
      ['pull-up', 3, '6-10', 120],
      ['barbell-row', 3, '8-10', 120],
      ['face-pull', 3, '12-15', 60],
      ['db-curl', 3, '10-12', 60],
    ],
  },
  {
    name: 'Legs',
    notes: 'Quads, hamstrings & calves',
    exercises: [
      ['squat', 4, '5-8', 180],
      ['romanian-deadlift', 3, '8-10', 150],
      ['leg-press', 3, '10-12', 120],
      ['lying-leg-curl', 3, '10-12', 90],
      ['standing-calf-raise', 4, '10-15', 60],
    ],
  },
];

import { useMemo, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ACTIVITY_LEVELS, computeTargets, type NutritionProfile, type Targets } from '../lib/nutrition';
import { weightGoalStatus, weightTrend, type WeightGoal, type WeightGoalStatus } from '../lib/weightGoal';
import { useData } from './data';
import { safeLocalStorage } from './storage';

export interface NutritionPrefs {
  /** True once the user has gone through the goal setup. */
  configured: boolean;
  profile: NutritionProfile;
  /** Compute targets from the profile, or use `manual`. */
  auto: boolean;
  manual: Targets;
  /** Add estimated workout calories to the day's budget. */
  addExercise: boolean;
  /** Search Open Food Facts (online) in addition to the built-in foods. */
  onlineSearch: boolean;
  /** Target body weight (with the starting point for progress), or null. */
  weightGoal: WeightGoal | null;
}

const DEFAULT_PROFILE: NutritionProfile = {
  sex: 'male',
  age: 30,
  heightCm: 178,
  weightKg: 75,
  activity: 'moderate',
  goal: 'maintain',
  rate: 0.5,
};

export const DEFAULT_NUTRITION: NutritionPrefs = {
  configured: false,
  profile: DEFAULT_PROFILE,
  auto: true,
  manual: computeTargets(DEFAULT_PROFILE, DEFAULT_PROFILE.weightKg),
  addExercise: false,
  onlineSearch: true,
  weightGoal: null,
};

interface NutritionState extends NutritionPrefs {
  update: (patch: Partial<NutritionPrefs>) => void;
}

export const useNutrition = create<NutritionState>()(
  persist(
    (set) => ({
      ...DEFAULT_NUTRITION,
      update: (patch) => set(patch),
    }),
    {
      name: 'forge:nutrition',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ update: _u, ...prefs }) => prefs,
    },
  ),
);

export function getNutritionPrefs(): NutritionPrefs {
  const { update: _u, ...prefs } = useNutrition.getState();
  return prefs;
}

/** Latest logged body weight (kg), if any. */
export function useLatestWeight(): number | undefined {
  return useData((s) => s.measurements.find((m) => typeof m.values.weight === 'number')?.values.weight);
}

/** Today's targets: computed from the profile (using the latest weigh-in) or manual. */
export function useTargets(): Targets & { weightKg: number; fromMeasurement: boolean } {
  const profile = useNutrition((s) => s.profile);
  const auto = useNutrition((s) => s.auto);
  const manual = useNutrition((s) => s.manual);
  const measured = useLatestWeight();
  return useMemo(() => {
    const weightKg = measured ?? profile.weightKg;
    const targets = auto ? computeTargets(profile, weightKg) : manual;
    return { ...targets, weightKg, fromMeasurement: measured !== undefined };
  }, [profile, auto, manual, measured]);
}

/** Progress toward the target weight and the projected date, or null when no goal is set. */
export function useWeightGoal(): WeightGoalStatus | null {
  const goal = useNutrition((s) => s.weightGoal);
  const profile = useNutrition((s) => s.profile);
  const measurements = useData((s) => s.measurements);
  const measured = useLatestWeight();
  const [now] = useState(() => Date.now());
  return useMemo(() => {
    if (!goal) return null;
    const current = measured ?? profile.weightKg;
    const rate = profile.goal === 'maintain' ? 0 : profile.rate;
    return weightGoalStatus(goal, current, rate, weightTrend(measurements, now), now);
  }, [goal, profile, measurements, measured, now]);
}

/** Validates nutrition prefs from an imported backup. */
export function sanitizeNutrition(raw: unknown): Partial<NutritionPrefs> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: Partial<NutritionPrefs> = {};
  const n = (v: unknown, min: number, max: number) => (typeof v === 'number' && v >= min && v <= max ? v : undefined);
  if (typeof r.configured === 'boolean') out.configured = r.configured;
  if (typeof r.auto === 'boolean') out.auto = r.auto;
  if (typeof r.addExercise === 'boolean') out.addExercise = r.addExercise;
  if (typeof r.onlineSearch === 'boolean') out.onlineSearch = r.onlineSearch;
  const wg = r.weightGoal as Record<string, unknown> | null | undefined;
  if (wg === null) out.weightGoal = null;
  else if (wg && typeof wg === 'object') {
    const targetKg = n(wg.targetKg, 25, 350);
    const startKg = n(wg.startKg, 25, 350);
    const startedAt = n(wg.startedAt, 0, 8.64e15);
    if (targetKg !== undefined && startKg !== undefined && startedAt !== undefined) {
      out.weightGoal = { targetKg, startKg, startedAt };
    }
  }
  const p = r.profile as Record<string, unknown> | undefined;
  if (p && typeof p === 'object') {
    out.profile = {
      sex: p.sex === 'female' ? 'female' : 'male',
      age: n(p.age, 10, 110) ?? DEFAULT_PROFILE.age,
      heightCm: n(p.heightCm, 100, 250) ?? DEFAULT_PROFILE.heightCm,
      weightKg: n(p.weightKg, 25, 350) ?? DEFAULT_PROFILE.weightKg,
      activity: ACTIVITY_LEVELS.some((a) => a.id === p.activity)
        ? (p.activity as NutritionProfile['activity'])
        : DEFAULT_PROFILE.activity,
      goal: p.goal === 'lose' || p.goal === 'gain' ? p.goal : 'maintain',
      rate: n(p.rate, 0, 1.5) ?? DEFAULT_PROFILE.rate,
    };
  }
  const m = r.manual as Record<string, unknown> | undefined;
  if (m && typeof m === 'object') {
    out.manual = {
      kcal: n(m.kcal, 500, 10000) ?? DEFAULT_NUTRITION.manual.kcal,
      protein: n(m.protein, 0, 1000) ?? DEFAULT_NUTRITION.manual.protein,
      carbs: n(m.carbs, 0, 2000) ?? DEFAULT_NUTRITION.manual.carbs,
      fat: n(m.fat, 0, 1000) ?? DEFAULT_NUTRITION.manual.fat,
      waterMl: n(m.waterMl, 0, 10000) ?? DEFAULT_NUTRITION.manual.waterMl,
    };
  }
  return out;
}

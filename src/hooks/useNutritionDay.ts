import { useMemo } from 'react';
import { dayKey, entriesByDay, sumNutrients, workoutCalories } from '../lib/nutrition';
import { useData, useHistoryIndex } from '../store/data';
import { useNutrition, useTargets } from '../store/nutrition';
import type { FoodEntry, Nutrients } from '../types';

const EMPTY: FoodEntry[] = [];

export interface DayNutrition {
  entries: FoodEntry[];
  totals: Nutrients;
  targets: ReturnType<typeof useTargets>;
  /** Estimated kcal burned by workouts that day. */
  burned: number;
  /** Calorie budget: target (+ workouts when enabled). */
  budget: number;
  remaining: number;
  waterMl: number;
}

/** Everything the Food page and widgets need for one day. */
export function useNutritionDay(day: string): DayNutrition {
  const allEntries = useData((s) => s.foodEntries);
  const water = useData((s) => s.water);
  const history = useHistoryIndex();
  const targets = useTargets();
  const addExercise = useNutrition((s) => s.addExercise);

  return useMemo(() => {
    const entries = entriesByDay(allEntries).get(day) ?? EMPTY;
    const totals = sumNutrients(entries);
    let burned = 0;
    for (const w of history.sorted) {
      if (dayKey(w.startedAt) === day) burned += workoutCalories(w, targets.weightKg);
    }
    const budget = targets.kcal + (addExercise ? burned : 0);
    return {
      entries,
      totals,
      targets,
      burned,
      budget,
      remaining: budget - totals.kcal,
      waterMl: water.find((w) => w.id === day)?.ml ?? 0,
    };
  }, [allEntries, water, history, targets, addExercise, day]);
}

import type { Food, FoodEntry, MealItem, MealSlot, Nutrients, PortionUnit, Workout } from '../types';
import { addDays, fromDateInput, toDateInput } from './format';
import { round } from './utils';

// ---------------------------------------------------------------------------
// Portions & totals
// ---------------------------------------------------------------------------

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out: Nutrients = {
    kcal: round(per100.kcal * f, 1),
    protein: round(per100.protein * f, 1),
    carbs: round(per100.carbs * f, 1),
    fat: round(per100.fat * f, 1),
  };
  if (per100.fiber !== undefined) out.fiber = round(per100.fiber * f, 1);
  if (per100.sugar !== undefined) out.sugar = round(per100.sugar * f, 1);
  return out;
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export const sumNutrients = (items: { nutrients: Nutrients }[]) =>
  items.reduce<Nutrients>((acc, e) => addNutrients(acc, e.nutrients), { ...ZERO });

export function portionGrams(food: Pick<Food, 'serving'>, quantity: number, unit: PortionUnit): number {
  return unit === 'serving' ? quantity * (food.serving?.grams ?? 100) : quantity;
}

/** A meal item (portion of a food) with its nutrient snapshot. */
export function makeItem(food: Food, quantity: number, unit: PortionUnit): MealItem {
  const grams = portionGrams(food, quantity, unit);
  return {
    foodId: food.id,
    name: food.name,
    brand: food.brand,
    quantity,
    unit,
    grams,
    servingLabel: unit === 'serving' ? food.serving?.label : undefined,
    liquid: food.liquid,
    nutrients: scaleNutrients(food.per100, grams),
  };
}

export function portionLabel(e: Pick<FoodEntry, 'quantity' | 'unit' | 'grams' | 'servingLabel' | 'liquid'>): string {
  if (!e.grams) return 'Quick add';
  const g = `${Math.round(e.grams)} ${e.liquid ? 'ml' : 'g'}`;
  if (e.unit === 'serving') {
    const q = e.quantity === 1 ? '' : `${round(e.quantity, 2)} × `;
    return `${q}${e.servingLabel ?? 'serving'} · ${g}`;
  }
  return g;
}

/** Rebuilds a food definition from a logged entry (when the food itself is gone). */
export function foodFromEntry(e: FoodEntry | MealItem): Food {
  // scaleNutrients multiplies by grams / 100, so 10000 / grams yields the per-100 g values.
  const per100 = e.grams > 0 ? scaleNutrients(e.nutrients, 10000 / e.grams) : e.nutrients;
  return {
    id: e.foodId ?? `entry-${e.name}`,
    name: e.name,
    brand: e.brand,
    per100,
    serving:
      e.unit === 'serving' && e.quantity > 0
        ? { grams: e.grams / e.quantity, label: e.servingLabel ?? 'serving' }
        : undefined,
    liquid: e.liquid,
    source: 'custom',
    createdAt: 0,
  };
}

/** Last portion used per food — new logs of a food default to it. */
export function lastPortions(entries: FoodEntry[]): Map<string, { quantity: number; unit: PortionUnit }> {
  const map = new Map<string, { quantity: number; unit: PortionUnit; at: number }>();
  for (const e of entries) {
    if (!e.foodId || !e.grams) continue;
    const prev = map.get(e.foodId);
    if (!prev || e.createdAt > prev.at) map.set(e.foodId, { quantity: e.quantity, unit: e.unit, at: e.createdAt });
  }
  return map;
}

/** Default portion for a food: last used, else one serving, else 100 g. */
export function defaultPortion(
  food: Food,
  last?: { quantity: number; unit: PortionUnit },
): { quantity: number; unit: PortionUnit } {
  if (last && (last.unit === 'g' || food.serving)) return last;
  return food.serving ? { quantity: 1, unit: 'serving' } : { quantity: 100, unit: 'g' };
}

/** Everyday basics suggested before anything has been logged. */
export const POPULAR_FOOD_IDS = [
  'egg',
  'oats',
  'banana',
  'chicken-breast',
  'rice-white',
  'rye-bread',
  'milk-semi',
  'quark',
  'skyr',
  'whey',
  'apple',
  'salmon',
  'potato',
  'pasta',
  'peanut-butter',
  'coffee',
].map((id) => `food-${id}`);

export const MACROS = [
  { key: 'protein', label: 'Protein', short: 'P', color: 'var(--macro-protein)' },
  { key: 'carbs', label: 'Carbs', short: 'C', color: 'var(--macro-carbs)' },
  { key: 'fat', label: 'Fat', short: 'F', color: 'var(--macro-fat)' },
] as const;

export const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

/** Suggests the meal for "now" (used when adding from outside a meal section). */
export function mealForTime(ts = Date.now()): MealSlot {
  const h = new Date(ts).getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export const dayKey = (ts: number) => toDateInput(ts);
export const shiftDay = (day: string, delta: number) => toDateInput(addDays(fromDateInput(day), delta));

const dayCache = new WeakMap<FoodEntry[], Map<string, FoodEntry[]>>();

/** Entries grouped by day (memoised on array identity). */
export function entriesByDay(entries: FoodEntry[]): Map<string, FoodEntry[]> {
  let map = dayCache.get(entries);
  if (!map) {
    map = new Map();
    for (const e of [...entries].sort((a, b) => a.createdAt - b.createdAt)) {
      const list = map.get(e.day);
      if (list) list.push(e);
      else map.set(e.day, [e]);
    }
    dayCache.set(entries, map);
  }
  return map;
}

/** The `count` days ending at `last` (oldest first). */
export function dayRange(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftDay(last, i - count + 1));
}

/** Per-day totals for the given days (days without entries are null). */
export function dailyTotals(entries: FoodEntry[], days: string[]): { day: string; totals: Nutrients | null }[] {
  const byDay = entriesByDay(entries);
  return days.map((day) => {
    const list = byDay.get(day);
    return { day, totals: list?.length ? sumNutrients(list) : null };
  });
}

// ---------------------------------------------------------------------------
// Targets (Mifflin-St Jeor)
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type GoalType = 'lose' | 'maintain' | 'gain';

export const ACTIVITY_LEVELS: { id: Activity; label: string; detail: string; factor: number }[] = [
  { id: 'sedentary', label: 'Sedentary', detail: 'Desk job, little movement', factor: 1.2 },
  { id: 'light', label: 'Lightly active', detail: 'Training 1–3× a week', factor: 1.375 },
  { id: 'moderate', label: 'Moderately active', detail: 'Training 3–5× a week', factor: 1.55 },
  { id: 'active', label: 'Very active', detail: 'Hard training 6–7× a week', factor: 1.725 },
  { id: 'athlete', label: 'Athlete', detail: 'Physical job + daily training', factor: 1.9 },
];

export interface NutritionProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  /** Used when there's no body-weight measurement. */
  weightKg: number;
  activity: Activity;
  goal: GoalType;
  /** kg per week (for lose / gain). */
  rate: number;
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
}

const KCAL_PER_KG = 7700;

export function bmr(p: Pick<NutritionProfile, 'sex' | 'age' | 'heightCm'>, weightKg: number): number {
  return 10 * weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

export function tdee(p: NutritionProfile, weightKg: number): number {
  const factor = ACTIVITY_LEVELS.find((a) => a.id === p.activity)?.factor ?? 1.55;
  return bmr(p, weightKg) * factor;
}

/**
 * Daily targets: maintenance ± the energy for the chosen weekly rate,
 * protein 2.0 g/kg when cutting (1.8 otherwise), fat ≥ 25 % of energy and
 * ≥ 0.7 g/kg, carbs fill the rest. Never below a safe floor.
 */
export function computeTargets(p: NutritionProfile, weightKg: number): Targets {
  const maintenance = tdee(p, weightKg);
  const delta = p.goal === 'maintain' ? 0 : ((p.goal === 'lose' ? -1 : 1) * p.rate * KCAL_PER_KG) / 7;
  const floor = p.sex === 'male' ? 1500 : 1200;
  const kcal = Math.max(floor, Math.round((maintenance + delta) / 10) * 10);
  const protein = Math.round(weightKg * (p.goal === 'lose' ? 2 : 1.8));
  const fat = Math.round(Math.max((kcal * 0.25) / 9, weightKg * 0.7));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, waterMl: Math.round((weightKg * 35) / 250) * 250 };
}

// ---------------------------------------------------------------------------
// Exercise energy
// ---------------------------------------------------------------------------

/** MET for vigorous resistance training (Compendium of Physical Activities). */
const STRENGTH_MET = 5;

/** Estimated kcal burned by a workout: MET × body weight × hours (net of resting). */
export function workoutCalories(w: Workout, weightKg: number): number {
  const hours = Math.max(0, ((w.endedAt ?? w.startedAt) - w.startedAt) / 3_600_000);
  return Math.round((STRENGTH_MET - 1) * weightKg * Math.min(hours, 3));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Ranks foods for a query: prefix of name > word prefix > substring; ties by recency. */
export function searchFoods(query: string, foods: Food[], recent: Map<string, number> = new Map(), limit = 40): Food[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const f of foods) {
    const hay = normalize(`${f.name} ${f.brand ?? ''}`);
    if (!tokens.every((t) => hay.includes(t))) continue;
    const name = normalize(f.name);
    let score = 0;
    if (name.startsWith(tokens[0])) score += 30;
    else if (new RegExp(`\\b${tokens[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name)) score += 15;
    score += Math.max(0, 10 - name.length / 6);
    const used = recent.get(f.id);
    if (used) score += 25;
    if (f.source !== 'builtin') score += 3;
    scored.push({ food: f, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.food);
}

/** Most recently logged distinct foods (by foodId, falling back to name). */
export function recentFoods(entries: FoodEntry[], foods: Map<string, Food>, limit = 15): Food[] {
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const e of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
    if (!e.foodId || seen.has(e.foodId)) continue;
    seen.add(e.foodId);
    const f = foods.get(e.foodId);
    if (f) out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

export function kcalLabel(n: number) {
  return `${Math.round(n).toLocaleString()} kcal`;
}

export function macroKcal(n: Nutrients) {
  return { protein: n.protein * 4, carbs: n.carbs * 4, fat: n.fat * 9 };
}

export { toDateInput as dayOf };

import { describe, expect, it } from 'vitest';
import { BUILTIN_FOODS } from '../data/foods';
import type { Workout } from '../types';
import {
  bmr,
  computeTargets,
  dailyTotals,
  dayRange,
  foodFromEntry,
  lastPortions,
  makeItem,
  portionLabel,
  scaleNutrients,
  searchFoods,
  shiftDay,
  sumNutrients,
  workoutCalories,
  type NutritionProfile,
} from './nutrition';

const food = (id: string) => BUILTIN_FOODS.find((f) => f.id === `food-${id}`)!;

describe('portions', () => {
  it('scales per-100 g values', () => {
    expect(scaleNutrients({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }, 150)).toEqual({
      kcal: 247.5,
      protein: 46.5,
      carbs: 0,
      fat: 5.4,
    });
  });

  it('resolves servings to grams and snapshots nutrients', () => {
    const item = makeItem(food('egg'), 2, 'serving');
    expect(item.grams).toBe(100);
    expect(item.nutrients.kcal).toBe(143);
    expect(portionLabel(item)).toBe('2 × 1 large egg · 100 g');
    expect(portionLabel(makeItem(food('milk-semi'), 300, 'g'))).toBe('300 ml');
  });

  it('rebuilds a food from an entry and remembers last portions', () => {
    const item = makeItem(food('egg'), 2, 'serving');
    const rebuilt = foodFromEntry(item);
    expect(rebuilt.per100.kcal).toBeCloseTo(143, 5);
    expect(rebuilt.serving).toEqual({ grams: 50, label: '1 large egg' });
    const entries = [
      { ...item, id: 'a', day: '2026-10-01', meal: 'breakfast' as const, createdAt: 1 },
      { ...makeItem(food('egg'), 150, 'g'), id: 'b', day: '2026-10-02', meal: 'breakfast' as const, createdAt: 2 },
    ];
    expect(lastPortions(entries).get('food-egg')).toMatchObject({ quantity: 150, unit: 'g' });
  });

  it('sums a day', () => {
    const total = sumNutrients([makeItem(food('oats'), 1, 'serving'), makeItem(food('banana'), 1, 'serving')]);
    expect(Math.round(total.kcal)).toBe(Math.round(389 * 0.4 + 89 * 1.2));
  });

  it('totals days and ranges', () => {
    const e = (day: string, kcal: number) => ({
      ...makeItem(food('banana'), 1, 'serving'),
      id: day + kcal,
      day,
      meal: 'snack' as const,
      createdAt: kcal,
      nutrients: { kcal, protein: 1, carbs: 2, fat: 3 },
    });
    const days = dayRange('2026-10-08', 3);
    expect(days).toEqual(['2026-10-06', '2026-10-07', '2026-10-08']);
    const totals = dailyTotals([e('2026-10-06', 100), e('2026-10-06', 50), e('2026-10-08', 300)], days);
    expect(totals.map((t) => t.totals?.kcal ?? null)).toEqual([150, null, 300]);
  });

  it('moves between days', () => {
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('targets', () => {
  const profile: NutritionProfile = {
    sex: 'male',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activity: 'moderate',
    goal: 'maintain',
    rate: 0.5,
  };

  it('uses Mifflin-St Jeor', () => {
    expect(bmr(profile, 80)).toBe(1780); // 800 + 1125 − 150 + 5
    expect(bmr({ ...profile, sex: 'female' }, 80)).toBe(1614);
  });

  it('derives calories and macros from activity and goal', () => {
    const maintain = computeTargets(profile, 80);
    expect(maintain.kcal).toBe(2760); // 1780 × 1.55 = 2759 → nearest 10
    expect(maintain.protein).toBe(144);
    expect(maintain.protein * 4 + maintain.carbs * 4 + maintain.fat * 9).toBeGreaterThan(2740);
    const cut = computeTargets({ ...profile, goal: 'lose', rate: 0.5 }, 80);
    expect(cut.kcal).toBe(2210); // −550 kcal/day for 0.5 kg/week
    expect(cut.protein).toBe(160);
    const bulk = computeTargets({ ...profile, goal: 'gain', rate: 0.25 }, 80);
    expect(bulk.kcal).toBe(3030); // 2759 + 275
  });

  it('never goes below a safe floor', () => {
    expect(
      computeTargets(
        { ...profile, sex: 'female', heightCm: 150, age: 60, activity: 'sedentary', goal: 'lose', rate: 1 },
        45,
      ).kcal,
    ).toBe(1200);
  });
});

describe('workout calories', () => {
  it('estimates net energy from duration and body weight', () => {
    const w = { startedAt: 0, endedAt: 3_600_000 } as Workout;
    expect(workoutCalories(w, 80)).toBe(320);
  });
});

describe('food search', () => {
  it('ranks name prefixes first and finds Finnish names', () => {
    const r = searchFoods('rye', BUILTIN_FOODS);
    expect(r[0].name).toMatch(/^Rye bread/);
    expect(searchFoods('ruisleipä', BUILTIN_FOODS)[0].id).toBe('food-rye-bread');
    expect(
      searchFoods('chicken', BUILTIN_FOODS)
        .slice(0, 2)
        .every((f) => f.name.startsWith('Chicken')),
    ).toBe(true);
  });
});

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { makeItem, MEAL_LABELS } from '../../lib/nutrition';
import { formatNumber } from '../../lib/units';
import { round } from '../../lib/utils';
import { MEAL_SLOTS, type Food, type MealItem, type MealSlot, type PortionUnit } from '../../types';
import { Button } from '../ui/Button';
import { Chip } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import { Stepper } from '../ui/Stepper';
import { MacroTiles, SourceBadge } from './bits';

interface Props {
  food: Food;
  initial: { quantity: number; unit: PortionUnit };
  meal: MealSlot;
  onMealChange: (meal: MealSlot) => void;
  submitLabel: string;
  onSubmit: (item: MealItem) => void;
  onDelete?: () => void;
}

const SERVING_CHIPS = [0.5, 1, 1.5, 2, 3];
const GRAM_CHIPS = [50, 100, 150, 200, 250];

/** Pick an amount (servings or grams), see the nutrition live, choose the meal. */
export function PortionEditor({ food, initial, meal, onMealChange, submitLabel, onSubmit, onDelete }: Props) {
  const [unit, setUnit] = useState<PortionUnit>(food.serving ? initial.unit : 'g');
  const [quantity, setQuantity] = useState<number | null>(
    food.serving || initial.unit === 'g' ? initial.quantity : initial.quantity * 100,
  );
  const g = food.liquid ? 'ml' : 'g';
  const item = makeItem(food, quantity ?? 0, unit);
  const valid = (quantity ?? 0) > 0;

  const switchUnit = (next: PortionUnit) => {
    if (!food.serving || next === unit) return;
    const grams = item.grams;
    setUnit(next);
    setQuantity(
      next === 'g' ? Math.round(grams) || 100 : Math.max(0.25, round(grams / food.serving.grams / 0.25, 0) * 0.25),
    );
  };

  const chips = unit === 'serving' ? SERVING_CHIPS : GRAM_CHIPS;

  return (
    <div className="space-y-5 pb-2">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg leading-snug font-bold">{food.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-2">
              {food.brand && <span>{food.brand}</span>}
              <SourceBadge source={food.source} />
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted tabular">
          Per 100 {g}: {Math.round(food.per100.kcal)} kcal · protein {formatNumber(food.per100.protein, 1)} g · carbs{' '}
          {formatNumber(food.per100.carbs, 1)} g · fat {formatNumber(food.per100.fat, 1)} g
        </p>
      </div>

      <div className="space-y-2.5">
        {food.serving && (
          <Segmented
            label="Portion unit"
            value={unit}
            onChange={switchUnit}
            options={[
              { value: 'serving', label: <span className="block max-w-[11rem] truncate">{food.serving.label}</span> },
              { value: 'g', label: g === 'ml' ? 'Millilitres' : 'Grams' },
            ]}
          />
        )}
        <Stepper
          size="lg"
          value={quantity}
          onChange={setQuantity}
          step={unit === 'serving' ? 0.5 : 10}
          min={0}
          max={unit === 'serving' ? 50 : 5000}
          decimals={unit === 'serving' ? 2 : 0}
          label={unit === 'serving' ? `Number of ${food.serving?.label ?? 'servings'}` : `Amount in ${g}`}
        />
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Quick amounts">
          {chips.map((c) => (
            <Chip key={c} selected={quantity === c} onClick={() => setQuantity(c)}>
              {unit === 'serving' ? (c === 0.5 ? '½' : c === 1.5 ? '1½' : c) : `${c} ${g}`}
            </Chip>
          ))}
        </div>
        {unit === 'serving' && food.serving && (
          <p className="px-1 text-xs text-muted tabular">
            = {Math.round(item.grams)} {g}
          </p>
        )}
      </div>

      <div className="surface rounded-2xl p-4" aria-live="polite">
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight tabular">{Math.round(item.nutrients.kcal)}</span>
          <span className="text-sm font-semibold text-fg-2">kcal</span>
        </div>
        <MacroTiles nutrients={item.nutrients} className="mt-3" />
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[13px] font-semibold text-fg-2">Meal</p>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Meal">
          {MEAL_SLOTS.map((m) => (
            <Chip key={m} selected={meal === m} onClick={() => onMealChange(m)}>
              {MEAL_LABELS[m]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {onDelete && <Button size="lg" variant="danger" icon={Trash2} aria-label="Delete entry" onClick={onDelete} />}
        <Button
          size="lg"
          variant="primary"
          block
          disabled={!valid}
          feedback="success"
          onClick={() => valid && onSubmit(item)}
        >
          {submitLabel} · {Math.round(item.nutrients.kcal)} kcal
        </Button>
      </div>
    </div>
  );
}

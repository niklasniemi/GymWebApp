import { useId, useState, type FormEvent } from 'react';
import { foodFromEntry, MEAL_LABELS } from '../../lib/nutrition';
import { uid } from '../../lib/utils';
import { getFoodMap, useData } from '../../store/data';
import { toast } from '../../store/toast';
import type { FoodEntry, MealItem, SavedMeal } from '../../types';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { QuickAddForm } from './FoodForms';
import { PortionEditor } from './PortionEditor';

/** Keeps the last non-null value so content stays put during the exit animation. */
function useLatched<T>(value: T | null): T | null {
  const [latched, setLatched] = useState(value);
  if (value !== null && value !== latched) setLatched(value);
  return value ?? latched;
}

/** Edit (amount, meal) or delete a logged entry. */
export function EntrySheet({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  const shown = useLatched(entry);
  return (
    <Sheet open={entry !== null} onClose={onClose} title="Edit entry">
      {shown && <EntryEditor key={shown.id} entry={shown} onDone={onClose} />}
    </Sheet>
  );
}

function EntryEditor({ entry, onDone }: { entry: FoodEntry; onDone: () => void }) {
  const foods = useData((s) => s.foods);
  const [meal, setMeal] = useState(entry.meal);
  const food = (entry.foodId && getFoodMap(foods).get(entry.foodId)) || foodFromEntry(entry);

  const save = (item: MealItem) => {
    useData.getState().saveFoodEntries([{ ...entry, ...item, meal }]);
    toast.success('Entry updated');
    onDone();
  };

  const remove = () => {
    const { deleteFoodEntries, saveFoodEntries } = useData.getState();
    deleteFoodEntries([entry.id]);
    toast.undo(`Removed ${entry.name}`, () => saveFoodEntries([entry]));
    onDone();
  };

  if (!entry.grams) {
    return (
      <div className="pt-1">
        <QuickAddForm initial={entry} submitLabel="Save" onSubmit={save} onDelete={remove} />
        <p className="mt-3 px-1 text-xs text-muted">Logged to {MEAL_LABELS[meal]}.</p>
      </div>
    );
  }

  return (
    <div className="pt-1">
      <PortionEditor
        food={food}
        initial={{ quantity: entry.quantity, unit: entry.unit }}
        meal={meal}
        onMealChange={setMeal}
        submitLabel="Save"
        onSubmit={save}
        onDelete={remove}
      />
    </div>
  );
}

/** Name and save a meal's items for one-tap logging later. */
export function SaveMealSheet({ items, onClose }: { items: MealItem[] | null; onClose: () => void }) {
  const shown = useLatched(items);
  return (
    <Sheet
      open={items !== null}
      onClose={onClose}
      title="Save as meal"
      description="Add the same foods again later with one tap."
    >
      {shown && <SaveMealForm key={shown.map((i) => i.name).join('|')} items={shown} onDone={onClose} />}
    </Sheet>
  );
}

function SaveMealForm({ items, onDone }: { items: MealItem[]; onDone: () => void }) {
  const id = useId();
  const [name, setName] = useState(() =>
    items
      .slice(0, 3)
      .map((i) => i.name.split(',')[0].replace(/\s*\(.*?\)/g, ''))
      .join(' + ')
      .slice(0, 60),
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const meal: SavedMeal = {
      id: uid(),
      name: name.trim() || 'My meal',
      // Strip per-entry identity; keep portions and nutrient snapshots.
      items: items.map(({ foodId, name: n, brand, quantity, unit, grams, servingLabel, liquid, nutrients }) => ({
        foodId,
        name: n,
        brand,
        quantity,
        unit,
        grams,
        servingLabel,
        liquid,
        nutrients,
      })),
      createdAt: Date.now(),
    };
    useData.getState().saveMeal(meal);
    toast.success(`Saved “${meal.name}”`, 'Find it under Meals when adding food');
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <Field label="Meal name" htmlFor={`${id}-name`}>
        <TextInput
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          data-autofocus
        />
      </Field>
      <ul className="space-y-1 rounded-2xl bg-fill p-3 text-sm">
        {items.map((i, n) => (
          <li key={n} className="flex justify-between gap-3">
            <span className="truncate">{i.name}</span>
            <span className="shrink-0 text-fg-2 tabular">{Math.round(i.nutrients.kcal)} kcal</span>
          </li>
        ))}
      </ul>
      <Button type="submit" size="lg" variant="primary" block feedback="success">
        Save meal
      </Button>
    </form>
  );
}

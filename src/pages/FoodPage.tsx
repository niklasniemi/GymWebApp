import { useMemo, useState } from 'react';
import {
  Bookmark,
  CalendarArrowDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Copy,
  Cookie,
  Droplet,
  Eraser,
  Minus,
  MoreHorizontal,
  Plus,
  Salad,
  ScanBarcode,
  Search,
  Soup,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { AddFoodSheet, type AddStart } from '../components/food/AddFoodSheet';
import { MacroLine } from '../components/food/bits';
import { EntrySheet, SaveMealSheet } from '../components/food/EntrySheet';
import { GoalsSheet } from '../components/food/GoalsSheet';
import { CalorieBars, CalorieSummary } from '../components/food/NutritionWidgets';
import { Button } from '../components/ui/Button';
import { ActionList, Card, PageHeader, SectionTitle } from '../components/ui/primitives';
import { Sheet } from '../components/ui/Sheet';
import { SwipeToDelete } from '../components/ui/SwipeToDelete';
import { useNutritionDay } from '../hooks/useNutritionDay';
import { formatRelativeDay, fromDateInput, pluralize, startOfWeek } from '../lib/format';
import { haptic } from '../lib/haptics';
import {
  dailyTotals,
  dayKey,
  entriesByDay,
  MEAL_LABELS,
  mealForTime,
  portionLabel,
  shiftDay,
  sumNutrients,
} from '../lib/nutrition';
import { formatNumber } from '../lib/units';
import { cn, uid } from '../lib/utils';
import { useData } from '../store/data';
import { useNutrition } from '../store/nutrition';
import { toast } from '../store/toast';
import { confirm, navigate, useSubRoute } from '../store/ui';
import { MEAL_SLOTS, type FoodEntry, type MealItem, type MealSlot } from '../types';

const MEAL_ICONS: Record<MealSlot, LucideIcon> = {
  breakfast: Coffee,
  lunch: Salad,
  dinner: Soup,
  snack: Cookie,
};

const GLASS_ML = 250;

function copyEntries(src: FoodEntry[], toDay: string, label: string) {
  const { saveFoodEntries, deleteFoodEntries } = useData.getState();
  const now = Date.now();
  const copies = src.map((e, i) => ({ ...e, id: uid(), day: toDay, createdAt: now + i }));
  saveFoodEntries(copies);
  haptic('success');
  toast.undo(label, () => deleteFoodEntries(copies.map((c) => c.id)), pluralize(copies.length, 'item'));
}

function removeEntry(e: FoodEntry) {
  const { deleteFoodEntries, saveFoodEntries } = useData.getState();
  deleteFoodEntries([e.id]);
  toast.undo(`Removed ${e.name}`, () => saveFoodEntries([e]));
}

export default function FoodPage() {
  const [sub] = useSubRoute();
  const [today] = useState(() => dayKey(Date.now()));
  const [day, setDay] = useState(today);
  const [addOpen, setAddOpen] = useState(false);
  const [addCfg, setAddCfg] = useState<{ meal: MealSlot; start: AddStart }>({ meal: 'breakfast', start: 'search' });
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [saveItems, setSaveItems] = useState<MealItem[] | null>(null);
  const [menuMeal, setMenuMeal] = useState<MealSlot | null>(null);
  const configured = useNutrition((s) => s.configured);
  const allEntries = useData((s) => s.foodEntries);
  const data = useNutritionDay(day);

  const byDay = entriesByDay(allEntries);
  const prevDay = shiftDay(day, -1);
  const prevEntries = byDay.get(prevDay) ?? [];
  const byMeal = useMemo(() => {
    const m = new Map<MealSlot, FoodEntry[]>(MEAL_SLOTS.map((s) => [s, []]));
    for (const e of data.entries) m.get(e.meal)?.push(e);
    return m;
  }, [data.entries]);

  const openAdd = (meal: MealSlot, start: AddStart = 'search') => {
    setAddCfg({ meal, start });
    setAddOpen(true);
  };
  const defaultMeal = day === today ? mealForTime() : 'snack';

  const dayLabel = formatRelativeDay(fromDateInput(day), fromDateInput(today));

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Food"
        subtitle={
          day === today
            ? new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
            : dayLabel
        }
        actions={
          <Button
            size="icon"
            variant="secondary"
            icon={Target}
            aria-label="Calorie and macro goals"
            onClick={() => navigate('food', 'goals')}
          />
        }
      />

      <DayStrip day={day} today={today} onChange={setDay} target={data.targets.kcal} />

      <CalorieSummary data={data} />

      <div className="flex gap-2">
        <Button size="lg" variant="primary" block icon={Search} onClick={() => openAdd(defaultMeal)}>
          Log food
        </Button>
        <Button
          size="lg"
          variant="soft"
          icon={ScanBarcode}
          aria-label="Scan a barcode"
          onClick={() => openAdd(defaultMeal, 'scan')}
        />
        <Button
          size="lg"
          variant="soft"
          icon={Zap}
          aria-label="Quick add calories"
          onClick={() => openAdd(defaultMeal, 'quick')}
        />
      </div>

      {!configured && (
        <Card className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <Target size={22} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Personalise your targets</p>
            <p className="text-sm text-fg-2">Add your height, age and goal for accurate calories and macros.</p>
          </div>
          <Button size="sm" variant="soft" onClick={() => navigate('food', 'goals')}>
            Set up
          </Button>
        </Card>
      )}

      {data.entries.length === 0 && prevEntries.length > 0 && (
        <button
          type="button"
          onClick={() =>
            copyEntries(
              prevEntries,
              day,
              `Copied ${formatRelativeDay(fromDateInput(prevDay), fromDateInput(today)).toLowerCase()}`,
            )
          }
          className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-[0.98]"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-fill text-fg-2">
            <Copy size={20} aria-hidden />
          </div>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              Same as {formatRelativeDay(fromDateInput(prevDay), fromDateInput(today)).toLowerCase()}?
            </span>
            <span className="block text-sm text-fg-2">
              Copy {pluralize(prevEntries.length, 'item')} ·{' '}
              {Math.round(sumNutrients(prevEntries).kcal).toLocaleString()} kcal
            </span>
          </span>
          <ChevronRight size={18} className="text-muted" aria-hidden />
        </button>
      )}

      <div className="space-y-3">
        {MEAL_SLOTS.map((meal) => (
          <MealCard
            key={meal}
            meal={meal}
            entries={byMeal.get(meal) ?? []}
            onAdd={() => openAdd(meal)}
            onEdit={setEditing}
            onDelete={removeEntry}
            onMenu={() => setMenuMeal(meal)}
          />
        ))}
      </div>

      <WaterCard day={day} ml={data.waterMl} target={data.targets.waterMl} />

      <WeekCard day={day} today={today} target={data.targets.kcal} onSelect={setDay} />

      <AddFoodSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        day={day}
        meal={addCfg.meal}
        start={addCfg.start}
      />
      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
      <SaveMealSheet items={saveItems} onClose={() => setSaveItems(null)} />
      <GoalsSheet open={sub === 'goals'} onClose={() => navigate('food', undefined, undefined, { replace: true })} />
      <MealMenu
        meal={menuMeal}
        onClose={() => setMenuMeal(null)}
        entries={menuMeal ? (byMeal.get(menuMeal) ?? []) : []}
        prevEntries={menuMeal ? prevEntries.filter((e) => e.meal === menuMeal) : []}
        prevLabel={formatRelativeDay(fromDateInput(prevDay), fromDateInput(today)).toLowerCase()}
        isToday={day === today}
        onAdd={(meal) => openAdd(meal)}
        onSave={setSaveItems}
        onCopy={copyEntries}
        day={day}
        today={today}
      />
    </div>
  );
}

function DayStrip({
  day,
  today,
  onChange,
  target,
}: {
  day: string;
  today: string;
  onChange: (d: string) => void;
  target: number;
}) {
  const entries = useData((s) => s.foodEntries);
  const weekStart = dayKey(startOfWeek(fromDateInput(day)));
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i));
  const totals = dailyTotals(entries, days);
  const nextWeek = shiftDay(weekStart, 7);

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        icon={ChevronLeft}
        aria-label="Previous week"
        onClick={() => onChange(shiftDay(day, -7))}
      />
      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1" role="group" aria-label="Choose day">
        {totals.map(({ day: d, totals: t }) => {
          const future = d > today;
          const selected = d === day;
          const date = new Date(fromDateInput(d));
          const kcal = t?.kcal ?? 0;
          const near = t && Math.abs(kcal - target) <= target * 0.1;
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              aria-pressed={selected}
              aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}${
                t ? `, ${Math.round(kcal)} kcal` : ''
              }`}
              onClick={() => {
                haptic('select');
                onChange(d);
              }}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl transition-transform active:scale-95 disabled:opacity-35',
                selected ? 'bg-fg text-bg' : d === today ? 'text-accent-text' : 'text-fg-2',
              )}
            >
              <span className="text-[11px] font-semibold uppercase">
                {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
              <span className="text-[17px] font-bold tabular">{date.getDate()}</span>
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ background: t ? (near ? 'var(--success)' : 'var(--chart-1)') : 'transparent' }}
              />
            </button>
          );
        })}
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        icon={ChevronRight}
        aria-label="Next week"
        disabled={nextWeek > today}
        onClick={() => onChange(shiftDay(day, 7) > today ? today : shiftDay(day, 7))}
      />
    </div>
  );
}

function MealCard({
  meal,
  entries,
  onAdd,
  onEdit,
  onDelete,
  onMenu,
}: {
  meal: MealSlot;
  entries: FoodEntry[];
  onAdd: () => void;
  onEdit: (e: FoodEntry) => void;
  onDelete: (e: FoodEntry) => void;
  onMenu: () => void;
}) {
  const Icon = MEAL_ICONS[meal];
  const totals = sumNutrients(entries);
  return (
    <section aria-label={MEAL_LABELS[meal]} className="surface overflow-hidden rounded-2xl">
      <header className="flex min-h-15 items-center gap-3 py-2 pr-1.5 pl-4">
        <Icon size={20} className="shrink-0 text-accent-text" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{MEAL_LABELS[meal]}</h2>
          {entries.length > 0 && <MacroLine n={totals} className="block text-xs text-fg-2" />}
        </div>
        {entries.length > 0 && (
          <span className="text-[15px] font-bold tabular">
            {Math.round(totals.kcal).toLocaleString()}
            <span className="text-xs font-semibold text-fg-2"> kcal</span>
          </span>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          icon={MoreHorizontal}
          aria-label={`${MEAL_LABELS[meal]} options`}
          onClick={onMenu}
        />
      </header>
      {entries.length > 0 && (
        <ul className="border-t border-line">
          {entries.map((e) => (
            <li key={e.id} className="border-b border-line last:border-b-0">
              <SwipeToDelete label={`Delete ${e.name}`} onDelete={() => onDelete(e)}>
                <button
                  type="button"
                  onClick={() => onEdit(e)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-fill"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{e.name}</span>
                    <span className="block truncate text-[13px] text-fg-2">
                      {e.brand ? `${e.brand} · ` : ''}
                      {portionLabel(e)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-fg-2 tabular">
                    {Math.round(e.nutrients.kcal)}
                  </span>
                </button>
              </SwipeToDelete>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => {
          haptic('tap');
          onAdd();
        }}
        className="flex min-h-12 w-full items-center gap-2 border-t border-line px-4 text-sm font-semibold text-accent-text active:bg-fill"
      >
        <Plus size={18} strokeWidth={2.5} aria-hidden />
        Add {meal === 'snack' ? 'snack' : MEAL_LABELS[meal].toLowerCase()}
      </button>
    </section>
  );
}

function MealMenu({
  meal,
  onClose,
  entries,
  prevEntries,
  prevLabel,
  isToday,
  onAdd,
  onSave,
  onCopy,
  day,
  today,
}: {
  meal: MealSlot | null;
  onClose: () => void;
  entries: FoodEntry[];
  prevEntries: FoodEntry[];
  prevLabel: string;
  isToday: boolean;
  onAdd: (meal: MealSlot) => void;
  onSave: (items: MealItem[]) => void;
  onCopy: (src: FoodEntry[], toDay: string, label: string) => void;
  day: string;
  today: string;
}) {
  const [shown, setShown] = useState(meal);
  if (meal !== null && meal !== shown) setShown(meal);
  const m = meal ?? shown ?? 'breakfast';
  const label = MEAL_LABELS[m];
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Sheet open={meal !== null} onClose={onClose} title={label}>
      <ActionList
        items={[
          { label: `Add to ${label.toLowerCase()}`, icon: Plus, onSelect: run(() => onAdd(m)) },
          ...(entries.length ? [{ label: 'Save as meal', icon: Bookmark, onSelect: run(() => onSave(entries)) }] : []),
          ...(prevEntries.length
            ? [
                {
                  label: `Copy ${label.toLowerCase()} from ${prevLabel}`,
                  icon: CalendarArrowDown,
                  onSelect: run(() => onCopy(prevEntries, day, `Copied ${label.toLowerCase()}`)),
                },
              ]
            : []),
          ...(!isToday && entries.length
            ? [
                {
                  label: 'Copy to today',
                  icon: Copy,
                  onSelect: run(() => onCopy(entries, today, `Copied ${label.toLowerCase()} to today`)),
                },
              ]
            : []),
          ...(entries.length
            ? [
                {
                  label: `Clear ${label.toLowerCase()}`,
                  icon: Eraser,
                  destructive: true,
                  onSelect: run(async () => {
                    const ok = await confirm({
                      title: `Clear ${label.toLowerCase()}?`,
                      message: `${pluralize(entries.length, 'item')} will be removed from this day.`,
                      confirmLabel: 'Clear',
                      destructive: true,
                    });
                    if (!ok) return;
                    const { deleteFoodEntries, saveFoodEntries } = useData.getState();
                    deleteFoodEntries(entries.map((e) => e.id));
                    toast.undo(`Cleared ${label.toLowerCase()}`, () => saveFoodEntries(entries));
                  }),
                },
              ]
            : []),
        ]}
      />
    </Sheet>
  );
}

function WaterCard({ day, ml, target }: { day: string; ml: number; target: number }) {
  const setWater = useData((s) => s.setWater);
  const cells = Math.max(1, Math.ceil(target / GLASS_ML));
  const filled = ml / GLASS_ML;
  const change = (delta: number) => {
    haptic(delta > 0 ? 'tap' : 'select');
    setWater(day, Math.max(0, ml + delta));
  };
  return (
    <section aria-label="Water" className="surface rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--water)_16%,transparent)] text-water">
          <Droplet size={22} aria-hidden fill="currentColor" fillOpacity={0.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Water</p>
          <p className="text-sm text-fg-2 tabular" aria-live="polite">
            <span className="font-semibold text-fg">{formatNumber(ml / 1000, 2)} L</span> of{' '}
            {formatNumber(target / 1000, 2)} L
          </p>
        </div>
        <Button
          size="icon"
          variant="secondary"
          icon={Minus}
          aria-label={`Remove a glass (${GLASS_ML} ml)`}
          disabled={ml <= 0}
          onClick={() => change(-GLASS_ML)}
          feedback={false}
        />
        <Button
          size="icon"
          variant="soft"
          icon={Plus}
          aria-label={`Add a glass (${GLASS_ML} ml)`}
          onClick={() => change(GLASS_ML)}
          feedback={false}
        />
      </div>
      <div className="mt-3 flex gap-1" aria-hidden>
        {Array.from({ length: Math.max(cells, Math.ceil(filled)) }, (_, i) => (
          <span key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-fill">
            <span
              className="block h-full w-full origin-left rounded-full bg-water transition-transform duration-500"
              style={{ transform: `scaleX(${Math.max(0, Math.min(1, filled - i))})` }}
            />
          </span>
        ))}
      </div>
    </section>
  );
}

function WeekCard({
  day,
  today,
  target,
  onSelect,
}: {
  day: string;
  today: string;
  target: number;
  onSelect: (d: string) => void;
}) {
  const entries = useData((s) => s.foodEntries);
  const weekStart = dayKey(startOfWeek(fromDateInput(day)));
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i));
  const totals = dailyTotals(entries, days);
  const all = totals.filter((d) => d.totals && d.day <= today);
  if (!all.length) return null;
  // Today is still in progress — leave it out of the averages unless it's all there is.
  const done = all.filter((d) => d.day !== today);
  const logged = done.length ? done : all;
  const avg = logged.reduce((a, d) => a + d.totals!.kcal, 0) / logged.length;
  const protein = logged.reduce((a, d) => a + d.totals!.protein, 0) / logged.length;
  return (
    <section aria-label="This week">
      <SectionTitle>{weekStart === dayKey(startOfWeek(fromDateInput(today))) ? 'This week' : 'That week'}</SectionTitle>
      <Card className="space-y-4">
        <div className="flex gap-6">
          <div>
            <p className="text-xs font-semibold text-fg-2">Daily average</p>
            <p className="text-xl font-bold tabular">
              {Math.round(avg).toLocaleString()} <span className="text-sm font-semibold text-fg-2">kcal</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-fg-2">Protein</p>
            <p className="text-xl font-bold tabular">
              {Math.round(protein)} <span className="text-sm font-semibold text-fg-2">g / day</span>
            </p>
          </div>
        </div>
        <CalorieBars
          days={totals.map((d) => ({ day: d.day, kcal: d.totals?.kcal ?? null }))}
          target={target}
          selected={day}
          onSelect={(d) => d <= today && onSelect(d)}
          height={96}
        />
      </Card>
    </section>
  );
}

import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Globe,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
  ScanBarcode,
  Search,
  SearchX,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { BUILTIN_FOODS } from '../../data/foods';
import { haptic } from '../../lib/haptics';
import {
  defaultPortion,
  lastPortions,
  makeItem,
  MEAL_LABELS,
  portionLabel,
  POPULAR_FOOD_IDS,
  recentFoods,
  searchFoods,
  sumNutrients,
} from '../../lib/nutrition';
import { FoodLookupError, lookupBarcode } from '../../lib/openFoodFacts';
import { pluralize } from '../../lib/format';
import { uid } from '../../lib/utils';
import { getFoodMap, useData } from '../../store/data';
import { useNutrition } from '../../store/nutrition';
import { toast } from '../../store/toast';
import { confirm } from '../../store/ui';
import { MEAL_SLOTS, type Food, type FoodEntry, type MealItem, type MealSlot, type SavedMeal } from '../../types';
import { Button } from '../ui/Button';
import { Chip, EmptyState } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { SwipeToDelete } from '../ui/SwipeToDelete';
import { FoodRow, ListLabel, MacroLine } from './bits';
import { FoodForm, QuickAddForm } from './FoodForms';
import { PortionEditor } from './PortionEditor';
import { useOnlineFoodSearch } from './useOnlineFoodSearch';

const BarcodeScanner = lazy(() => import('./BarcodeScanner'));

export type AddStart = 'search' | 'scan' | 'quick';

type View =
  | { kind: 'search' }
  | { kind: 'portion'; food: Food }
  | { kind: 'scan' }
  | { kind: 'lookup'; code: string; error?: string }
  | { kind: 'create'; barcode?: string; notFound?: boolean; edit?: Food }
  | { kind: 'quick' };

type Tab = 'recent' | 'meals' | 'mine';

interface Props {
  open: boolean;
  onClose: () => void;
  day: string;
  meal: MealSlot;
  start?: AddStart;
}

/**
 * The logging flow: search (built-in, your foods, Open Food Facts), recents
 * with one-tap add, saved meals, barcode scan, custom foods and quick add —
 * all inside one sheet so adding several items never leaves it.
 */
export function AddFoodSheet({ open, onClose, day, meal: initialMeal, start = 'search' }: Props) {
  const [view, setView] = useState<View>({ kind: start });
  const [meal, setMeal] = useState(initialMeal);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const [wasOpen, setWasOpen] = useState(open);
  const session = useRef(0);

  // Fresh state every time the sheet opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView({ kind: start });
      setMeal(initialMeal);
      setQuery('');
      setTab('recent');
    }
  }

  const customFoods = useData((s) => s.foods);
  const entries = useData((s) => s.foodEntries);
  const savedMeals = useData((s) => s.savedMeals);
  const onlineSearch = useNutrition((s) => s.onlineSearch);
  const foodMap = getFoodMap(customFoods);
  const allFoods = useMemo(() => [...BUILTIN_FOODS, ...customFoods], [customFoods]);
  const lastUsed = useMemo(() => lastPortions(entries), [entries]);
  const recentMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) if (e.foodId) m.set(e.foodId, Math.max(m.get(e.foodId) ?? 0, e.createdAt));
    return m;
  }, [entries]);

  const mealEntries = useMemo(() => entries.filter((e) => e.day === day && e.meal === meal), [entries, day, meal]);
  const mealKcal = sumNutrients(mealEntries).kcal;

  const close = () => {
    session.current++;
    onClose();
  };

  // ---- logging ---------------------------------------------------------------

  const logItems = (items: MealItem[], label: string, foods: Food[] = []) => {
    const { saveFood, saveFoodEntries, deleteFoodEntries } = useData.getState();
    // Remember Open Food Facts products locally so they work offline and show in recents.
    for (const f of foods) if (f.source === 'off' && !foodMap.has(f.id)) saveFood(f);
    const now = Date.now();
    const added: FoodEntry[] = items.map((item, i) => ({ ...item, id: uid(), day, meal, createdAt: now + i }));
    saveFoodEntries(added);
    const kcal = Math.round(sumNutrients(added).kcal);
    toast.undo(label, () => deleteFoodEntries(added.map((e) => e.id)), `${MEAL_LABELS[meal]} · ${kcal} kcal`);
  };

  const quickAdd = (food: Food) => {
    const p = defaultPortion(food, lastUsed.get(food.id));
    haptic('success');
    logItems([makeItem(food, p.quantity, p.unit)], `Added ${food.name}`, [food]);
  };

  const openFood = (food: Food) => {
    haptic('tap');
    setView({ kind: 'portion', food });
  };

  const lookup = async (code: string) => {
    const token = session.current;
    setView({ kind: 'lookup', code });
    const local = allFoods.find((f) => f.barcode === code);
    if (local) {
      setView({ kind: 'portion', food: local });
      return;
    }
    if (!onlineSearch) {
      setView({ kind: 'create', barcode: code, notFound: true });
      return;
    }
    try {
      const food = await lookupBarcode(code);
      if (token !== session.current) return;
      setView(food ? { kind: 'portion', food } : { kind: 'create', barcode: code, notFound: true });
      if (!food) haptic('warning');
    } catch (err) {
      if (token !== session.current) return;
      setView({
        kind: 'lookup',
        code,
        error: err instanceof FoodLookupError ? err.message : 'Lookup failed',
      });
    }
  };

  // ---- header ----------------------------------------------------------------

  const back = (() => {
    switch (view.kind) {
      case 'search':
        return null;
      case 'lookup':
        return () => setView({ kind: 'scan' });
      default:
        return () => setView({ kind: 'search' });
    }
  })();

  const title = {
    search: `Add to ${MEAL_LABELS[meal]}`,
    portion: 'Choose amount',
    scan: 'Scan barcode',
    lookup: 'Scan barcode',
    create: view.kind === 'create' && view.edit ? 'Edit food' : 'New food',
    quick: 'Quick add',
  }[view.kind];

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      size="full"
      flush={view.kind === 'search'}
      leading={
        back && (
          <button
            type="button"
            onClick={() => {
              haptic('tap');
              back();
            }}
            aria-label="Back"
            className="grid size-10 shrink-0 place-items-center rounded-full text-fg-2 transition-transform active:scale-90 hover:bg-fill"
          >
            <ArrowLeft size={20} strokeWidth={2.5} aria-hidden />
          </button>
        )
      }
      toolbar={
        view.kind === 'search' ? (
          <SearchToolbar
            query={query}
            onQuery={setQuery}
            meal={meal}
            onMeal={setMeal}
            onScan={() => setView({ kind: 'scan' })}
          />
        ) : undefined
      }
      footer={
        view.kind === 'search' ? (
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-sm text-fg-2" aria-live="polite">
              <span className="font-semibold text-fg">{MEAL_LABELS[meal]}</span>
              {mealEntries.length
                ? ` · ${pluralize(mealEntries.length, 'item')} · ${Math.round(mealKcal)} kcal`
                : ' · nothing yet'}
            </p>
            <Button variant="primary" onClick={close}>
              Done
            </Button>
          </div>
        ) : undefined
      }
    >
      {view.kind === 'search' && (
        <SearchView
          query={query}
          tab={tab}
          onTab={setTab}
          allFoods={allFoods}
          customFoods={customFoods}
          entries={entries}
          savedMeals={savedMeals}
          foodMap={foodMap}
          recentMap={recentMap}
          lastUsed={lastUsed}
          onlineSearch={onlineSearch}
          onOpen={openFood}
          onQuickAdd={quickAdd}
          onAddMeal={(m) => {
            haptic('success');
            logItems(m.items, `Added ${m.name}`);
          }}
          onQuick={() => setView({ kind: 'quick' })}
          onCreate={() => setView({ kind: 'create' })}
          onScan={() => setView({ kind: 'scan' })}
        />
      )}

      {view.kind === 'portion' && (
        <div className="pt-1">
          <PortionEditor
            key={view.food.id}
            food={view.food}
            initial={defaultPortion(view.food, lastUsed.get(view.food.id))}
            meal={meal}
            onMealChange={setMeal}
            submitLabel={`Add to ${MEAL_LABELS[meal]}`}
            onSubmit={(item) => {
              logItems([item], `Added ${item.name}`, [view.food]);
              setView({ kind: 'search' });
            }}
          />
          {view.food.source === 'custom' && foodMap.has(view.food.id) && (
            <Button
              variant="ghost"
              size="sm"
              icon={Pencil}
              className="mx-auto mt-2 flex"
              onClick={() => setView({ kind: 'create', edit: view.food })}
            >
              Edit food
            </Button>
          )}
        </div>
      )}

      {view.kind === 'scan' && (
        <Suspense
          fallback={
            <div className="grid aspect-[4/3] place-items-center rounded-3xl bg-fill">
              <Loader2 size={26} className="animate-spin text-fg-2" aria-label="Loading scanner" />
            </div>
          }
        >
          <BarcodeScanner onDetected={(code) => void lookup(code)} />
        </Suspense>
      )}

      {view.kind === 'lookup' && (
        <div className="grid min-h-[50%] place-items-center py-10 text-center" aria-live="polite">
          {view.error ? (
            <div className="max-w-xs space-y-3">
              <WifiOff size={30} className="mx-auto text-fg-2" aria-hidden />
              <p className="font-semibold">{view.error}</p>
              <p className="text-sm text-fg-2">
                Barcode <span className="tabular">{view.code}</span> couldn't be looked up right now.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Button icon={RotateCcw} onClick={() => void lookup(view.code)}>
                  Retry
                </Button>
                <Button
                  variant="primary"
                  icon={PackagePlus}
                  onClick={() => setView({ kind: 'create', barcode: view.code })}
                >
                  Enter manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Loader2 size={30} className="mx-auto animate-spin text-accent-text" aria-hidden />
              <p className="font-semibold">Looking up product…</p>
              <p className="text-sm text-fg-2 tabular">{view.code}</p>
            </div>
          )}
        </div>
      )}

      {view.kind === 'create' && (
        <div className="space-y-4 pt-1">
          {view.notFound && (
            <div className="rounded-2xl bg-accent-soft p-3.5 text-sm">
              <p className="font-semibold text-accent-text">
                {onlineSearch ? 'Product not found' : 'Not in your foods yet'}
              </p>
              <p className="mt-0.5 text-fg-2">
                Enter it from the nutrition label once — next time the barcode is recognised instantly.
              </p>
            </div>
          )}
          <FoodForm
            key={view.edit?.id ?? view.barcode ?? 'new'}
            initial={view.edit}
            barcode={view.barcode}
            onSave={(food) => {
              useData.getState().saveFood(food);
              setView({ kind: 'portion', food });
            }}
            onDelete={
              view.edit
                ? async () => {
                    const food = view.edit!;
                    const ok = await confirm({
                      title: `Delete “${food.name}”?`,
                      message: 'Logged entries keep their nutrition. The food disappears from search.',
                      confirmLabel: 'Delete',
                      destructive: true,
                    });
                    if (!ok) return;
                    useData.getState().deleteFood(food.id);
                    setView({ kind: 'search' });
                  }
                : undefined
            }
          />
        </div>
      )}

      {view.kind === 'quick' && (
        <div className="space-y-4 pt-1">
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Meal">
            {MEAL_SLOTS.map((m) => (
              <Chip key={m} selected={meal === m} onClick={() => setMeal(m)}>
                {MEAL_LABELS[m]}
              </Chip>
            ))}
          </div>
          <QuickAddForm
            submitLabel={`Add to ${MEAL_LABELS[meal]}`}
            onSubmit={(item) => {
              logItems([item], `Added ${item.name}`);
              setView({ kind: 'search' });
            }}
          />
        </div>
      )}
    </Sheet>
  );
}

function SearchToolbar({
  query,
  onQuery,
  meal,
  onMeal,
  onScan,
}: {
  query: string;
  onQuery: (q: string) => void;
  meal: MealSlot;
  onMeal: (m: MealSlot) => void;
  onScan: () => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-5" role="group" aria-label="Meal">
        {MEAL_SLOTS.map((m) => (
          <Chip key={m} selected={meal === m} onClick={() => onMeal(m)}>
            {MEAL_LABELS[m]}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2 px-5">
        <div className="relative min-w-0 flex-1">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search foods & products"
            aria-label="Search foods"
            autoComplete="off"
            enterKeyHint="search"
            data-autofocus=""
            className="field pr-10 pl-10 text-[16px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
        <Button size="icon" variant="soft" icon={ScanBarcode} aria-label="Scan barcode" onClick={onScan} />
      </div>
    </div>
  );
}

interface SearchViewProps {
  query: string;
  tab: Tab;
  onTab: (t: Tab) => void;
  allFoods: Food[];
  customFoods: Food[];
  entries: FoodEntry[];
  savedMeals: SavedMeal[];
  foodMap: Map<string, Food>;
  recentMap: Map<string, number>;
  lastUsed: ReturnType<typeof lastPortions>;
  onlineSearch: boolean;
  onOpen: (f: Food) => void;
  onQuickAdd: (f: Food) => void;
  onAddMeal: (m: SavedMeal) => void;
  onQuick: () => void;
  onCreate: () => void;
  onScan: () => void;
}

function SearchView(props: SearchViewProps) {
  const { query, tab, onTab, allFoods, entries, foodMap, recentMap, lastUsed, onlineSearch } = props;
  const local = useMemo(() => searchFoods(query, allFoods, recentMap, 30), [query, allFoods, recentMap]);
  const online = useOnlineFoodSearch(query, onlineSearch);
  const localIds = useMemo(() => new Set(local.map((f) => f.id)), [local]);
  const remote = online.foods.filter((f) => !localIds.has(f.id));
  const recents = useMemo(() => recentFoods(entries, foodMap, 30), [entries, foodMap]);
  const popular = useMemo(() => {
    if (recents.length >= 12) return [];
    const seen = new Set(recents.map((f) => f.id));
    return POPULAR_FOOD_IDS.filter((id) => !seen.has(id))
      .map((id) => foodMap.get(id))
      .filter((f): f is Food => f !== undefined);
  }, [recents, foodMap]);

  const row = (food: Food) => {
    const p = defaultPortion(food, lastUsed.get(food.id));
    const item = makeItem(food, p.quantity, p.unit);
    return (
      <FoodRow
        key={food.id}
        food={food}
        portion={portionLabel(item)}
        kcal={item.nutrients.kcal}
        onOpen={() => props.onOpen(food)}
        onQuickAdd={() => props.onQuickAdd(food)}
      />
    );
  };

  const extras = (
    <div className="grid grid-cols-3 gap-2 px-3 pt-4 pb-2">
      <ExtraButton icon={Zap} label="Quick add" onClick={props.onQuick} />
      <ExtraButton icon={PackagePlus} label="New food" onClick={props.onCreate} />
      <ExtraButton icon={ScanBarcode} label="Scan" onClick={props.onScan} />
    </div>
  );

  if (query.trim()) {
    return (
      <div className="px-3 pb-2">
        {local.length > 0 ? (
          <>
            <ListLabel>Foods</ListLabel>
            <ul>{local.map(row)}</ul>
          </>
        ) : (
          <EmptyState icon={SearchX} title="Not in your foods" className="py-6">
            {online.available
              ? 'Search Open Food Facts for packaged products, scan the barcode, or create the food.'
              : 'Try another word, scan the barcode, or create the food.'}
          </EmptyState>
        )}
        {online.available && (
          <>
            <ListLabel>
              <span className="inline-flex items-center gap-1.5">
                <Globe size={12} aria-hidden /> Open Food Facts
              </span>
            </ListLabel>
            {online.status === 'idle' && (
              <button
                type="button"
                onClick={() => {
                  haptic('tap');
                  online.search();
                }}
                className="flex min-h-13 w-full items-center gap-3 rounded-xl px-2 text-left text-[15px] font-semibold text-accent-text transition-transform active:scale-[0.98] hover:bg-fill"
              >
                <Globe size={18} aria-hidden />
                <span className="min-w-0 flex-1 truncate">Search products for “{query.trim()}”</span>
              </button>
            )}
            {online.status === 'loading' && (
              <p className="flex min-h-13 items-center gap-2 px-2 text-sm text-fg-2" role="status">
                <Loader2 size={16} className="animate-spin" aria-hidden /> Searching products…
              </p>
            )}
            {online.status === 'error' && online.error && (
              <div className="flex items-start gap-3 rounded-xl bg-fill p-3 text-sm">
                <WifiOff size={18} className="mt-0.5 shrink-0 text-fg-2" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-fg-2">
                    {online.error.kind === 'offline'
                      ? "You're offline — your own and built-in foods still work."
                      : online.error.kind === 'rate-limit'
                        ? 'Too many searches in a row — wait a moment and try again.'
                        : 'Open Food Facts didn’t answer. It limits product search from apps when busy — scanning the barcode always works.'}
                  </p>
                  <div className="flex gap-2">
                    {online.error.kind !== 'offline' && (
                      <Button size="sm" icon={RotateCcw} onClick={online.search}>
                        Retry
                      </Button>
                    )}
                    <Button size="sm" variant="soft" icon={ScanBarcode} onClick={props.onScan}>
                      Scan
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {online.status === 'done' && !remote.length && (
              <p className="px-2 py-3 text-sm text-fg-2">No more matching products.</p>
            )}
            <ul>{remote.map(row)}</ul>
          </>
        )}
        {extras}
      </div>
    );
  }

  return (
    <div className="px-3 pb-2">
      <div className="px-2 pb-1">
        <Segmented
          label="Food lists"
          size="sm"
          value={tab}
          onChange={onTab}
          options={[
            { value: 'recent', label: 'Recent' },
            { value: 'meals', label: 'Meals' },
            { value: 'mine', label: 'My foods' },
          ]}
        />
      </div>
      {tab === 'recent' && (
        <>
          {recents.length > 0 && <ul className="pt-1">{recents.map(row)}</ul>}
          {/* Until there's a real history, keep suggesting basics below the recents. */}
          {popular.length > 0 && (
            <>
              <ListLabel>Popular basics</ListLabel>
              <ul>{popular.map(row)}</ul>
            </>
          )}
        </>
      )}
      {tab === 'meals' && <SavedMealsList meals={props.savedMeals} onAdd={props.onAddMeal} />}
      {tab === 'mine' && <MyFoodsList foods={props.customFoods} row={row} onCreate={props.onCreate} />}
      {extras}
    </div>
  );
}

function ExtraButton({ icon: Icon, label, onClick }: { icon: typeof Zap; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className="flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-2xl bg-fill text-[13px] font-semibold transition-transform active:scale-95"
    >
      <Icon size={20} className="text-accent-text" aria-hidden />
      {label}
    </button>
  );
}

function SavedMealsList({ meals, onAdd }: { meals: SavedMeal[]; onAdd: (m: SavedMeal) => void }) {
  const deleteMeal = useData((s) => s.deleteMeal);
  const saveMeal = useData((s) => s.saveMeal);
  if (!meals.length) {
    return (
      <EmptyState icon={Bookmark} title="No saved meals yet" className="py-8">
        Log a meal you eat often, then choose “Save as meal” from its menu on the Food page to add it in one tap.
      </EmptyState>
    );
  }
  const sorted = [...meals].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <ul className="space-y-1 pt-2">
      {sorted.map((m) => {
        const totals = sumNutrients(m.items);
        return (
          <li key={m.id} className="overflow-hidden rounded-xl">
            <SwipeToDelete
              label={`Delete meal ${m.name}`}
              onDelete={() => {
                deleteMeal(m.id);
                toast.undo(`Deleted ${m.name}`, () => saveMeal(m));
              }}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onAdd(m)}
                  className="flex min-h-15 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left active:scale-[0.98] hover:bg-fill"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{m.name}</span>
                    <span className="block truncate text-[13px] text-fg-2">
                      {pluralize(m.items.length, 'item')} · <MacroLine n={totals} />
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-fg-2 tabular">
                    {Math.round(totals.kcal)} kcal
                  </span>
                </button>
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-text"
                >
                  <Plus size={20} strokeWidth={2.5} />
                </span>
              </div>
            </SwipeToDelete>
          </li>
        );
      })}
    </ul>
  );
}

function MyFoodsList({ foods, row, onCreate }: { foods: Food[]; row: (f: Food) => ReactNode; onCreate: () => void }) {
  const mine = useMemo(() => [...foods].sort((a, b) => a.name.localeCompare(b.name)), [foods]);
  if (!mine.length) {
    return (
      <EmptyState
        icon={PackagePlus}
        title="Your own foods"
        className="py-8"
        action={
          <Button variant="primary" icon={PackagePlus} onClick={onCreate}>
            Create a food
          </Button>
        }
      >
        Foods you create, and products you log from Open Food Facts, are kept here — and work offline.
      </EmptyState>
    );
  }
  return (
    <>
      <ListLabel>Saved foods</ListLabel>
      <ul>{mine.map(row)}</ul>
    </>
  );
}

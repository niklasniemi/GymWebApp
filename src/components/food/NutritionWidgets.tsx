import { useMemo, useState } from 'react';
import { Dumbbell, Target, Utensils, UtensilsCrossed } from 'lucide-react';
import { useNutritionDay, type DayNutrition } from '../../hooks/useNutritionDay';
import { dailyTotals, dayKey, dayRange, MACROS, macroKcal } from '../../lib/nutrition';
import { fromDateInput } from '../../lib/format';
import { cn } from '../../lib/utils';
import { useData } from '../../store/data';
import { useNutrition, useTargets } from '../../store/nutrition';
import type { Nutrients } from '../../types';
import { navigate } from '../../store/ui';
import { Card } from '../ui/primitives';
import { ProgressRing } from '../ui/ProgressRing';
import { WidgetFrame } from '../widgets/WidgetBoard';
import { MacroBars } from './bits';

const fmt = (n: number) => Math.round(n).toLocaleString();

/** The Food page hero: calories left in a ring, the budget equation and macro bars. */
export function CalorieSummary({ data }: { data: DayNutrition }) {
  const addExercise = useNutrition((s) => s.addExercise);
  const { totals, budget, remaining, burned, targets } = data;
  const over = remaining < 0;
  return (
    <Card className="relative overflow-hidden rounded-3xl p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-20 size-64 rounded-full bg-accent opacity-15 blur-3xl"
      />
      <div className="relative flex items-center gap-4 min-[360px]:gap-5">
        <ProgressRing
          value={budget > 0 ? totals.kcal / budget : 0}
          size={124}
          width={10}
          className="text-accent"
          label={`${fmt(totals.kcal)} of ${fmt(budget)} kcal eaten`}
        >
          <div aria-hidden>
            <p className={cn('text-[28px] leading-none font-bold tracking-tight tabular', over && 'text-danger')}>
              {fmt(Math.abs(remaining))}
            </p>
            <p className="mt-1 text-xs font-semibold text-fg-2">{over ? 'kcal over' : 'kcal left'}</p>
          </div>
        </ProgressRing>
        <dl className="min-w-0 flex-1 space-y-2.5 text-sm">
          <SummaryRow icon={Target} label="Goal" value={fmt(targets.kcal)} />
          <SummaryRow icon={Utensils} label="Food" value={fmt(totals.kcal)} />
          {(burned > 0 || addExercise) && (
            <SummaryRow
              icon={Dumbbell}
              label="Workouts"
              value={`${addExercise ? '+' : '≈ '}${fmt(burned)}`}
              muted={!addExercise}
            />
          )}
        </dl>
      </div>
      <div className="relative mt-5">
        <MacroBars totals={totals} targets={targets} />
      </div>
    </Card>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={15} className="shrink-0 text-fg-2" aria-hidden />
      <dt className="min-w-0 flex-1 truncate text-fg-2">{label}</dt>
      <dd className={cn('font-bold tabular', muted && 'font-semibold text-fg-2')}>{value}</dd>
    </div>
  );
}

/** Compact "today" card for the Workout board and Profile. */
export function NutritionTodayWidget() {
  const [today] = useState(() => dayKey(Date.now()));
  const data = useNutritionDay(today);
  const { totals, budget, remaining, targets } = data;
  const proteinLeft = Math.max(0, Math.round(targets.protein - totals.protein));
  return (
    <WidgetFrame title="Nutrition today" action="Log food" onAction={() => navigate('food')}>
      <button
        type="button"
        onClick={() => navigate('food')}
        className="surface flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-transform active:scale-[0.98]"
      >
        <ProgressRing
          value={budget > 0 ? totals.kcal / budget : 0}
          size={76}
          width={8}
          className="text-accent"
          label={`${Math.round((totals.kcal / Math.max(1, budget)) * 100)}% of today's calories`}
        >
          <UtensilsCrossed size={22} className="text-accent-text" aria-hidden />
        </ProgressRing>
        <span className="min-w-0 flex-1">
          <span className="block text-2xl font-bold tracking-tight tabular">
            {fmt(totals.kcal)}
            <span className="text-sm font-semibold text-fg-2"> / {fmt(budget)} kcal</span>
          </span>
          <span className="block truncate text-sm text-fg-2">
            {remaining >= 0 ? `${fmt(remaining)} kcal left` : `${fmt(-remaining)} kcal over`}
            {proteinLeft > 0 ? ` · ${proteinLeft} g protein left` : ' · protein goal hit'}
          </span>
          <span className="mt-2.5 flex gap-1.5" aria-hidden>
            {MACROS.map((m) => {
              const p = targets[m.key] > 0 ? totals[m.key] / targets[m.key] : 0;
              return (
                <span key={m.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
                  <span
                    className="block h-full w-full origin-left rounded-full transition-transform duration-700"
                    style={{ background: m.color, transform: `scaleX(${Math.min(1, p)})` }}
                  />
                </span>
              );
            })}
          </span>
        </span>
      </button>
    </WidgetFrame>
  );
}

const weekday = (day: string, style: 'narrow' | 'short' = 'narrow') =>
  new Date(fromDateInput(day)).toLocaleDateString(undefined, { weekday: style });

/**
 * Lightweight calorie columns with a target line (CSS transforms only — no
 * chart library, so the Food tab stays small).
 */
export function CalorieBars({
  days,
  target,
  selected,
  onSelect,
  height = 120,
  labelEvery = 1,
}: {
  days: { day: string; kcal: number | null }[];
  target: number;
  selected?: string;
  onSelect?: (day: string) => void;
  height?: number;
  labelEvery?: number;
}) {
  const max = Math.max(target * 1.25, ...days.map((d) => d.kcal ?? 0)) || 1;
  const targetPos = target / max;
  return (
    <div className="relative" style={{ height: height + 22 }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 border-t border-dashed border-fg/25"
        style={{ bottom: 22 + targetPos * height }}
      />
      <div className="absolute inset-0 flex items-end gap-1.5">
        {days.map((d, i) => {
          const v = d.kcal ?? 0;
          const p = v / max;
          const isSel = d.day === selected;
          const overTarget = v > target * 1.1;
          const label = `${new Date(fromDateInput(d.day)).toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}: ${d.kcal === null ? 'nothing logged' : `${fmt(v)} kcal`}`;
          const content = (
            <>
              <span className="relative block w-full max-w-6 flex-1" style={{ height }}>
                <span
                  className="absolute inset-x-0 bottom-0 block h-full origin-bottom rounded-t-[5px] rounded-b-[2px] transition-transform duration-700 ease-[var(--ease-out)]"
                  style={{
                    transform: `scaleY(${Math.max(d.kcal === null ? 0 : 0.02, p)})`,
                    background: overTarget ? 'var(--chart-2)' : 'var(--chart-1)',
                    opacity: selected && !isSel ? 0.45 : 1,
                  }}
                />
              </span>
              <span
                className={cn(
                  'h-[18px] text-[11px] leading-[18px] font-semibold',
                  isSel ? 'text-fg' : 'text-muted',
                  i % labelEvery !== (days.length - 1) % labelEvery && 'invisible',
                )}
              >
                {weekday(d.day)}
              </span>
            </>
          );
          return onSelect ? (
            <button
              key={d.day}
              type="button"
              aria-label={label}
              aria-pressed={isSel}
              onClick={() => onSelect(d.day)}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              {content}
            </button>
          ) : (
            <div
              key={d.day}
              aria-label={label}
              role="img"
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The last `count` days, plus the logged days to average over — today is
 * still in progress, so it only counts when nothing else is logged.
 */
function useCalorieHistory(count: number) {
  const entries = useData((s) => s.foodEntries);
  const [today] = useState(() => dayKey(Date.now()));
  return useMemo(() => {
    const days = dailyTotals(entries, dayRange(today, count));
    const all = days.filter((d): d is { day: string; totals: Nutrients } => d.totals !== null);
    const done = all.filter((d) => d.day !== today);
    return { days, logged: done.length ? done : all };
  }, [entries, today, count]);
}

function InlineStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-fg-2">{label}</p>
      <p className="text-xl font-bold tracking-tight whitespace-nowrap tabular">
        {value}
        {unit && <span className="text-sm font-semibold text-fg-2"> {unit}</span>}
      </p>
    </div>
  );
}

function NoFoodYet() {
  return (
    <button
      type="button"
      onClick={() => navigate('food')}
      className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm text-fg-2 transition-transform active:scale-[0.98]"
    >
      <UtensilsCrossed size={20} className="shrink-0 text-accent-text" aria-hidden />
      Log a few days of meals to see your calorie and macro trends here.
    </button>
  );
}

/** Analytics: 14 days of calories vs target. */
export function CaloriesTrendWidget() {
  const { days, logged } = useCalorieHistory(14);
  const targets = useTargets();
  const avg = logged.length ? logged.reduce((a, d) => a + d.totals.kcal, 0) / logged.length : 0;
  const onTarget = logged.filter((d) => Math.abs(d.totals.kcal - targets.kcal) <= targets.kcal * 0.1).length;
  return (
    <WidgetFrame title="Calories" action="Food" onAction={() => navigate('food')}>
      {logged.length === 0 ? (
        <NoFoodYet />
      ) : (
        <Card className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <InlineStat label="Daily average" value={fmt(avg)} unit="kcal" />
            <InlineStat label="Target" value={fmt(targets.kcal)} unit="kcal" />
            <InlineStat label="Within ±10%" value={`${onTarget}/${logged.length}`} unit="days" />
          </div>
          <CalorieBars
            days={days.map((d) => ({ day: d.day, kcal: d.totals?.kcal ?? null }))}
            target={targets.kcal}
            height={130}
          />
          <p className="flex items-center gap-3 text-xs text-fg-2">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-[var(--chart-1)]" /> Calories
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-[var(--chart-2)]" /> &gt;10% over
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="w-3 border-t border-dashed border-fg/40" /> Target
            </span>
          </p>
        </Card>
      )}
    </WidgetFrame>
  );
}

/** Analytics: average macro split of the last 7 logged days and protein consistency. */
export function MacroSplitWidget() {
  const { logged } = useCalorieHistory(7);
  const targets = useTargets();
  const n = Math.max(1, logged.length);
  const sum = logged.reduce(
    (a, d) => ({
      protein: a.protein + d.totals.protein,
      carbs: a.carbs + d.totals.carbs,
      fat: a.fat + d.totals.fat,
    }),
    { protein: 0, carbs: 0, fat: 0 },
  );
  const avg = { protein: sum.protein / n, carbs: sum.carbs / n, fat: sum.fat / n };
  const energy = macroKcal({ kcal: 0, ...avg });
  const totalEnergy = energy.protein + energy.carbs + energy.fat || 1;
  const proteinDays = logged.filter((d) => d.totals.protein >= targets.protein * 0.9).length;

  return (
    <WidgetFrame title="Macros (7 days)" action="Food" onAction={() => navigate('food')}>
      {logged.length === 0 ? (
        <NoFoodYet />
      ) : (
        <Card className="space-y-4">
          <div
            className="flex h-4 overflow-hidden rounded-full"
            role="img"
            aria-label={MACROS.map((m) => `${m.label} ${Math.round((energy[m.key] / totalEnergy) * 100)}%`).join(', ')}
          >
            {MACROS.map((m) => (
              <span key={m.key} style={{ width: `${(energy[m.key] / totalEnergy) * 100}%`, background: m.color }} />
            ))}
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {MACROS.map((m) => (
              <div key={m.key}>
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-fg-2">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: m.color }} />
                  {m.label}
                </dt>
                <dd className="text-lg font-bold tabular">{Math.round((energy[m.key] / totalEnergy) * 100)}%</dd>
                <dd className="text-xs text-fg-2 tabular">
                  {Math.round(avg[m.key])} / {targets[m.key]} g avg
                </dd>
              </div>
            ))}
          </dl>
          <p className="rounded-xl bg-fill px-3.5 py-2.5 text-sm">
            Protein goal hit on{' '}
            <span className="font-bold tabular">
              {proteinDays} of {logged.length}
            </span>{' '}
            logged {logged.length === 1 ? 'day' : 'days'}
            {proteinDays === logged.length && logged.length >= 3 ? ' — great consistency.' : '.'}
          </p>
        </Card>
      )}
    </WidgetFrame>
  );
}

import { useState, type ReactNode } from 'react';
import { Check, Globe, Plus, UserRound } from 'lucide-react';
import { MACROS } from '../../lib/nutrition';
import { formatNumber } from '../../lib/units';
import { cn } from '../../lib/utils';
import type { Food, Nutrients } from '../../types';

/** Three macro tiles: colored dot, grams, label. */
export function MacroTiles({ nutrients, className }: { nutrients: Nutrients; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-3 gap-2', className)}>
      {MACROS.map((m) => (
        <div key={m.key} className="rounded-xl bg-fill px-3 py-2">
          <dt className="flex items-center gap-1.5 text-xs font-semibold text-fg-2">
            <span aria-hidden className="size-2 rounded-full" style={{ background: m.color }} />
            {m.label}
          </dt>
          <dd className="text-lg font-bold tabular">{formatNumber(nutrients[m.key], 1)} g</dd>
        </div>
      ))}
    </dl>
  );
}

/** Horizontal progress bars for each macro vs its target. */
export function MacroBars({
  totals,
  targets,
  compact,
}: {
  totals: Nutrients;
  targets: { protein: number; carbs: number; fat: number };
  compact?: boolean;
}) {
  return (
    <div className={cn('grid grid-cols-3', compact ? 'gap-3' : 'gap-4')}>
      {MACROS.map((m) => {
        const value = totals[m.key];
        const target = targets[m.key];
        const p = target > 0 ? value / target : 0;
        return (
          <div key={m.key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-1">
              <span className={cn('font-semibold text-fg-2', compact ? 'text-[11px]' : 'text-xs')}>{m.label}</span>
              {!compact && <span className="text-[11px] text-muted tabular">{Math.round(p * 100)}%</span>}
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill"
              role="progressbar"
              aria-label={`${m.label}: ${Math.round(value)} of ${target} g`}
              aria-valuemin={0}
              aria-valuemax={target}
              aria-valuenow={Math.round(value)}
            >
              <div
                className="h-full w-full origin-left rounded-full transition-transform duration-700 ease-[var(--ease-out)]"
                style={{ background: p > 1.1 ? 'var(--danger)' : m.color, transform: `scaleX(${Math.min(1, p)})` }}
              />
            </div>
            <p className={cn('mt-1 truncate tabular', compact ? 'text-xs' : 'text-[13px]')}>
              <span className="font-bold">{Math.round(value)}</span>
              <span className="text-fg-2"> / {target} g</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function SourceBadge({ source }: { source: Food['source'] }) {
  if (source === 'builtin') return null;
  const off = source === 'off';
  const Icon = off ? Globe : UserRound;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 text-[11px] font-semibold text-fg-2">
      <Icon size={11} aria-hidden />
      {off ? 'Open Food Facts' : 'My food'}
    </span>
  );
}

/** Short "P 20 · C 31 · F 9" line. */
export function MacroLine({ n, className }: { n: Nutrients; className?: string }) {
  return (
    <span className={cn('tabular', className)}>
      P {Math.round(n.protein)} · C {Math.round(n.carbs)} · F {Math.round(n.fat)}
    </span>
  );
}

/** A food in a search/recent list: tap for portion, + for instant add. */
export function FoodRow({
  food,
  portion,
  kcal,
  onOpen,
  onQuickAdd,
}: {
  food: Food;
  /** Human portion, e.g. "1 large egg · 50 g". */
  portion: string;
  kcal: number;
  onOpen: () => void;
  onQuickAdd: () => void;
}) {
  const [added, setAdded] = useState(false);
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-15 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-transform active:scale-[0.98] hover:bg-fill"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{food.name}</span>
          <span className="block truncate text-[13px] text-fg-2">
            {food.brand ? `${food.brand} · ` : ''}
            {portion}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-fg-2 tabular">{Math.round(kcal)} kcal</span>
      </button>
      <button
        type="button"
        aria-label={`Add ${portion} of ${food.name}`}
        onClick={() => {
          onQuickAdd();
          setAdded(true);
          setTimeout(() => setAdded(false), 1400);
        }}
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-full transition-transform active:scale-90',
          added ? 'bg-success text-white' : 'bg-accent-soft text-accent-text',
        )}
      >
        {added ? <Check size={20} strokeWidth={2.75} aria-hidden /> : <Plus size={20} strokeWidth={2.5} aria-hidden />}
      </button>
    </li>
  );
}

export function ListLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-9 items-end justify-between gap-2 px-2 pt-3 pb-1">
      <h3 className="text-[12px] font-semibold tracking-wide text-fg-2 uppercase">{children}</h3>
      {action}
    </div>
  );
}

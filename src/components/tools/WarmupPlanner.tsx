import { useMemo, useState } from 'react';
import {
  calculatePlates,
  DEFAULT_KG_PLATES,
  DEFAULT_LB_PLATES,
  generateWarmups,
  smallestIncrement,
  WARMUP_SCHEMES,
  type WarmupScheme,
} from '../../lib/calc';
import { formatNumber, fromDisplayWeight } from '../../lib/units';
import type { Unit } from '../../types';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { Stepper } from '../ui/Stepper';

interface Props {
  /** Working weight in display units. */
  initialWeight?: number | null;
  unit: Unit;
  barbell?: boolean;
  onApply?: (sets: { weight: number; reps: number }[]) => void;
  applyLabel?: string;
}

/** Percentage-based warm-up ramp with loadable rounding and plate hints. */
export function WarmupPlanner({ initialWeight, unit, barbell = true, onApply, applyLabel = 'Apply' }: Props) {
  const [working, setWorking] = useState<number | null>(initialWeight ?? (unit === 'kg' ? 100 : 225));
  const [schemeId, setSchemeId] = useState<WarmupScheme['id']>('standard');
  const scheme = WARMUP_SCHEMES.find((s) => s.id === schemeId) ?? WARMUP_SCHEMES[0];

  const plates = unit === 'kg' ? DEFAULT_KG_PLATES : DEFAULT_LB_PLATES;
  const bar = unit === 'kg' ? 20 : 45;
  const increment = barbell ? smallestIncrement(plates) : unit === 'kg' ? 2.5 : 5;

  const sets = useMemo(
    () => generateWarmups(working ?? 0, scheme, { minWeight: barbell ? bar : 0, increment }),
    [working, scheme, barbell, bar, increment],
  );

  const platesText = (w: number) => {
    if (!barbell) return null;
    const r = calculatePlates(w, bar, plates);
    return r.perSide.length
      ? r.perSide
          .map(({ plate, count }) => (count > 1 ? `${count}×${formatNumber(plate)}` : formatNumber(plate)))
          .join(' + ')
      : 'Empty bar';
  };

  return (
    <div className="space-y-4 pb-2">
      <div className="space-y-1.5">
        <p className="px-1 text-[13px] font-semibold text-fg-2">Working weight ({unit})</p>
        <Stepper
          size="lg"
          label={`Working weight in ${unit}`}
          value={working}
          onChange={setWorking}
          step={increment}
          max={1000}
        />
      </div>

      <div>
        <Segmented
          label="Warm-up scheme"
          value={schemeId}
          onChange={setSchemeId}
          options={WARMUP_SCHEMES.map((s) => ({ value: s.id, label: s.label }))}
        />
        <p className="mt-1.5 px-1 text-xs text-fg-2">{scheme.description}</p>
      </div>

      <ol className="divide-y divide-line overflow-hidden rounded-2xl bg-fill" aria-label="Warm-up sets">
        {sets.length === 0 && (
          <li className="p-4 text-center text-sm text-fg-2">
            Enter a working weight above the bar to generate warm-ups.
          </li>
        )}
        {sets.map((s, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold-soft text-xs font-bold text-gold">
              W{i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold tabular">
                {formatNumber(s.weight)} {unit} <span className="text-fg-2">× {s.reps}</span>
              </p>
              {barbell && <p className="truncate text-xs text-fg-2 tabular">Per side: {platesText(s.weight)}</p>}
            </div>
            <span className="text-sm font-semibold text-fg-2 tabular">{Math.round(s.pct * 100)}%</span>
          </li>
        ))}
        {sets.length > 0 && working && (
          <li className="flex items-center gap-3 bg-accent-soft px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-fg">
              ★
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold tabular">
                {formatNumber(working)} {unit} <span className="text-fg-2">working</span>
              </p>
              {barbell && <p className="truncate text-xs text-fg-2 tabular">Per side: {platesText(working)}</p>}
            </div>
            <span className="text-sm font-semibold text-fg-2 tabular">100%</span>
          </li>
        )}
      </ol>

      {onApply && (
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!sets.length}
          feedback="success"
          onClick={() => onApply(sets.map((s) => ({ weight: fromDisplayWeight(s.weight, unit), reps: s.reps })))}
        >
          {applyLabel} ({sets.length})
        </Button>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { CircleAlert } from 'lucide-react';
import { calculatePlates, KG_PLATES, LB_PLATES, smallestIncrement } from '../../lib/calc';
import { formatNumber } from '../../lib/units';
import { cn } from '../../lib/utils';
import { useSettings } from '../../store/settings';
import { useTools } from '../../store/tools';
import type { Unit } from '../../types';
import { Card, Chip, SectionTitle } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import { Stepper } from '../ui/Stepper';
import { Barbell } from './Barbell';
import { plateStyle } from './plateStyles';

const BARS: Record<Unit, { value: number; label: string }[]> = {
  kg: [
    { value: 20, label: '20 kg' },
    { value: 15, label: '15 kg' },
    { value: 10, label: '10 kg' },
    { value: 0, label: 'None' },
  ],
  lb: [
    { value: 45, label: '45 lb' },
    { value: 35, label: '35 lb' },
    { value: 15, label: '15 lb' },
    { value: 0, label: 'None' },
  ],
};

export function PlateCalculator() {
  const settingsUnit = useSettings((s) => s.unit);
  const tools = useTools();
  const unit = tools.unit ?? settingsUnit;
  const bar = tools.bar[unit];
  const plates = tools.plates[unit];
  const target = tools.target[unit];
  const all = unit === 'kg' ? KG_PLATES : LB_PLATES;
  const step = smallestIncrement(plates) || (unit === 'kg' ? 2.5 : 5);

  const result = useMemo(() => calculatePlates(target, bar, plates), [target, bar, plates]);
  const perSide = (result.achieved - bar) / 2;
  const isPresetBar = BARS[unit].some((b) => b.value === bar);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Target weight</p>
          <Segmented
            label="Unit"
            size="sm"
            value={unit}
            onChange={(u) => tools.set({ unit: u })}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
            className="w-28"
          />
        </div>
        <Stepper
          size="lg"
          label={`Target weight in ${unit}`}
          value={target}
          step={step}
          max={1000}
          onChange={(v) => tools.set({ target: { ...tools.target, [unit]: v ?? 0 } })}
        />

        <div aria-live="polite" className="text-center">
          <p className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Load per side</p>
          <p className="text-4xl font-bold tracking-tight tabular">
            {formatNumber(Math.max(0, perSide))} <span className="text-xl text-fg-2">{unit}</span>
          </p>
          {result.belowBar ? (
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-warning">
              <CircleAlert size={15} aria-hidden /> Target is lighter than the bar ({bar} {unit})
            </p>
          ) : result.remainder > 0 ? (
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-warning">
              <CircleAlert size={15} aria-hidden />
              Closest loadable: {formatNumber(result.achieved)} {unit} ({formatNumber(result.remainder)} short)
            </p>
          ) : (
            <p className="mt-1 text-sm text-fg-2">
              Total {formatNumber(result.achieved)} {unit} with a {bar ? `${bar} ${unit} bar` : 'no bar'}
            </p>
          )}
        </div>

        <Barbell stack={result.stack} unit={unit} />

        {result.perSide.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Plates per side">
            {result.perSide.map(({ plate, count }) => (
              <li
                key={plate}
                className="flex items-center gap-2 rounded-full bg-fill py-1.5 pr-3 pl-1.5 text-sm font-semibold tabular"
              >
                <span
                  aria-hidden
                  className="size-5 rounded-full"
                  style={{
                    background: plateStyle(plate, unit).color,
                    boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.15)',
                  }}
                />
                {count} × {formatNumber(plate)} {unit}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div>
        <SectionTitle>Bar</SectionTitle>
        <Card className="space-y-3">
          <Segmented
            label="Bar weight"
            value={isPresetBar ? bar : -1}
            onChange={(v) => v >= 0 && tools.set({ bar: { ...tools.bar, [unit]: v } })}
            options={[
              ...BARS[unit].map((b) => ({ value: b.value, label: b.label })),
              ...(isPresetBar ? [] : [{ value: -1, label: `${bar} ${unit}` }]),
            ]}
          />
          <div className="flex items-center gap-3">
            <span className="flex-1 text-sm text-fg-2">Custom bar weight</span>
            <Stepper
              label={`Bar weight in ${unit}`}
              value={bar}
              step={unit === 'kg' ? 0.5 : 1}
              max={100}
              onChange={(v) => tools.set({ bar: { ...tools.bar, [unit]: v ?? 0 } })}
              className="w-44"
            />
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>Available plates</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {all.map((p) => {
            const on = plates.includes(p);
            return (
              <Chip
                key={p}
                selected={on}
                onClick={() =>
                  tools.set({
                    plates: {
                      ...tools.plates,
                      [unit]: on ? plates.filter((x) => x !== p) : [...plates, p].sort((a, b) => b - a),
                    },
                  })
                }
              >
                <span
                  aria-hidden
                  className={cn('size-3 rounded-full', !on && 'opacity-50')}
                  style={{ background: plateStyle(p, unit).color, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.2)' }}
                />
                {formatNumber(p)} {unit}
              </Chip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

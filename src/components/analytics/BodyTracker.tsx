import { useId, useMemo, useState } from 'react';
import { Plus, Ruler, Scale, Trash2 } from 'lucide-react';
import { MEASUREMENT_LABELS, measurementDelta, measurementSeries } from '../../lib/analytics';
import { formatDate, fromDateInput, toDateInput } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import {
  formatNumber,
  fromDisplayLength,
  fromDisplayWeight,
  lengthUnit,
  toDisplayLength,
  toDisplayWeight,
} from '../../lib/units';
import { cn, parseNumber, round, uid } from '../../lib/utils';
import { useData } from '../../store/data';
import { useNutrition } from '../../store/nutrition';
import { WeightGoalWidget } from '../widgets/WeightGoalWidget';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { confirm } from '../../store/ui';
import { MEASUREMENT_KEYS, type BodyMeasurement, type MeasurementKey, type Unit } from '../../types';
import { Button } from '../ui/Button';
import { Card, Chip, EmptyState, SectionTitle, StatTile } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';
import { MeasuredTrendChart } from './charts';

const LENGTH_KEYS = MEASUREMENT_KEYS.filter((k) => k !== 'weight' && k !== 'bodyFat');

/** Converts a stored value (kg / % / cm) to display units. */
function toDisplay(key: MeasurementKey, v: number, unit: Unit) {
  if (key === 'weight') return toDisplayWeight(v, unit);
  if (key === 'bodyFat') return v;
  return toDisplayLength(v, unit);
}

function unitLabel(key: MeasurementKey, unit: Unit) {
  return key === 'weight' ? unit : key === 'bodyFat' ? '%' : lengthUnit(unit);
}

export function BodyTracker() {
  const entries = useData((s) => s.measurements);
  const unit = useSettings((s) => s.unit);
  const [metric, setMetric] = useState<MeasurementKey>('weight');
  const [editing, setEditing] = useState<BodyMeasurement | 'new' | null>(null);
  const targetKg = useNutrition((s) => s.weightGoal?.targetKg);

  const available = useMemo(
    () => MEASUREMENT_KEYS.filter((k) => entries.some((e) => typeof e.values[k] === 'number')),
    [entries],
  );
  const series = useMemo(() => measurementSeries(entries, metric), [entries, metric]);
  const fmt = (v: number) => `${formatNumber(toDisplay(metric, v, unit), 1)} ${unitLabel(metric, unit)}`;

  const tile = (key: MeasurementKey) => {
    const latest = entries.find((e) => typeof e.values[key] === 'number')?.values[key];
    const delta = measurementDelta(entries, key);
    return {
      value: latest !== undefined ? `${formatNumber(toDisplay(key, latest, unit), 1)}` : '—',
      sub:
        delta !== null && Math.abs(delta) > 0.001
          ? `${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(toDisplay(key, delta, unit)), 1)} ${unitLabel(key, unit)} · 30d`
          : unitLabel(key, unit),
    };
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {(['weight', 'bodyFat', 'waist'] as const).map((k) => {
          const t = tile(k);
          return (
            <StatTile key={k} label={k === 'weight' ? 'Weight' : MEASUREMENT_LABELS[k]} value={t.value} sub={t.sub} />
          );
        })}
      </div>

      <Button variant="primary" size="lg" block icon={Plus} onClick={() => setEditing('new')}>
        Log measurements
      </Button>

      <WeightGoalWidget />

      {entries.length === 0 ? (
        <Card>
          <EmptyState icon={Scale} title="Track your body" className="py-6">
            Log body weight, body fat and circumferences to see trend lines over time.
          </EmptyState>
        </Card>
      ) : (
        <>
          <section aria-label="Measurement chart">
            <SectionTitle>Trend</SectionTitle>
            <div
              className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 no-scrollbar"
              role="group"
              aria-label="Measurement"
            >
              {(available.length ? available : (['weight'] as MeasurementKey[])).map((k) => (
                <Chip key={k} selected={metric === k} onClick={() => setMetric(k)}>
                  {MEASUREMENT_LABELS[k]}
                </Chip>
              ))}
            </div>
            <Card>
              {series.length >= 2 ? (
                <MeasuredTrendChart
                  data={series}
                  name={MEASUREMENT_LABELS[metric]}
                  format={fmt}
                  target={metric === 'weight' ? targetKg : undefined}
                />
              ) : (
                <EmptyState icon={Ruler} title="One more entry needed" className="py-6">
                  Log {MEASUREMENT_LABELS[metric].toLowerCase()} at least twice to draw a trend.
                </EmptyState>
              )}
            </Card>
          </section>

          <section aria-label="Entries">
            <SectionTitle>Entries</SectionTitle>
            <ul className="space-y-2">
              {entries.slice(0, 30).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(e)}
                    className="surface w-full rounded-2xl p-3 text-left transition-transform active:scale-[0.98]"
                  >
                    <p className="text-sm font-semibold">{formatDate(e.date)}</p>
                    <p className="mt-0.5 text-[13px] text-fg-2 tabular">
                      {MEASUREMENT_KEYS.filter((k) => e.values[k] !== undefined)
                        .map(
                          (k) =>
                            `${MEASUREMENT_LABELS[k]} ${formatNumber(toDisplay(k, e.values[k] as number, unit), 1)}${
                              k === 'bodyFat' ? '%' : ''
                            }`,
                        )
                        .join(' · ')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <MeasurementForm entry={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function MeasurementForm({ entry, onClose }: { entry: BodyMeasurement | 'new' | null; onClose: () => void }) {
  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      size="full"
      title={entry === 'new' ? 'Log measurements' : 'Edit measurements'}
      description="Fill in only what you measured."
    >
      {entry !== null && <FormBody entry={entry === 'new' ? null : entry} onClose={onClose} />}
    </Sheet>
  );
}

function FormBody({ entry, onClose }: { entry: BodyMeasurement | null; onClose: () => void }) {
  const unit = useSettings((s) => s.unit);
  const entries = useData((s) => s.measurements);
  const saveMeasurement = useData((s) => s.saveMeasurement);
  const deleteMeasurement = useData((s) => s.deleteMeasurement);
  const dateId = useId();
  const last = entries[0]?.values;

  const initial = (k: MeasurementKey) => {
    const v = entry?.values[k];
    return v === undefined ? null : round(toDisplay(k, v, unit), 1);
  };
  const [date, setDate] = useState(() => toDateInput(entry?.date ?? Date.now()));
  const [today] = useState(() => toDateInput(Date.now()));
  const [weight, setWeight] = useState<number | null>(initial('weight'));
  const [bodyFat, setBodyFat] = useState<number | null>(initial('bodyFat'));
  const [lengths, setLengths] = useState<Record<string, string>>(() =>
    Object.fromEntries(LENGTH_KEYS.map((k) => [k, initial(k)?.toString() ?? ''])),
  );

  const save = () => {
    const values: BodyMeasurement['values'] = {};
    if (weight) values.weight = fromDisplayWeight(weight, unit);
    if (bodyFat) values.bodyFat = bodyFat;
    for (const k of LENGTH_KEYS) {
      const n = parseNumber(lengths[k] ?? '');
      if (n && n > 0) values[k] = fromDisplayLength(n, unit);
    }
    if (!Object.keys(values).length) {
      haptic('warning');
      toast.error('Nothing to save', 'Enter at least one measurement.');
      return;
    }
    saveMeasurement({ id: entry?.id ?? uid(), date: fromDateInput(date), values });
    haptic('success');
    toast.success('Measurements saved');
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    const ok = await confirm({ title: 'Delete this entry?', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    deleteMeasurement(entry.id);
    onClose();
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="space-y-1.5">
        <label htmlFor={dateId} className="block px-1 text-[13px] font-semibold text-fg-2">
          Date
        </label>
        <input
          id={dateId}
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="field"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="px-1 text-[13px] font-semibold text-fg-2">Body weight ({unit})</p>
          <Stepper
            label={`Body weight in ${unit}`}
            value={weight}
            onChange={setWeight}
            step={unit === 'kg' ? 0.1 : 0.2}
            decimals={1}
            max={500}
            placeholder={last?.weight ? round(toDisplayWeight(last.weight, unit), 1) : null}
          />
        </div>
        <div className="space-y-1.5">
          <p className="px-1 text-[13px] font-semibold text-fg-2">Body fat (%)</p>
          <Stepper
            label="Body fat percentage"
            value={bodyFat}
            onChange={setBodyFat}
            step={0.1}
            decimals={1}
            max={70}
            placeholder={last?.bodyFat ?? null}
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 px-1 text-[13px] font-semibold text-fg-2">Circumferences ({lengthUnit(unit)})</legend>
        <div className="grid grid-cols-2 gap-2">
          {LENGTH_KEYS.map((k) => (
            <label key={k} className="flex items-center gap-2 rounded-xl bg-fill pr-3 pl-3.5">
              <span className="min-w-0 flex-1 truncate text-sm text-fg-2">{MEASUREMENT_LABELS[k]}</span>
              <input
                inputMode="decimal"
                value={lengths[k]}
                onChange={(e) => setLengths((l) => ({ ...l, [k]: e.target.value.replace(/[^\d.,]/g, '') }))}
                placeholder={last?.[k] ? formatNumber(toDisplayLength(last[k] as number, unit), 1) : '–'}
                className={cn(
                  'h-12 w-16 bg-transparent text-right font-semibold tabular outline-none placeholder:text-muted/60',
                )}
                aria-label={`${MEASUREMENT_LABELS[k]} in ${lengthUnit(unit)}`}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        {entry && (
          <Button
            variant="danger"
            size="icon"
            icon={Trash2}
            aria-label="Delete entry"
            feedback="warning"
            onClick={remove}
          />
        )}
        <Button variant="primary" size="lg" block onClick={save} feedback={false}>
          Save
        </Button>
      </div>
    </div>
  );
}

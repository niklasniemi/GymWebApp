import { useState } from 'react';
import { Check, Scale } from 'lucide-react';
import {
  ACTIVITY_LEVELS,
  computeTargets,
  MACROS,
  tdee,
  type NutritionProfile,
  type Targets,
} from '../../lib/nutrition';
import {
  formatNumber,
  fromDisplayLength,
  fromDisplayWeight,
  KG_PER_LB,
  lengthUnit,
  toDisplayLength,
  toDisplayWeight,
} from '../../lib/units';
import { cn, round } from '../../lib/utils';
import { useNutrition, useLatestWeight, type NutritionPrefs } from '../../store/nutrition';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { Button } from '../ui/Button';
import { Field } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';
import { SwitchRow } from '../ui/Switch';

export function GoalsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Calorie & macro goals"
      description="Estimated from your body, activity and goal."
      size="full"
    >
      <GoalsForm onDone={onClose} />
    </Sheet>
  );
}

type Draft = Omit<NutritionPrefs, 'configured'>;

function GoalsForm({ onDone }: { onDone: () => void }) {
  const unit = useSettings((s) => s.unit);
  const measured = useLatestWeight();
  const [draft, setDraft] = useState<Draft>(() => {
    const { profile, auto, manual, addExercise, onlineSearch } = useNutrition.getState();
    return { profile, auto, manual, addExercise, onlineSearch };
  });
  const p = draft.profile;
  const weightKg = measured ?? p.weightKg;
  const computed = computeTargets(p, weightKg);
  const maintenance = Math.round(tdee(p, weightKg) / 10) * 10;

  const setProfile = (patch: Partial<NutritionProfile>) =>
    setDraft((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const setManual = (patch: Partial<Targets>) => setDraft((d) => ({ ...d, manual: { ...d.manual, ...patch } }));

  const rates = unit === 'kg' ? [0.25, 0.5, 0.75, 1] : [0.5, 1, 1.5, 2].map((lb) => round(lb * KG_PER_LB, 3));
  const rateLabel = (kg: number) => (unit === 'kg' ? `${kg} kg` : `${formatNumber(kg / KG_PER_LB, 1)} lb`);

  const save = () => {
    useNutrition.getState().update({ ...draft, configured: true });
    toast.success('Goals saved');
    onDone();
  };

  const shown = draft.auto ? computed : draft.manual;

  return (
    <div className="space-y-6 pb-4">
      <section className="space-y-3" aria-label="About you">
        <Segmented
          label="Sex"
          value={p.sex}
          onChange={(sex) => setProfile({ sex })}
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <Stepper
              value={p.age}
              onChange={(v) => v !== null && setProfile({ age: v })}
              step={1}
              min={14}
              max={100}
              decimals={0}
              inputMode="numeric"
              label="Age in years"
            />
          </Field>
          <Field label={`Height (${lengthUnit(unit)})`}>
            <Stepper
              value={round(toDisplayLength(p.heightCm, unit), unit === 'kg' ? 0 : 1)}
              onChange={(v) => v !== null && setProfile({ heightCm: round(fromDisplayLength(v, unit), 1) })}
              step={1}
              min={unit === 'kg' ? 120 : 48}
              max={unit === 'kg' ? 230 : 90}
              decimals={unit === 'kg' ? 0 : 1}
              label={`Height in ${lengthUnit(unit)}`}
            />
          </Field>
        </div>
        {measured !== undefined ? (
          <p className="flex items-center gap-2 rounded-xl bg-fill px-3.5 py-3 text-sm">
            <Scale size={16} className="shrink-0 text-accent-text" aria-hidden />
            <span>
              Using your latest weigh-in:{' '}
              <span className="font-semibold tabular">
                {formatNumber(toDisplayWeight(measured, unit), 1)} {unit}
              </span>
              . Targets follow your weight as you log it.
            </span>
          </p>
        ) : (
          <Field label={`Weight (${unit})`} hint="Log your weight under Analytics → Body to keep this up to date.">
            <Stepper
              value={round(toDisplayWeight(p.weightKg, unit), 1)}
              onChange={(v) => v !== null && setProfile({ weightKg: round(fromDisplayWeight(v, unit), 2) })}
              step={unit === 'kg' ? 0.5 : 1}
              min={unit === 'kg' ? 30 : 66}
              max={unit === 'kg' ? 300 : 660}
              decimals={1}
              label={`Body weight in ${unit}`}
            />
          </Field>
        )}
      </section>

      <fieldset className="space-y-2">
        <legend className="px-1 pb-2 text-[13px] font-semibold text-fg-2">Activity</legend>
        <div role="radiogroup" aria-label="Activity level" className="space-y-1.5">
          {ACTIVITY_LEVELS.map((a) => {
            const selected = p.activity === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setProfile({ activity: a.id })}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-xl border px-3.5 text-left transition-transform active:scale-[0.99]',
                  selected ? 'border-accent-text bg-accent-soft' : 'border-transparent bg-fill',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{a.label}</span>
                  <span className="block text-[13px] text-fg-2">{a.detail}</span>
                </span>
                {selected && <Check size={18} className="shrink-0 text-accent-text" aria-hidden />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <section className="space-y-3" aria-label="Goal">
        <p className="px-1 text-[13px] font-semibold text-fg-2">Goal</p>
        <Segmented
          label="Goal"
          value={p.goal}
          onChange={(goal) => setProfile({ goal })}
          options={[
            { value: 'lose', label: 'Lose fat' },
            { value: 'maintain', label: 'Maintain' },
            { value: 'gain', label: 'Build muscle' },
          ]}
        />
        {p.goal !== 'maintain' && (
          <Segmented
            label="Rate per week"
            size="sm"
            value={rates.reduce((best, r) => (Math.abs(r - p.rate) < Math.abs(best - p.rate) ? r : best), rates[1])}
            onChange={(rate) => setProfile({ rate })}
            options={rates.map((r) => ({ value: r, label: `${rateLabel(r)}/wk` }))}
          />
        )}
        {p.goal === 'gain' && p.rate > 0.5 && (
          <p className="px-1 text-xs text-muted">Slower gains (≈0.25 kg/week) keep fat gain lower for most lifters.</p>
        )}
      </section>

      <section aria-label="Your targets" className="surface space-y-4 rounded-2xl p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-fg-2 uppercase">Daily target</p>
            <p className="text-4xl font-bold tracking-tight tabular">
              {shown.kcal.toLocaleString()} <span className="text-base font-semibold text-fg-2">kcal</span>
            </p>
          </div>
          <p className="pb-1 text-right text-xs text-fg-2">
            Maintenance
            <br />
            <span className="font-semibold text-fg tabular">≈ {maintenance.toLocaleString()} kcal</span>
          </p>
        </div>
        <dl className="grid grid-cols-4 gap-2">
          {MACROS.map((m) => (
            <div key={m.key} className="rounded-xl bg-fill px-2.5 py-2">
              <dt className="flex items-center gap-1 text-[11px] font-semibold text-fg-2">
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: m.color }} />
                {m.label}
              </dt>
              <dd className="text-[15px] font-bold whitespace-nowrap tabular">{shown[m.key]} g</dd>
            </div>
          ))}
          <div className="rounded-xl bg-fill px-2.5 py-2">
            <dt className="flex items-center gap-1 text-[11px] font-semibold text-fg-2">
              <span aria-hidden className="size-1.5 rounded-full bg-water" />
              Water
            </dt>
            <dd className="text-[15px] font-bold whitespace-nowrap tabular">
              {formatNumber(shown.waterMl / 1000, 1)} L
            </dd>
          </div>
        </dl>
        <SwitchRow
          checked={!draft.auto}
          onChange={(manual) =>
            setDraft((d) => ({ ...d, auto: !manual, manual: manual && d.auto ? computed : d.manual }))
          }
          label="Set targets manually"
          description="Override the estimate with your own numbers"
        />
        {!draft.auto && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calories (kcal)">
              <Stepper
                value={draft.manual.kcal}
                onChange={(v) => v !== null && setManual({ kcal: v })}
                step={50}
                min={800}
                max={8000}
                decimals={0}
                inputMode="numeric"
                label="Calorie target"
              />
            </Field>
            <Field label="Protein (g)">
              <Stepper
                value={draft.manual.protein}
                onChange={(v) => v !== null && setManual({ protein: v })}
                step={5}
                max={500}
                decimals={0}
                inputMode="numeric"
                label="Protein target in grams"
              />
            </Field>
            <Field label="Carbs (g)">
              <Stepper
                value={draft.manual.carbs}
                onChange={(v) => v !== null && setManual({ carbs: v })}
                step={5}
                max={1000}
                decimals={0}
                inputMode="numeric"
                label="Carb target in grams"
              />
            </Field>
            <Field label="Fat (g)">
              <Stepper
                value={draft.manual.fat}
                onChange={(v) => v !== null && setManual({ fat: v })}
                step={5}
                max={400}
                decimals={0}
                inputMode="numeric"
                label="Fat target in grams"
              />
            </Field>
            <Field label="Water (ml)">
              <Stepper
                value={draft.manual.waterMl}
                onChange={(v) => v !== null && setManual({ waterMl: v })}
                step={250}
                max={8000}
                decimals={0}
                inputMode="numeric"
                label="Water target in millilitres"
              />
            </Field>
          </div>
        )}
      </section>

      <section className="surface rounded-2xl px-4 py-1" aria-label="Options">
        <SwitchRow
          checked={draft.addExercise}
          onChange={(addExercise) => setDraft((d) => ({ ...d, addExercise }))}
          label="Add workout calories"
          description="Raise the day's budget by the estimated energy of your workouts"
        />
      </section>

      <p className="px-1 text-xs text-muted">
        Estimates use the Mifflin-St Jeor equation; protein 1.8–2.0 g per kg, fat at least 25% of energy. They're a
        starting point, not medical advice — adjust after 2–3 weeks based on your weight trend.
      </p>

      <Button size="lg" variant="primary" block feedback="success" onClick={save}>
        Save goals
      </Button>
    </div>
  );
}

import { useState } from 'react';
import { estimate1RM, weightForReps } from '../../lib/calc';
import { formatNumber } from '../../lib/units';
import { useSettings } from '../../store/settings';
import { Card, SectionTitle } from '../ui/primitives';
import { Stepper } from '../ui/Stepper';

const PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

/** Epley estimator: 1RM = w × (1 + r/30), with a %1RM training table. */
export function OneRepMax() {
  const unit = useSettings((s) => s.unit);
  const [weight, setWeight] = useState<number | null>(unit === 'kg' ? 100 : 225);
  const [reps, setReps] = useState<number | null>(5);
  const orm = estimate1RM(weight, reps);

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="px-1 text-[13px] font-semibold text-fg-2">Weight ({unit})</p>
            <Stepper
              label={`Weight in ${unit}`}
              value={weight}
              onChange={setWeight}
              step={unit === 'kg' ? 2.5 : 5}
              max={1000}
            />
          </div>
          <div className="space-y-1.5">
            <p className="px-1 text-[13px] font-semibold text-fg-2">Reps</p>
            <Stepper
              label="Reps"
              value={reps}
              onChange={setReps}
              step={1}
              min={1}
              max={30}
              decimals={0}
              inputMode="numeric"
            />
          </div>
        </div>
        <div aria-live="polite" className="text-center">
          <p className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Estimated 1RM</p>
          <p className="text-5xl font-bold tracking-tight tabular">
            {orm ? formatNumber(orm, 1) : '—'} <span className="text-2xl text-fg-2">{unit}</span>
          </p>
          <p className="mt-1 text-xs text-muted">Epley: weight × (1 + reps ÷ 30)</p>
        </div>
      </Card>

      {orm > 0 && (
        <div>
          <SectionTitle>Training percentages</SectionTitle>
          <Card padded={false} className="overflow-hidden">
            <table className="w-full text-left text-sm tabular">
              <thead className="bg-fill text-[12px] tracking-wide text-fg-2 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    % 1RM
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Weight
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    ≈ Reps
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {PERCENTS.map((p) => {
                  const w = (orm * p) / 100;
                  // Invert Epley for reps at this load.
                  const r = p === 100 ? 1 : Math.round(30 * (100 / p - 1));
                  return (
                    <tr key={p}>
                      <td className="px-4 py-2.5 font-semibold">{p}%</td>
                      <td className="px-4 py-2.5">
                        {formatNumber(w, 1)} {unit}
                      </td>
                      <td className="px-4 py-2.5 text-right text-fg-2">{r}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <p className="mt-2 px-1 text-xs text-muted">
            Rep estimates use the inverse Epley formula (e.g. {formatNumber(weightForReps(orm, 8), 1)} {unit} for 8
            reps). Most accurate below 10 reps.
          </p>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ChartLine } from 'lucide-react';
import { sessionSeries, type SessionPoint } from '../../lib/history';
import { formatNumber, formatVolume, fromDisplayWeight, toDisplayWeight } from '../../lib/units';
import { useHistoryIndex } from '../../store/data';
import { useSettings } from '../../store/settings';
import { EmptyState } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import { TrendChart } from './charts';

type Metric = 'e1rm' | 'weight' | 'volume' | 'reps';

const METRICS: { value: Metric; label: string; name: string }[] = [
  { value: 'e1rm', label: 'Est. 1RM', name: 'Estimated 1RM' },
  { value: 'weight', label: 'Heaviest', name: 'Heaviest weight' },
  { value: 'volume', label: 'Volume', name: 'Session volume' },
  { value: 'reps', label: 'Reps', name: 'Most reps' },
];

/** Strength curve for one exercise. Default export so it can be lazy-loaded. */
export default function ExerciseProgress({ exerciseId, bodyweight }: { exerciseId: string; bodyweight?: boolean }) {
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  const [metric, setMetric] = useState<Metric>(bodyweight ? 'reps' : 'e1rm');
  const points = useMemo(() => sessionSeries(history.sessions.get(exerciseId)), [history, exerciseId]);

  if (points.length < 2) {
    return (
      <EmptyState icon={ChartLine} title="Not enough data yet" className="py-6">
        Log this exercise in at least two workouts to see your strength curve.
      </EmptyState>
    );
  }

  const pick = (p: SessionPoint) => (metric === 'reps' ? p.reps : toDisplayWeight(p[metric], unit));
  const data = points.map((p) => ({ date: p.date, value: pick(p) })).filter((d) => d.value > 0);
  const format =
    metric === 'reps'
      ? (v: number) => `${formatNumber(v, 0)} reps`
      : metric === 'volume'
        ? (v: number) => formatVolume(fromDisplayWeight(v, unit), unit)
        : (v: number) => `${formatNumber(v, 1)} ${unit}`;
  const def = METRICS.find((m) => m.value === metric) ?? METRICS[0];

  return (
    <div className="space-y-3">
      <Segmented
        label="Chart metric"
        size="sm"
        value={metric}
        onChange={setMetric}
        options={METRICS.filter((m) => !bodyweight || m.value === 'reps' || m.value === 'volume').map((m) => ({
          value: m.value,
          label: m.label,
        }))}
      />
      <TrendChart data={data} name={def.name} format={format} />
    </div>
  );
}

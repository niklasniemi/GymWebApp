import { memo, useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChartNoAxesCombined, Clock, Layers, Target, Trophy, Weight } from 'lucide-react';
import { BodyTracker } from '../components/analytics/BodyTracker';
import { PeriodBarChart } from '../components/analytics/charts';
import ExerciseProgress from '../components/analytics/ExerciseProgress';
import { Heatmap } from '../components/analytics/Heatmap';
import { Card, EmptyState, PageHeader, SectionTitle, StatTile } from '../components/ui/primitives';
import { Segmented } from '../components/ui/Segmented';
import { Select } from '../components/ui/primitives';
import { MUSCLE_LABELS } from '../data/exercises';
import { inRange, muscleSplit, RANGES, recentPRs, volumeBuckets, type RangeKey } from '../lib/analytics';
import { formatDate, formatDuration } from '../lib/format';
import { PR_LABELS, workoutPRCount, workoutVolume } from '../lib/history';
import { displayWeight, formatNumber, formatVolume, formatWeight, toDisplayWeight } from '../lib/units';
import { exerciseName, useExerciseMap, useHistoryIndex } from '../store/data';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';

type View = 'overview' | 'exercises' | 'body';

export default function AnalyticsPage() {
  const [view, setView] = useState<View>('overview');
  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="Analytics" subtitle="Progress" />
      <Segmented
        label="Analytics section"
        value={view}
        onChange={setView}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'exercises', label: 'Strength' },
          { value: 'body', label: 'Body' },
        ]}
      />
      {view === 'overview' && <Overview />}
      {view === 'exercises' && <StrengthView />}
      {view === 'body' && <BodyTracker />}
    </div>
  );
}

function Overview() {
  const history = useHistoryIndex();
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const openExercise = useUI((s) => s.openExercise);
  const [range, setRange] = useState<RangeKey>('12w');

  const workouts = useMemo(() => inRange(history.sorted, range), [history, range]);
  const buckets = useMemo(() => volumeBuckets(history.sorted, range), [history, range]);
  const split = useMemo(() => muscleSplit(workouts, exMap), [workouts, exMap]);
  const prs = useMemo(() => recentPRs(history.sorted), [history]);

  if (!history.sorted.length) {
    return (
      <Card>
        <EmptyState icon={ChartNoAxesCombined} title="Your progress lives here">
          Finish your first workout to unlock volume trends, frequency, strength curves and PRs.
        </EmptyState>
      </Card>
    );
  }

  const totalVolume = workouts.reduce((n, w) => n + workoutVolume(w), 0);
  const avgDuration = workouts.length
    ? workouts.reduce((n, w) => n + ((w.endedAt ?? w.startedAt) - w.startedAt), 0) / workouts.length
    : 0;
  const prCount = workouts.reduce((n, w) => n + workoutPRCount(w), 0);
  const monthly = range === '1y' || range === 'all';

  return (
    <div className="space-y-5">
      <Segmented
        label="Time range"
        size="sm"
        value={range}
        onChange={setRange}
        options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={CalendarDays} label="Workouts" value={workouts.length} />
        <StatTile icon={Weight} label="Volume" value={formatVolume(totalVolume, unit, false)} sub={unit} />
        <StatTile icon={Clock} label="Avg time" value={formatDuration(avgDuration)} />
        <StatTile icon={Trophy} label="PRs" value={prCount} />
      </div>

      <section aria-label="Volume trend">
        <SectionTitle>Volume per {monthly ? 'month' : 'week'}</SectionTitle>
        <Card>
          <PeriodBarChart
            data={buckets.map((b) => ({ ...b, value: toDisplayWeight(b.value, unit) }))}
            name="Volume"
            format={(v) => `${formatNumber(v, 0)} ${unit}`}
            tickFormat={(v) => (v >= 1000 ? `${formatNumber(v / 1000, 1)}k` : formatNumber(v, 0))}
          />
        </Card>
      </section>

      <section aria-label="Training frequency">
        <SectionTitle>Frequency</SectionTitle>
        <Card>
          <Heatmap workouts={history.sorted} unit={unit} />
        </Card>
      </section>

      <section aria-label="Muscle split">
        <SectionTitle>Working sets by muscle</SectionTitle>
        <Card>
          <MuscleBars data={split} />
        </Card>
      </section>

      {prs.length > 0 && (
        <section aria-label="Recent personal records">
          <SectionTitle>Recent PRs</SectionTitle>
          <Card padded={false} className="divide-y divide-line overflow-hidden">
            {prs.map((p) => (
              <button
                key={p.set.id}
                type="button"
                onClick={() => openExercise(p.exerciseId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-transform active:scale-[0.99]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
                  <Trophy size={17} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{exerciseName(exMap, p.exerciseId)}</span>
                  <span className="block truncate text-xs text-fg-2">
                    {formatDate(p.date)} · {p.prs.map((x) => PR_LABELS[x]).join(', ')}
                  </span>
                </span>
                <span className="shrink-0 font-bold tabular">
                  {p.set.weight ? `${formatNumber(displayWeight(p.set.weight, unit) ?? 0)} × ` : ''}
                  {p.set.reps}
                </span>
              </button>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

const MuscleBars = memo(function MuscleBars({
  data,
}: {
  data: { muscle: keyof typeof MUSCLE_LABELS; sets: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.sets));
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={d.muscle} className="flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0 text-fg-2">{MUSCLE_LABELS[d.muscle]}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-fill" aria-hidden>
            <motion.span
              className="block h-full origin-left rounded-full bg-[var(--chart-1)]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: d.sets / max }}
              transition={{ type: 'spring', stiffness: 160, damping: 24, delay: i * 0.04 }}
            />
          </span>
          <span className="w-10 shrink-0 text-right font-semibold tabular">
            {d.sets}
            <span className="sr-only"> sets</span>
          </span>
        </li>
      ))}
    </ul>
  );
});

function StrengthView() {
  const history = useHistoryIndex();
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const selectId = useId();

  const options = useMemo(
    () =>
      [...history.sessions.entries()]
        .map(([id, sessions]) => ({ id, name: exerciseName(exMap, id), count: sessions.length }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    [history, exMap],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const exerciseId = picked && history.sessions.has(picked) ? picked : options[0]?.id;

  if (!exerciseId) {
    return (
      <Card>
        <EmptyState icon={Target} title="No strength data yet">
          Complete sets in a workout and your strength curves will appear here.
        </EmptyState>
      </Card>
    );
  }

  const ex = exMap.get(exerciseId);
  const bests = history.bests.get(exerciseId);
  const sessions = history.sessions.get(exerciseId) ?? [];
  const bodyweight = ex?.equipment === 'bodyweight';

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={selectId} className="mb-1.5 block px-1 text-[13px] font-semibold text-fg-2">
          Exercise
        </label>
        <Select id={selectId} value={exerciseId} onChange={(e) => setPicked(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.count})
            </option>
          ))}
        </Select>
      </div>

      {bests && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {!bodyweight && <StatTile icon={Target} label="Est. 1RM" value={formatWeight(bests.e1rm, unit, true, 1)} />}
          {!bodyweight && <StatTile icon={Trophy} label="Heaviest" value={formatWeight(bests.weight, unit)} />}
          <StatTile icon={Layers} label="Most reps" value={bests.reps} />
          <StatTile icon={CalendarDays} label="Sessions" value={sessions.length} />
        </div>
      )}

      <Card>
        <ExerciseProgress key={exerciseId} exerciseId={exerciseId} bodyweight={bodyweight} />
      </Card>
    </div>
  );
}

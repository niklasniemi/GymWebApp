import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Calculator, Flame, Percent, Scale, Trophy } from 'lucide-react';
import { MUSCLE_NAMES } from '../../data/anatomy';
import { measurementDelta, measurementSeries, recentPRs } from '../../lib/analytics';
import { formatDate, formatRelativeDay } from '../../lib/format';
import { PR_LABELS, sessionSeries } from '../../lib/history';
import { rankMuscles, workoutsMuscleLoad } from '../../lib/muscles';
import { displayWeight, formatNumber, formatWeight, toDisplayWeight } from '../../lib/units';
import { cn } from '../../lib/utils';
import { exerciseName, useData, useExerciseMap, useHistoryIndex } from '../../store/data';
import { useFavorites } from '../../store/favorites';
import { useSettings } from '../../store/settings';
import { navigate } from '../../store/ui';
import type { Workout } from '../../types';
import { Heatmap } from '../analytics/Heatmap';
import { Sparkline } from '../analytics/Sparkline';
import { MuscleMap } from '../body/MuscleMap';
import { Card } from '../ui/primitives';
import { WidgetFrame } from './WidgetBoard';

const openLift = (id: string) => navigate('analytics', 'strength', id);

/** Favourite lifts (or the most-trained ones) with their e1RM trend. */
export function KeyLiftsWidget() {
  const history = useHistoryIndex();
  const exMap = useExerciseMap();
  const favorites = useFavorites((s) => s.ids);
  const unit = useSettings((s) => s.unit);

  const rows = useMemo(() => {
    const trained = [...history.sessions.keys()];
    const picked = favorites.filter((id) => history.sessions.has(id));
    const ids = (
      picked.length ? picked : trained.sort((a, b) => history.sessions.get(b)!.length - history.sessions.get(a)!.length)
    ).slice(0, 4);
    return ids.map((id) => {
      const bodyweight = exMap.get(id)?.equipment === 'bodyweight';
      const series = sessionSeries(history.sessions.get(id)).map((p) => (bodyweight ? p.reps : p.e1rm));
      const current = series[series.length - 1] ?? 0;
      const first = series[0] ?? 0;
      return {
        id,
        name: exerciseName(exMap, id),
        bodyweight,
        series: series.slice(-12),
        current,
        change: current - first,
      };
    });
  }, [history, exMap, favorites]);

  return (
    <WidgetFrame
      title={favorites.length ? 'Favourite lifts' : 'Key lifts'}
      action="All lifts"
      onAction={() => navigate('analytics', 'strength')}
    >
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-fg-2">
            Log a workout and your strongest lifts show up here. Star exercises to pin them.
          </p>
        </Card>
      ) : (
        <Card padded={false} className="divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openLift(r.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-transform active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="block text-xs text-fg-2">{r.bodyweight ? 'Best reps' : 'Est. 1RM'}</span>
              </span>
              <Sparkline values={r.series} />
              <span className="w-20 shrink-0 text-right">
                <span className="block text-sm font-bold tabular">
                  {r.bodyweight ? `${r.current} reps` : formatWeight(r.current, unit, true, 1)}
                </span>
                {Math.abs(r.change) > 0.0001 && (
                  <span
                    className={cn(
                      'inline-flex items-center text-xs font-semibold tabular',
                      r.change > 0 ? 'text-success-text' : 'text-danger',
                    )}
                  >
                    {r.change > 0 ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
                    {r.bodyweight ? Math.abs(r.change) : formatNumber(Math.abs(toDisplayWeight(r.change, unit)), 1)}
                  </span>
                )}
              </span>
            </button>
          ))}
        </Card>
      )}
    </WidgetFrame>
  );
}

export function RecentPRsWidget({ limit = 3 }: { limit?: number }) {
  const history = useHistoryIndex();
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const prs = useMemo(() => recentPRs(history.sorted, limit), [history, limit]);

  return (
    <WidgetFrame title="Recent PRs" action="Lifts" onAction={() => navigate('analytics', 'strength')}>
      {prs.length === 0 ? (
        <Card>
          <p className="text-sm text-fg-2">Beat a previous best and it's celebrated here.</p>
        </Card>
      ) : (
        <Card padded={false} className="divide-y divide-line overflow-hidden">
          {prs.map((p) => (
            <button
              key={p.set.id}
              type="button"
              onClick={() => openLift(p.exerciseId)}
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
      )}
    </WidgetFrame>
  );
}

export function FrequencyWidget({ linkToAnalytics = true }: { linkToAnalytics?: boolean }) {
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  return (
    <WidgetFrame
      title="Training frequency"
      action={linkToAnalytics ? 'Analytics' : undefined}
      onAction={() => navigate('analytics', 'overview', 'frequency')}
    >
      <Card>
        <Heatmap workouts={history.sorted} unit={unit} />
      </Card>
    </WidgetFrame>
  );
}

/** Compact 3D heat map for a set of workouts, linking to the Muscles tab. */
export function MuscleMapWidget({
  workouts,
  title,
  floor,
  period,
}: {
  workouts: Workout[];
  title: string;
  floor: number;
  /** e.g. "this week" */
  period: string;
}) {
  const exMap = useExerciseMap();
  const load = useMemo(() => workoutsMuscleLoad(workouts, exMap), [workouts, exMap]);
  const top = rankMuscles(load).filter((r) => r.sets > 0);
  return (
    <WidgetFrame title={title} action="Details" onAction={() => navigate('analytics', 'muscles')}>
      <Card>
        <MuscleMap load={load} floor={floor} height={300} showList={false} emptyMessage={`No training ${period}.`} />
        {top.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {top.slice(0, 4).map((r) => (
              <span key={r.muscle} className="rounded-full bg-fill px-2.5 py-1 text-xs font-semibold">
                {MUSCLE_NAMES[r.muscle]} <span className="text-fg-2 tabular">{formatNumber(r.sets, 1)}</span>
              </span>
            ))}
          </div>
        )}
      </Card>
    </WidgetFrame>
  );
}

export function BodyWeightWidget() {
  const entries = useData((s) => s.measurements);
  const unit = useSettings((s) => s.unit);
  const series = useMemo(() => measurementSeries(entries, 'weight'), [entries]);
  const delta = useMemo(() => measurementDelta(entries, 'weight'), [entries]);
  const latest = series[series.length - 1];

  return (
    <WidgetFrame title="Body weight" action="Body" onAction={() => navigate('analytics', 'body')}>
      <button
        type="button"
        onClick={() => navigate('analytics', 'body')}
        className="surface flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-transform active:scale-[0.99]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
          <Scale size={20} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          {latest ? (
            <>
              <span className="block text-2xl font-bold tracking-tight tabular">
                {formatWeight(latest.value, unit, true, 1)}
              </span>
              <span className="block text-xs text-fg-2">
                {delta !== null && Math.abs(delta) > 0.001
                  ? `${delta > 0 ? '+' : '−'}${formatWeight(Math.abs(delta), unit, true, 1)} in 30 days · `
                  : ''}
                {formatRelativeDay(latest.date)}
              </span>
            </>
          ) : (
            <span className="block text-sm text-fg-2">No measurements yet — tap to log your weight.</span>
          )}
        </span>
        <Sparkline values={series.slice(-14).map((p) => p.trend)} width={80} height={32} />
      </button>
    </WidgetFrame>
  );
}

export function ToolsWidget() {
  const tools = [
    { id: 'plates', label: 'Plates', icon: Calculator },
    { id: 'warmup', label: 'Warm-up', icon: Flame },
    { id: '1rm', label: '1RM', icon: Percent },
  ];
  return (
    <WidgetFrame title="Tools">
      <div className="grid grid-cols-3 gap-2">
        {tools.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => navigate('utilities', id)}
            className="surface flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold transition-transform active:scale-95"
          >
            <Icon size={22} className="text-accent-text" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </WidgetFrame>
  );
}

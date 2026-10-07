import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Crown, Timer, Trophy } from 'lucide-react';
import { MUSCLE_NAMES } from '../../data/anatomy';
import { useMomentum } from '../../hooks/useMomentum';
import { periodBuckets, type RangeKey, bucketUnit } from '../../lib/analytics';
import { addDays, formatDate, formatDuration, formatShortDate, pluralize, startOfWeek } from '../../lib/format';
import { workoutSetCount, workoutVolume } from '../../lib/history';
import {
  lastSevenDays,
  lifetimeTotals,
  mostImproved,
  repZones,
  targetStatus,
  tonnageComparison,
  trainingTimes,
  WEEKLY_SET_TARGET,
  workoutRecords,
} from '../../lib/insights';
import { fireStage, momentumHistory } from '../../lib/momentum';
import { rankMuscles, workoutsMuscleLoad } from '../../lib/muscles';
import { formatNumber, formatVolume, formatWeight } from '../../lib/units';
import { cn } from '../../lib/utils';
import { exerciseName, useExerciseMap, useHistoryIndex } from '../../store/data';
import { useSettings } from '../../store/settings';
import { navigate } from '../../store/ui';
import type { Workout } from '../../types';
import { Card } from '../ui/primitives';
import { WidgetFrame } from '../widgets/WidgetBoard';
import { PeriodBarChart } from './charts';

const AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 11 } as const;
const GRID = { stroke: 'var(--chart-grid)', strokeWidth: 1, vertical: false } as const;

function Tip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: unknown;
  format: (v: number, l: unknown) => string;
}) {
  if (!active || !payload?.length || typeof payload[0].value !== 'number') return null;
  return (
    <div className="surface-float rounded-xl px-3 py-2 text-[13px] font-semibold">
      {format(payload[0].value, label)}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Workouts per week vs. the weekly goal (last 12 weeks). */
export function GoalWeeksWidget() {
  const history = useHistoryIndex();
  const goal = useSettings((s) => s.weeklyGoal);
  const [now] = useState(() => Date.now());
  const data = useMemo(() => {
    const start = addDays(startOfWeek(now), -11 * 7);
    const counts = new Map<number, number>();
    for (const w of history.sorted) {
      const k = startOfWeek(w.startedAt);
      if (k >= start) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from({ length: 12 }, (_, i) => {
      const k = addDays(start, i * 7);
      return { key: k, label: formatShortDate(k), value: counts.get(k) ?? 0, current: i === 11 };
    });
  }, [history, now]);
  const met = data.filter((d) => !d.current && d.value >= goal).length;
  const top = Math.max(goal + 1, ...data.map((d) => d.value));

  return (
    <WidgetFrame title="Weekly goal">
      <Card>
        <p className="mb-2 text-sm text-fg-2">
          Hit <span className="font-semibold text-fg">{goal}×/week</span> in{' '}
          <span className="font-semibold text-fg">{met} of the last 11</span> full weeks.
        </p>
        <div style={{ height: 190 }} className="-mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid {...GRID} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={28}
                allowDecimals={false}
                domain={[0, top]}
              />
              <Tooltip
                cursor={{ fill: 'var(--fill)' }}
                content={<Tip format={(v, l) => `${String(l)}: ${pluralize(v, 'workout')}${v >= goal ? ' ✓' : ''}`} />}
              />
              <ReferenceLine
                y={goal}
                stroke="var(--gold)"
                strokeWidth={1.5}
                label={{ value: `Goal ${goal}`, position: 'insideTopRight', fill: 'var(--fg-2)', fontSize: 11 }}
              />
              <Bar dataKey="value" maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell
                    key={d.key}
                    fill={d.value >= goal ? 'var(--chart-1)' : 'var(--fill-strong)'}
                    fillOpacity={d.current && d.value < goal ? 0.6 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 flex items-center gap-3 text-xs text-fg-2" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[var(--chart-1)]" /> Goal met
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-fill-strong" /> Below goal
          </span>
        </p>
      </Card>
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------

/** The fire over the last 60 days. */
export function MomentumHistoryWidget() {
  const { events, level } = useMomentum();
  const [now] = useState(() => Date.now());
  const data = useMemo(() => momentumHistory(events, 60, now), [events, now]);
  const peak = Math.max(...data.map((d) => d.value));
  return (
    <WidgetFrame title="Momentum history" action="Workout" onAction={() => navigate('workout')}>
      <Card>
        <p className="mb-2 text-sm text-fg-2">
          Now{' '}
          <span className="font-semibold text-fg">
            {level}% · {fireStage(level).label}
          </span>{' '}
          · 60-day peak <span className="font-semibold text-fg">{peak}%</span>
        </p>
        <div style={{ height: 170 }} className="-mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="momentum-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID} />
              <XAxis
                dataKey="date"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) => formatShortDate(v)}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                minTickGap={32}
              />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={32}
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
                content={<Tip format={(v, l) => `${formatShortDate(Number(l))}: ${v}% · ${fireStage(v).label}`} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#momentum-fill)"
                dot={false}
                activeDot={{ r: 5, fill: '#f97316', stroke: 'var(--surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LONG = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

/** Weekday and time-of-day habits. */
export const WhenYouTrainWidget = memo(function WhenYouTrainWidget({ workouts }: { workouts: Workout[] }) {
  const { weekdays, parts } = useMemo(() => trainingTimes(workouts), [workouts]);
  const max = Math.max(1, ...weekdays);
  const total = workouts.length;
  const topDay = weekdays.indexOf(Math.max(...weekdays));
  const topPart = [...parts].sort((a, b) => b.count - a.count)[0];
  return (
    <WidgetFrame title="When you train">
      <Card>
        {total === 0 ? (
          <p className="text-sm text-fg-2">No workouts in this range.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-fg-2">
              Mostly on <span className="font-semibold text-fg">{WEEKDAY_LONG[topDay]}</span>, in the{' '}
              <span className="font-semibold text-fg">{topPart.label.toLowerCase()}</span>.
            </p>
            <div
              className="grid h-28 grid-cols-7 items-end gap-2"
              role="img"
              aria-label={`Workouts per weekday: ${WEEKDAY_NAMES.map((d, i) => `${d} ${weekdays[i]}`).join(', ')}`}
            >
              {weekdays.map((n, i) => (
                <div key={i} className="flex h-full flex-col items-center justify-end gap-1">
                  <span className="text-[11px] font-semibold text-fg-2 tabular">{n || ''}</span>
                  <div className="relative w-full max-w-6 flex-1 overflow-hidden rounded-t-[4px]">
                    <motion.div
                      className={cn(
                        'absolute inset-0 origin-bottom rounded-t-[4px]',
                        i === topDay ? 'bg-[var(--chart-1)]' : 'bg-[var(--chart-1)] opacity-45',
                      )}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: n / max }}
                      transition={{ type: 'spring', stiffness: 170, damping: 24, delay: i * 0.03 }}
                    />
                  </div>
                  <span className="text-[11px] text-muted">{WEEKDAY_NAMES[i][0]}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {parts.map((p) => (
                <div key={p.id} className="rounded-xl bg-fill px-2 py-2 text-center">
                  <p className="text-sm font-bold tabular">{Math.round((p.count / total) * 100)}%</p>
                  <p className="text-[11px] text-fg-2">{p.label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </WidgetFrame>
  );
});

// ---------------------------------------------------------------------------

const ZONE_COLORS = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)'];

/** Share of working sets in strength / hypertrophy / endurance rep ranges. */
export const RepRangesWidget = memo(function RepRangesWidget({ workouts }: { workouts: Workout[] }) {
  const zones = useMemo(() => repZones(workouts), [workouts]);
  const total = zones.reduce((n, z) => n + z.sets, 0);
  const main = [...zones].sort((a, b) => b.sets - a.sets)[0];
  return (
    <WidgetFrame title="Rep ranges">
      <Card>
        {total === 0 ? (
          <p className="text-sm text-fg-2">No working sets in this range.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-fg-2">
              Mostly <span className="font-semibold text-fg">{main.label.toLowerCase()}</span> work ({main.range})
              across {pluralize(total, 'working set')}.
            </p>
            <div
              className="flex h-4 gap-[2px] overflow-hidden rounded-full"
              role="img"
              aria-label={zones.map((z) => `${z.label} ${Math.round(z.share * 100)}%`).join(', ')}
            >
              {zones
                .filter((z) => z.sets > 0)
                .map((z) => (
                  <motion.div
                    key={z.id}
                    className="h-full origin-left"
                    style={{ flexGrow: z.share, background: ZONE_COLORS[zones.indexOf(z)] }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                  />
                ))}
            </div>
            <ul className="mt-3 space-y-1.5">
              {zones.map((z, i) => (
                <li key={z.id} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: ZONE_COLORS[i] }} />
                  <span className="font-medium">{z.label}</span>
                  <span className="text-fg-2">{z.range}</span>
                  <span className="ml-auto font-semibold tabular">{Math.round(z.share * 100)}%</span>
                  <span className="w-14 text-right text-xs text-fg-2 tabular">{z.sets} sets</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </WidgetFrame>
  );
});

// ---------------------------------------------------------------------------

/** Biggest e1RM gains within the range. */
export function MostImprovedWidget({ workouts, from }: { workouts: Workout[]; from: number }) {
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const all = useHistoryIndex().sorted;
  const top = useMemo(() => mostImproved(all, from), [all, from]);
  return (
    <WidgetFrame title="Most improved" action="All lifts" onAction={() => navigate('analytics', 'strength')}>
      {top.length === 0 ? (
        <Card>
          <p className="text-sm text-fg-2">
            {workouts.length
              ? 'Repeat a lift at least twice in this range to see gains.'
              : 'No workouts in this range.'}
          </p>
        </Card>
      ) : (
        <Card padded={false} className="divide-y divide-line overflow-hidden">
          {top.map((t, i) => (
            <button
              key={t.exerciseId}
              type="button"
              onClick={() => navigate('analytics', 'strength', t.exerciseId)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-transform active:scale-[0.99]"
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                  i === 0 ? 'bg-gold-soft text-gold' : 'bg-fill text-fg-2',
                )}
              >
                {i === 0 ? <Crown size={15} aria-label="Top" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{exerciseName(exMap, t.exerciseId)}</span>
                <span className="block text-xs text-fg-2 tabular">
                  e1RM {formatWeight(t.first, unit, true, 1)} → {formatWeight(t.last, unit, true, 1)}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 font-bold tabular',
                  t.pct > 0 ? 'text-success-text' : t.pct < 0 ? 'text-danger' : 'text-fg-2',
                )}
              >
                {t.pct > 0 ? '+' : ''}
                {formatNumber(t.pct * 100, 1)}%
              </span>
            </button>
          ))}
        </Card>
      )}
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------

/** All-time totals with a tangible comparison. */
export function LifetimeWidget() {
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  const t = useMemo(() => lifetimeTotals(history.sorted), [history]);
  const comparison = tonnageComparison(t.volume);
  return (
    <WidgetFrame title="Lifetime">
      <Card>
        <p className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Total lifted</p>
        <p className="text-4xl font-bold tracking-tight tabular">{formatVolume(t.volume, unit)}</p>
        {comparison && <p className="mt-0.5 text-sm font-medium text-accent-text">{comparison}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            [formatNumber(t.reps, 0), 'reps'],
            [formatNumber(t.sets, 0), 'sets'],
            [`${t.hours < 10 ? t.hours.toFixed(1) : Math.round(t.hours)} h`, 'trained'],
            [t.workouts, 'workouts'],
            [t.exercises, 'exercises'],
            [t.workouts ? formatVolume(t.volume / t.workouts, unit, false) : '—', `${unit} / session`],
          ].map(([v, l]) => (
            <div key={String(l)} className="rounded-xl bg-fill px-2 py-2.5">
              <p className="text-lg font-bold tabular">{v}</p>
              <p className="text-[11px] text-fg-2">{l}</p>
            </div>
          ))}
        </div>
      </Card>
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------

const STATUS_COPY = { none: 'Not trained', under: 'Below range', on: 'In range', over: 'High' } as const;

/** Effective weekly sets per muscle vs. the 10–20 sets/week range. */
export function MuscleTargetsWidget() {
  const history = useHistoryIndex();
  const exMap = useExerciseMap();
  const [now] = useState(() => Date.now());
  const rows = useMemo(() => {
    const load = workoutsMuscleLoad(lastSevenDays(history.sorted, now), exMap);
    return rankMuscles(load);
  }, [history, exMap, now]);
  const SCALE = 25;
  const inRange = rows.filter((r) => targetStatus(r.sets) === 'on').length;
  return (
    <WidgetFrame title="Weekly sets per muscle" action="Body map" onAction={() => navigate('analytics', 'muscles')}>
      <Card>
        <p className="mb-3 text-sm text-fg-2">
          Last 7 days ·{' '}
          <span className="font-semibold text-fg">
            {inRange}/{rows.length}
          </span>{' '}
          muscles in the {WEEKLY_SET_TARGET.min}–{WEEKLY_SET_TARGET.max} sets growth range.
        </p>
        <ul className="space-y-2">
          {rows.map((r) => {
            const status = targetStatus(r.sets);
            return (
              <li key={r.muscle} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-sm">
                <span className="truncate">{MUSCLE_NAMES[r.muscle]}</span>
                <span className="relative h-2.5 overflow-hidden rounded-full bg-fill" aria-hidden>
                  {/* Target band */}
                  <span
                    className="absolute inset-y-0 bg-success-soft"
                    style={{
                      left: `${(WEEKLY_SET_TARGET.min / SCALE) * 100}%`,
                      width: `${((WEEKLY_SET_TARGET.max - WEEKLY_SET_TARGET.min) / SCALE) * 100}%`,
                    }}
                  />
                  <motion.span
                    className={cn(
                      'absolute inset-y-0 left-0 w-full origin-left rounded-full',
                      status === 'on'
                        ? 'bg-success'
                        : status === 'over'
                          ? 'bg-[var(--warning)]'
                          : 'bg-[var(--chart-1)]',
                    )}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: Math.min(1, r.sets / SCALE) }}
                    transition={{ type: 'spring', stiffness: 170, damping: 26 }}
                  />
                </span>
                <span
                  className={cn(
                    'text-right text-xs font-semibold tabular',
                    status === 'on' ? 'text-success-text' : 'text-fg-2',
                  )}
                >
                  {formatNumber(r.sets, 1)}
                  <span className="sr-only"> sets, {STATUS_COPY[status]}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-2" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm bg-success-soft" /> 10–20 sets
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-success" /> In range
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[var(--chart-1)]" /> Below
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[var(--warning)]" /> High
          </span>
        </p>
      </Card>
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------

/** Average session length per period. */
export function SessionLengthWidget({ range }: { range: RangeKey }) {
  const history = useHistoryIndex();
  const [now] = useState(() => Date.now());
  const data = useMemo(
    () => periodBuckets(history.sorted, range, (w) => ((w.endedAt ?? w.startedAt) - w.startedAt) / 60_000, now, 'mean'),
    [history, range, now],
  );
  return (
    <WidgetFrame title={`Avg. session length per ${bucketUnit(range)}`}>
      <Card>
        <PeriodBarChart
          data={data}
          name="Avg. duration"
          format={(v) => formatDuration(v * 60_000)}
          tickFormat={(v) => `${Math.round(v)}m`}
          height={190}
        />
      </Card>
    </WidgetFrame>
  );
}

// ---------------------------------------------------------------------------

/** All-time session records. */
export function RecordsWidget() {
  const history = useHistoryIndex();
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const r = useMemo(() => workoutRecords(history.sorted), [history]);
  const items = [
    r.longest && {
      icon: Timer,
      label: 'Longest workout',
      value: formatDuration((r.longest.endedAt ?? 0) - r.longest.startedAt),
      sub: `${r.longest.name} · ${formatDate(r.longest.startedAt)}`,
    },
    r.heaviest && {
      icon: Trophy,
      label: 'Biggest session',
      value: formatVolume(workoutVolume(r.heaviest), unit),
      sub: `${r.heaviest.name} · ${formatDate(r.heaviest.startedAt)}`,
    },
    r.mostSets && {
      icon: Trophy,
      label: 'Most working sets',
      value: workoutSetCount(r.mostSets),
      sub: `${r.mostSets.name} · ${formatDate(r.mostSets.startedAt)}`,
    },
    r.bestWeek && {
      icon: Crown,
      label: 'Busiest week',
      value: pluralize(r.bestWeek.count, 'workout'),
      sub: `Week of ${formatDate(r.bestWeek.start)}`,
    },
    r.heaviestSet &&
      r.heaviestSet.e1rm > 0 && {
        icon: Crown,
        label: 'Strongest set (e1RM)',
        value: formatWeight(r.heaviestSet.e1rm, unit, true, 1),
        sub: `${exerciseName(exMap, r.heaviestSet.exerciseId)} · ${formatDate(r.heaviestSet.date)}`,
      },
  ].filter(Boolean) as { icon: typeof Timer; label: string; value: string | number; sub: string }[];

  return (
    <WidgetFrame title="Records">
      <Card padded={false} className="divide-y divide-line overflow-hidden">
        {items.length === 0 && (
          <p className="p-4 text-sm text-fg-2">Your records will appear after your first workout.</p>
        )}
        {items.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
              <Icon size={17} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold tracking-wide text-fg-2 uppercase">{label}</span>
              <span className="block truncate text-xs text-muted">{sub}</span>
            </span>
            <span className="shrink-0 text-right font-bold tabular">{value}</span>
          </div>
        ))}
      </Card>
    </WidgetFrame>
  );
}

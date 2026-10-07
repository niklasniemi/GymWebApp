import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, CalendarDays, Minus, Target, TrendingUp, Trophy } from 'lucide-react';
import { addDays, formatDate, formatRelativeDay, pluralize } from '../../lib/format';
import { sessionSeries, topSet, type SessionPoint } from '../../lib/history';
import { displayWeight, formatNumber, formatWeight, toDisplayWeight } from '../../lib/units';
import { cn } from '../../lib/utils';
import { exerciseName, useExerciseMap, useHistoryIndex } from '../../store/data';
import { useFavoriteSet } from '../../store/favorites';
import { useSettings } from '../../store/settings';
import { navigate } from '../../store/ui';
import type { Exercise, Unit } from '../../types';
import { FavoriteButton } from '../exercises/FavoriteButton';
import { Card, EmptyState, SectionTitle, StatTile } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import ExerciseProgress from './ExerciseProgress';
import { Sparkline } from './Sparkline';

/** Headline metric per exercise: est. 1RM, or reps for bodyweight work. */
function metricOf(ex: Exercise | undefined) {
  const bodyweight = ex?.equipment === 'bodyweight';
  return {
    bodyweight,
    pick: (p: SessionPoint) => (bodyweight ? p.reps : p.e1rm),
    format: (v: number, unit: Unit) => (bodyweight ? `${formatNumber(v, 0)} reps` : formatWeight(v, unit, true, 1)),
    delta: (v: number, unit: Unit) =>
      bodyweight ? `${formatNumber(Math.abs(v), 0)} reps` : formatWeight(Math.abs(v), unit, true, 1),
  };
}

export function StrengthView({ exerciseId }: { exerciseId?: string }) {
  const history = useHistoryIndex();
  if (exerciseId && history.sessions.has(exerciseId)) return <StrengthDetail exerciseId={exerciseId} />;
  return <StrengthList />;
}

// ---------------------------------------------------------------------------
// List: every trained lift with a sparkline and its all-time change
// ---------------------------------------------------------------------------

function StrengthList() {
  const history = useHistoryIndex();
  const exMap = useExerciseMap();
  const favorites = useFavoriteSet();
  const unit = useSettings((s) => s.unit);

  const rows = useMemo(() => {
    return [...history.sessions.entries()]
      .map(([id, sessions]) => {
        const ex = exMap.get(id);
        const m = metricOf(ex);
        const series = sessionSeries(sessions)
          .map(m.pick)
          .filter((v) => v > 0);
        const first = series[0] ?? 0;
        const current = series[series.length - 1] ?? 0;
        return {
          id,
          name: exerciseName(exMap, id),
          m,
          series: series.slice(-14),
          current,
          change: current - first,
          pct: first ? (current - first) / first : 0,
          sessions: sessions.length,
          last: sessions[sessions.length - 1]?.date ?? 0,
          favorite: favorites.has(id),
        };
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.last - a.last);
  }, [history, exMap, favorites]);

  if (!rows.length) {
    return (
      <Card>
        <EmptyState icon={Target} title="No strength data yet">
          Complete sets in a workout and every lift gets its own progress history here.
        </EmptyState>
      </Card>
    );
  }

  const favs = rows.filter((r) => r.favorite);
  const rest = rows.filter((r) => !r.favorite);

  const list = (items: typeof rows) => (
    <Card padded={false} className="divide-y divide-line overflow-hidden">
      {items.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => navigate('analytics', 'strength', r.id)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-transform active:scale-[0.99]"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{r.name}</span>
            <span className="block truncate text-xs text-fg-2">
              {pluralize(r.sessions, 'session')} · {formatRelativeDay(r.last)}
            </span>
          </span>
          <Sparkline values={r.series} />
          <span className="w-24 shrink-0 text-right">
            <span className="block text-sm font-bold tabular">{r.m.format(r.current, unit)}</span>
            <Delta change={r.change} pct={r.pct} label={r.m.delta(r.change, unit)} compact />
          </span>
        </button>
      ))}
    </Card>
  );

  return (
    <div className="space-y-4">
      <p className="px-1 text-sm text-fg-2">
        Estimated 1RM (Epley) per lift, change since your first logged session. Tap a lift for its full history.
      </p>
      {favs.length > 0 && (
        <section aria-label="Favourite lifts">
          <SectionTitle>Favourites</SectionTitle>
          {list(favs)}
        </section>
      )}
      <section aria-label="All lifts">
        {favs.length > 0 && <SectionTitle>All lifts</SectionTitle>}
        {list(rest.length ? rest : [])}
      </section>
    </div>
  );
}

function Delta({ change, pct, label, compact }: { change: number; pct: number; label: string; compact?: boolean }) {
  const up = change > 0.0001;
  const down = change < -0.0001;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-semibold tabular',
        compact ? 'text-xs' : 'text-sm',
        up ? 'text-success-text' : down ? 'text-danger' : 'text-fg-2',
      )}
    >
      <Icon size={compact ? 13 : 15} aria-hidden />
      <span className="sr-only">{up ? 'up' : down ? 'down' : 'no change'}</span>
      {up || down ? `${label}${pct ? ` (${formatNumber(Math.abs(pct) * 100, 0)}%)` : ''}` : 'No change'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detail: one lift's development over a chosen period
// ---------------------------------------------------------------------------

type Range = '3m' | '6m' | '1y' | 'all';
const RANGE_DAYS: Record<Range, number | null> = { '3m': 91, '6m': 182, '1y': 365, all: null };

function StrengthDetail({ exerciseId }: { exerciseId: string }) {
  const history = useHistoryIndex();
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const [range, setRange] = useState<Range>('all');
  const ex = exMap.get(exerciseId);
  const m = metricOf(ex);
  const name = exerciseName(exMap, exerciseId);

  const [now] = useState(() => Date.now());
  const days = RANGE_DAYS[range];
  const start = days ? addDays(now, -days) : 0;

  const sessions = useMemo(() => history.sessions.get(exerciseId) ?? [], [history, exerciseId]);
  const points = useMemo(() => sessionSeries(sessions).filter((p) => p.date >= start), [sessions, start]);
  const values = points.map(m.pick);
  const first = points[0];
  const latest = points[points.length - 1];
  const bestIdx = values.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
  const best = points[bestIdx];
  const change = latest && first ? m.pick(latest) - m.pick(first) : 0;
  const pct = first && m.pick(first) ? change / m.pick(first) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => navigate('analytics', 'strength')}
          className="-ml-2 flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-accent-text"
        >
          <ArrowLeft size={18} aria-hidden /> All lifts
        </button>
      </div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-bold tracking-tight">{name}</h2>
          <p className="text-sm text-fg-2">
            {pluralize(sessions.length, 'session')} since {formatDate(sessions[0]?.date ?? 0)}
          </p>
        </div>
        <FavoriteButton exerciseId={exerciseId} name={name} />
      </div>

      <Segmented
        label="Period"
        size="sm"
        value={range}
        onChange={setRange}
        options={[
          { value: '3m', label: '3M' },
          { value: '6m', label: '6M' },
          { value: '1y', label: '1Y' },
          { value: 'all', label: 'All' },
        ]}
      />

      {latest ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            icon={Target}
            label={m.bodyweight ? 'Best reps' : 'Est. 1RM'}
            value={m.format(m.pick(latest), unit)}
            sub={`latest · ${formatDate(latest.date)}`}
          />
          <StatTile
            icon={TrendingUp}
            label="Change"
            value={<Delta change={change} pct={0} label={m.delta(change, unit)} />}
            sub={pct ? `${change >= 0 ? '+' : '−'}${formatNumber(Math.abs(pct) * 100, 1)}% in period` : 'in period'}
          />
          <StatTile
            icon={Trophy}
            label="Best"
            value={best ? m.format(m.pick(best), unit) : '—'}
            sub={best ? formatDate(best.date) : undefined}
          />
          <StatTile icon={CalendarDays} label="Sessions" value={points.length} sub="in period" />
        </div>
      ) : (
        <Card>
          <EmptyState icon={CalendarDays} title="No sessions in this period" className="py-6">
            Pick a longer range to see this lift's history.
          </EmptyState>
        </Card>
      )}

      <Card>
        <ExerciseProgress
          key={`${exerciseId}-${range}`}
          exerciseId={exerciseId}
          bodyweight={m.bodyweight}
          from={start}
          height={240}
        />
      </Card>

      {points.length > 0 && (
        <section aria-label="Session history">
          <SectionTitle>Sessions</SectionTitle>
          <Card padded={false} className="overflow-hidden">
            <table className="w-full text-left text-sm tabular">
              <thead className="bg-fill text-[11px] tracking-wide text-fg-2 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Date
                  </th>
                  <th scope="col" className="px-2 py-2 font-semibold">
                    Top set
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">
                    {m.bodyweight ? 'Reps' : 'e1RM'}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Volume
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...points].reverse().map((p) => {
                  const session = sessions.find((s) => s.workoutId === p.workoutId);
                  const top = session ? topSet(session.sets) : undefined;
                  return (
                    <tr key={p.workoutId}>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1">
                          {formatDate(p.date)}
                          {p.pr && <Trophy size={12} className="text-gold" aria-label="PR" />}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-fg-2">
                        {top
                          ? `${top.weight ? `${formatNumber(displayWeight(top.weight, unit) ?? 0)} × ` : ''}${top.reps}`
                          : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold">
                        {m.bodyweight ? p.reps : formatNumber(toDisplayWeight(p.e1rm, unit), 1)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-fg-2">
                        {formatNumber(toDisplayWeight(p.volume, unit), 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ChevronRight, Dumbbell, Flame, History, Play, Zap } from 'lucide-react';
import { ActiveWorkout } from '../components/workout/ActiveWorkout';
import { startWorkout } from '../components/workout/actions';
import { WorkoutHistoryCard } from '../components/workout/WorkoutHistoryCard';
import { WorkoutDetailSheet, WorkoutSummarySheet } from '../components/workout/WorkoutSheets';
import { Button } from '../components/ui/Button';
import { Card, EmptyState, PageHeader, SectionTitle, StatTile } from '../components/ui/primitives';
import { addDays, formatRelativeDay, startOfWeek } from '../lib/format';
import { workoutVolume } from '../lib/history';
import { formatVolume } from '../lib/units';
import { exerciseName, useData, useExerciseMap, useHistoryIndex } from '../store/data';
import { useSettings } from '../store/settings';
import { navigate } from '../store/ui';
import { useActiveWorkout } from '../store/workout';
import type { Workout } from '../types';

export default function WorkoutPage() {
  const active = useActiveWorkout((s) => s.workout !== null);
  const [summary, setSummary] = useState<Workout | null>(null);
  return (
    <>
      {active ? <ActiveWorkout onFinished={setSummary} /> : <WorkoutHome />}
      <WorkoutSummarySheet workout={summary} onClose={() => setSummary(null)} />
    </>
  );
}

const PAGE = 10;

function WorkoutHome() {
  const history = useHistoryIndex();
  const routines = useData((s) => s.routines);
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => weeklyStats(history.sorted), [history]);
  const quickRoutines = useMemo(
    () => [...routines].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.order - b.order).slice(0, 4),
    [routines],
  );
  const opened = openId ? (history.sorted.find((w) => w.id === openId) ?? null) : null;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6 pb-6">
      <PageHeader title="Workout" subtitle={today} />

      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-accent opacity-15 blur-2xl"
        />
        <div className="relative">
          <p className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Quick start</p>
          <p className="mt-1 text-xl font-bold tracking-tight">Ready when you are.</p>
          <p className="mt-1 text-sm text-fg-2">Start empty and add exercises as you go.</p>
          <Button
            variant="primary"
            size="lg"
            block
            icon={Play}
            className="mt-4"
            feedback="success"
            onClick={() => startWorkout()}
          >
            Start empty workout
          </Button>
        </div>
      </Card>

      <section aria-label="This week">
        <SectionTitle>This week</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Workouts" value={stats.thisWeek} sub={`${stats.lastWeek} last week`} />
          <StatTile label="Volume" value={formatVolume(stats.volume, unit, false)} sub={unit} />
          <StatTile
            label="Streak"
            value={
              <span className="inline-flex items-center gap-1">
                {stats.streak}
                {stats.streak > 0 && <Flame size={20} className="text-[var(--chart-2)]" aria-hidden />}
              </span>
            }
            sub={stats.streak === 1 ? 'week' : 'weeks'}
          />
        </div>
      </section>

      <section aria-label="Start from a routine">
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => navigate('routines')}
              className="flex min-h-8 items-center gap-0.5 text-sm font-semibold text-accent-text"
            >
              All routines <ChevronRight size={16} aria-hidden />
            </button>
          }
        >
          Start a routine
        </SectionTitle>
        {quickRoutines.length === 0 ? (
          <Card>
            <p className="text-sm text-fg-2">
              No routines yet. Build your first template — or add a Push/Pull/Legs starter.
            </p>
            <Button variant="soft" className="mt-3" icon={Zap} onClick={() => navigate('routines')}>
              Create a routine
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {quickRoutines.map((r) => (
              <Card key={r.id} padded={false} className="flex items-center gap-3 p-3 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="truncate text-[13px] text-fg-2">
                    {r.exercises.length
                      ? r.exercises.map((e) => exerciseName(exMap, e.exerciseId)).join(', ')
                      : 'No exercises'}
                  </p>
                  {r.lastUsedAt && (
                    <p className="text-xs text-muted">Last done {formatRelativeDay(r.lastUsedAt).toLowerCase()}</p>
                  )}
                </div>
                <Button
                  variant="primary"
                  size="icon"
                  icon={Play}
                  aria-label={`Start ${r.name}`}
                  feedback="success"
                  onClick={() => startWorkout({ routine: r })}
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section aria-label="History">
        <SectionTitle>History</SectionTitle>
        {history.sorted.length === 0 ? (
          <Card>
            <EmptyState icon={Dumbbell} title="No workouts yet" className="py-6">
              Finished workouts show up here with volume, duration and PRs.
            </EmptyState>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.sorted.slice(0, limit).map((w) => (
              <WorkoutHistoryCard key={w.id} workout={w} onOpen={setOpenId} />
            ))}
            {history.sorted.length > limit && (
              <Button variant="ghost" block icon={History} onClick={() => setLimit((l) => l + PAGE)}>
                Show more ({history.sorted.length - limit} older)
              </Button>
            )}
          </div>
        )}
      </section>

      <WorkoutDetailSheet workout={opened} onClose={() => setOpenId(null)} />
    </div>
  );
}

function weeklyStats(sorted: Workout[]) {
  const thisWeekStart = startOfWeek(Date.now());
  const lastWeekStart = addDays(thisWeekStart, -7);
  let thisWeek = 0;
  let lastWeek = 0;
  let volume = 0;
  const weeks = new Set<number>();
  for (const w of sorted) {
    const ws = startOfWeek(w.startedAt);
    weeks.add(ws);
    if (ws === thisWeekStart) {
      thisWeek++;
      volume += workoutVolume(w);
    } else if (ws === lastWeekStart) lastWeek++;
  }
  // Consecutive weeks with ≥1 workout, counting back from this week (or last, if this week is still empty).
  let streak = 0;
  let cursor = weeks.has(thisWeekStart) ? thisWeekStart : lastWeekStart;
  while (weeks.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return { thisWeek, lastWeek, volume, streak };
}

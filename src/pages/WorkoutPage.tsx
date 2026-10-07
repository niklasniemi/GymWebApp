import { useMemo, useState } from 'react';
import {
  Calculator,
  CalendarDays,
  Check,
  ClipboardList,
  Dumbbell,
  Flame,
  Grid3x3,
  History,
  PersonStanding,
  Play,
  Scale,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { WidgetBoard, WidgetFrame, type WidgetDef } from '../components/widgets/WidgetBoard';
import {
  BodyWeightWidget,
  FrequencyWidget,
  KeyLiftsWidget,
  MuscleMapWidget,
  RecentPRsWidget,
  ToolsWidget,
} from '../components/widgets/sharedWidgets';
import { ActiveWorkout } from '../components/workout/ActiveWorkout';
import { startWorkout } from '../components/workout/actions';
import { WorkoutHistoryCard } from '../components/workout/WorkoutHistoryCard';
import { WorkoutDetailSheet, WorkoutSummarySheet } from '../components/workout/WorkoutSheets';
import { Button } from '../components/ui/Button';
import { Card, EmptyState, PageHeader, StatTile } from '../components/ui/primitives';
import { addDays, formatRelativeDay, startOfWeek } from '../lib/format';
import { workoutVolume } from '../lib/history';
import { muscleRangeStart } from '../lib/muscles';
import { formatVolume } from '../lib/units';
import { exerciseName, useData, useExerciseMap, useHistoryIndex } from '../store/data';
import { useSettings } from '../store/settings';
import { navigate, useUI } from '../store/ui';
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

const WORKOUT_DEFAULTS = ['quickStart', 'thisWeek', 'routines', 'muscleMap', 'keyLifts', 'history'];

function WorkoutHome() {
  const [editing, setEditing] = useState(false);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const widgets = useMemo<WidgetDef[]>(
    () => [
      {
        id: 'quickStart',
        title: 'Quick start',
        description: 'Start an empty workout',
        icon: Play,
        render: () => <QuickStartWidget />,
      },
      {
        id: 'thisWeek',
        title: 'This week',
        description: 'Workouts, volume and streak',
        icon: CalendarDays,
        render: () => <ThisWeekWidget />,
      },
      {
        id: 'routines',
        title: 'Routines',
        description: 'Start or inspect a routine',
        icon: ClipboardList,
        render: () => <RoutinesWidget />,
      },
      {
        id: 'muscleMap',
        title: 'Muscles this week',
        description: '3D heat map of the last 7 days',
        icon: PersonStanding,
        render: () => <WeekMuscleWidget />,
      },
      {
        id: 'keyLifts',
        title: 'Key lifts',
        description: 'Favourite lifts and their 1RM trend',
        icon: TrendingUp,
        render: () => <KeyLiftsWidget />,
      },
      {
        id: 'prs',
        title: 'Recent PRs',
        description: 'Your latest personal records',
        icon: Trophy,
        render: () => <RecentPRsWidget />,
      },
      {
        id: 'bodyWeight',
        title: 'Body weight',
        description: 'Latest weight and trend',
        icon: Scale,
        render: () => <BodyWeightWidget />,
      },
      {
        id: 'frequency',
        title: 'Training frequency',
        description: 'Calendar of recent sessions',
        icon: Grid3x3,
        render: () => <FrequencyWidget />,
      },
      {
        id: 'tools',
        title: 'Tools',
        description: 'Plate, warm-up and 1RM calculators',
        icon: Calculator,
        render: () => <ToolsWidget />,
      },
      { id: 'history', title: 'History', description: 'Past workouts', icon: History, render: () => <HistoryWidget /> },
    ],
    [],
  );

  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        title="Workout"
        subtitle={today}
        actions={
          <Button
            size="sm"
            variant={editing ? 'primary' : 'secondary'}
            icon={editing ? Check : SlidersHorizontal}
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? 'Done customising' : 'Customise widgets'}
          >
            {editing ? 'Done' : 'Edit'}
          </Button>
        }
      />
      <WidgetBoard
        board="workout"
        widgets={widgets}
        defaults={WORKOUT_DEFAULTS}
        editing={editing}
        onDone={() => setEditing(false)}
      />
    </div>
  );
}

function QuickStartWidget() {
  return (
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
  );
}

function ThisWeekWidget() {
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  const stats = useMemo(() => weeklyStats(history.sorted), [history]);
  const tile = 'rounded-2xl text-left transition-transform active:scale-95';
  return (
    <WidgetFrame title="This week" action="Analytics" onAction={() => navigate('analytics', 'overview')}>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={tile} onClick={() => navigate('analytics', 'overview', 'stats')}>
          <StatTile label="Workouts" value={stats.thisWeek} sub={`${stats.lastWeek} last week`} />
        </button>
        <button type="button" className={tile} onClick={() => navigate('analytics', 'overview', 'volume')}>
          <StatTile label="Volume" value={formatVolume(stats.volume, unit, false)} sub={unit} />
        </button>
        <button type="button" className={tile} onClick={() => navigate('analytics', 'overview', 'frequency')}>
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
        </button>
      </div>
    </WidgetFrame>
  );
}

function RoutinesWidget() {
  const routines = useData((s) => s.routines);
  const exMap = useExerciseMap();
  const openRoutine = useUI((s) => s.openRoutine);
  const quick = useMemo(
    () => [...routines].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.order - b.order).slice(0, 4),
    [routines],
  );
  return (
    <WidgetFrame title="Start a routine" action="All routines" onAction={() => navigate('routines')}>
      {quick.length === 0 ? (
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
          {quick.map((r) => (
            <Card key={r.id} padded={false} className="flex items-center gap-2 p-2 pl-1">
              <button
                type="button"
                onClick={() => openRoutine(r.id)}
                aria-label={`${r.name}: view muscles and details`}
                className="min-w-0 flex-1 rounded-xl px-3 py-1 text-left transition-transform active:scale-[0.98]"
              >
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="block truncate text-[13px] text-fg-2">
                  {r.exercises.length
                    ? r.exercises.map((e) => exerciseName(exMap, e.exerciseId)).join(', ')
                    : 'No exercises'}
                </span>
                {r.lastUsedAt && (
                  <span className="block text-xs text-muted">
                    Last done {formatRelativeDay(r.lastUsedAt).toLowerCase()}
                  </span>
                )}
              </button>
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
    </WidgetFrame>
  );
}

function WeekMuscleWidget() {
  const history = useHistoryIndex();
  const [from] = useState(() => muscleRangeStart('week'));
  const workouts = useMemo(() => history.sorted.filter((w) => w.startedAt >= from), [history, from]);
  return <MuscleMapWidget workouts={workouts} title="Muscles this week" floor={10} period="in the last 7 days" />;
}

function HistoryWidget() {
  const history = useHistoryIndex();
  const [limit, setLimit] = useState(5);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = openId ? (history.sorted.find((w) => w.id === openId) ?? null) : null;
  return (
    <WidgetFrame title="History">
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
      <WorkoutDetailSheet workout={opened} onClose={() => setOpenId(null)} />
    </WidgetFrame>
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

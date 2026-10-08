import { useMemo, useState } from 'react';
import {
  Activity,
  Calculator,
  CalendarDays,
  Check,
  ClipboardList,
  Dumbbell,
  Flame,
  Footprints,
  Goal,
  Grid3x3,
  History,
  PersonStanding,
  Play,
  Scale,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';
import { WidgetBoard, WidgetFrame, type WidgetDef } from '../components/widgets/WidgetBoard';
import { FireWidget } from '../components/fire/FireWidget';
import { NutritionTodayWidget } from '../components/food/NutritionWidgets';
import { RunningWidget } from '../components/running/RunningWidget';
import { ActivitySheet } from '../components/activities/ActivitySheet';
import { ActivitiesWidget } from '../components/activities/ActivitiesWidget';
import { WeightGoalWidget } from '../components/widgets/WeightGoalWidget';
import { WorkoutTimeSheet } from '../components/workout/WorkoutTimeSheet';
import { goalStatus } from '../lib/goals';
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
import { floorToMinutes, formatRelativeDay, startOfWeek } from '../lib/format';
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

const WORKOUT_DEFAULTS = [
  'quickStart',
  'fire',
  'nutrition',
  'thisWeek',
  'routines',
  'muscleMap',
  'keyLifts',
  'tools',
  'history',
];

function WorkoutHome() {
  const [editing, setEditing] = useState(false);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const widgets = useMemo<WidgetDef[]>(
    () => [
      {
        id: 'quickStart',
        title: 'Quick start',
        description: 'Start a workout or log a past one',
        icon: Play,
        render: () => <QuickStartWidget />,
      },
      {
        id: 'fire',
        title: 'Momentum',
        description: 'Your training fire, goal and streak',
        icon: Flame,
        render: () => <FireWidget />,
      },
      {
        id: 'nutrition',
        title: 'Nutrition today',
        description: 'Calories and macros left today',
        icon: UtensilsCrossed,
        render: () => <NutritionTodayWidget />,
      },
      {
        id: 'running',
        title: 'Running',
        description: 'Weekly distance, pace and running records',
        icon: Footprints,
        render: () => <RunningWidget />,
      },
      {
        id: 'activities',
        title: 'Activities',
        description: 'Tennis, padel and other sports — time per sport',
        icon: Activity,
        render: () => <ActivitiesWidget />,
      },
      {
        id: 'weightGoal',
        title: 'Weight goal',
        description: 'Progress and time to your target weight',
        icon: Goal,
        render: () => <WeightGoalWidget />,
      },
      {
        id: 'thisWeek',
        title: 'This week',
        description: 'Goal progress, volume and streak',
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
  const [logging, setLogging] = useState(false);
  const [running, setRunning] = useState(false);
  const routines = useData((s) => s.routines);
  const [now] = useState(() => Date.now());
  return (
    <>
      <div className="flex gap-2">
        <Button variant="primary" size="lg" block icon={Play} feedback="success" onClick={() => startWorkout()}>
          Start workout
        </Button>
        <Button size="lg" icon={History} onClick={() => setLogging(true)} aria-label="Log a past workout">
          Log past
        </Button>
        <Button size="lg" icon={Activity} onClick={() => setRunning(true)} aria-label="Log an activity or run" />
      </div>
      <ActivitySheet open={running} onClose={() => setRunning(false)} />
      <WorkoutTimeSheet
        open={logging}
        onClose={() => setLogging(false)}
        title="Log a past workout"
        description="Forgot to start it at the gym? Pick when it happened, then tick off what you did."
        start={floorToMinutes(now - 90 * 60_000, 15)}
        end={floorToMinutes(now - 15 * 60_000, 15)}
        withRoutine
        submitLabel="Start logging"
        onSubmit={({ start, end, routineId }) => {
          const routine = routines.find((r) => r.id === routineId);
          void startWorkout({ routine, startedAt: start, plannedEnd: end ?? start + 3_600_000 });
        }}
      />
    </>
  );
}

function ThisWeekWidget() {
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  const goal = useSettings((s) => s.weeklyGoal);
  const [now] = useState(() => Date.now());
  const volume = useMemo(() => {
    const from = startOfWeek(now);
    return history.sorted.filter((w) => w.startedAt >= from).reduce((n, w) => n + workoutVolume(w), 0);
  }, [history, now]);
  const status = useMemo(() => goalStatus(history.sorted, goal, now), [history, goal, now]);
  const tile = 'rounded-2xl text-left transition-transform active:scale-95';
  return (
    <WidgetFrame title="This week" action="Analytics" onAction={() => navigate('analytics', 'overview')}>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={tile} onClick={() => navigate('analytics', 'overview', 'goalWeeks')}>
          <StatTile
            label="Workouts"
            value={
              <span className="tabular">
                {status.thisWeek}
                <span className="text-base font-semibold text-fg-2">/{status.goal}</span>
              </span>
            }
            sub={status.currentMet ? 'Goal met ✓' : `${status.remaining} to go`}
          />
        </button>
        <button type="button" className={tile} onClick={() => navigate('analytics', 'overview', 'volume')}>
          <StatTile label="Volume" value={formatVolume(volume, unit, false)} sub={unit} />
        </button>
        <button type="button" className={tile} onClick={() => navigate('analytics', 'overview', 'goalWeeks')}>
          <StatTile
            label="Streak"
            value={
              <span className="inline-flex items-center gap-1">
                {status.streak}
                {status.streak > 0 && <Flame size={20} className="text-[#f97316]" aria-hidden />}
              </span>
            }
            sub={status.atRisk ? 'At risk!' : status.streak === 1 ? 'goal week' : 'goal weeks'}
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

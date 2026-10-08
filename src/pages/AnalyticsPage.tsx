import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Crosshair,
  Flame,
  Footprints,
  Goal,
  Medal,
  Mountain,
  PieChart,
  Rocket,
  Sunrise,
  Target,
  Timer,
  BarChart3,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  Clock,
  Grid3x3,
  Layers,
  PersonStanding,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  Utensils,
  Weight,
} from 'lucide-react';
import { BodyTracker } from '../components/analytics/BodyTracker';
import { PeriodBarChart } from '../components/analytics/charts';
import { MusclesView } from '../components/analytics/MusclesView';
import { CaloriesTrendWidget, MacroSplitWidget } from '../components/food/NutritionWidgets';
import { RunningWidget } from '../components/running/RunningWidget';
import { ActivitiesWidget } from '../components/activities/ActivitiesWidget';
import { WeightGoalWidget } from '../components/widgets/WeightGoalWidget';
import { StrengthView } from '../components/analytics/StrengthView';
import {
  GoalWeeksWidget,
  LifetimeWidget,
  MomentumHistoryWidget,
  MostImprovedWidget,
  MuscleTargetsWidget,
  RecordsWidget,
  RepRangesWidget,
  SessionLengthWidget,
  WhenYouTrainWidget,
} from '../components/analytics/insightWidgets';
import { Button } from '../components/ui/Button';
import { Card, EmptyState, PageHeader, StatTile } from '../components/ui/primitives';
import { Segmented } from '../components/ui/Segmented';
import { WidgetBoard, WidgetFrame, type WidgetDef } from '../components/widgets/WidgetBoard';
import {
  BodyWeightWidget,
  FrequencyWidget,
  KeyLiftsWidget,
  MuscleMapWidget,
  RecentPRsWidget,
} from '../components/widgets/sharedWidgets';
import { MUSCLE_LABELS } from '../data/exercises';
import { bucketUnit, inRange, muscleSplit, RANGES, rangeStart, volumeBuckets, type RangeKey } from '../lib/analytics';
import { formatDuration } from '../lib/format';
import { workoutPRCount, workoutVolume } from '../lib/history';
import { formatNumber, formatVolume, toDisplayWeight } from '../lib/units';
import { useExerciseMap, useHistoryIndex } from '../store/data';
import { useSettings } from '../store/settings';
import { navigate, useSubRoute } from '../store/ui';
import type { Workout } from '../types';

const VIEWS = ['overview', 'strength', 'muscles', 'body'] as const;
type View = (typeof VIEWS)[number];

export default function AnalyticsPage() {
  const [sub, param] = useSubRoute();
  const view: View = (VIEWS as readonly string[]).includes(sub ?? '') ? (sub as View) : 'overview';
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Analytics"
        subtitle="Progress"
        actions={
          view === 'overview' && (
            <Button
              size="sm"
              variant={editing ? 'primary' : 'secondary'}
              icon={editing ? Check : SlidersHorizontal}
              onClick={() => setEditing((v) => !v)}
              aria-label={editing ? 'Done customising' : 'Customise widgets'}
            >
              {editing ? 'Done' : 'Edit'}
            </Button>
          )
        }
      />
      <Segmented
        label="Analytics section"
        value={view}
        onChange={(v) => {
          setEditing(false);
          navigate('analytics', v, undefined, { replace: true });
        }}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'strength', label: 'Strength' },
          { value: 'muscles', label: 'Muscles' },
          { value: 'body', label: 'Body' },
        ]}
      />
      {view === 'overview' && <Overview editing={editing} onDone={() => setEditing(false)} focus={param} />}
      {view === 'strength' && <StrengthView exerciseId={param} />}
      {view === 'muscles' && <MusclesView />}
      {view === 'body' && <BodyTracker />}
    </div>
  );
}

const OVERVIEW_DEFAULTS = [
  'stats',
  'goalWeeks',
  'volume',
  'momentum',
  'running',
  'activities',
  'calories',
  'macros',
  'weightGoal',
  'muscleTargets',
  'improved',
  'repRanges',
  'weekdays',
  'frequency',
  'keyLifts',
  'prs',
];

function Overview({ editing, onDone, focus }: { editing: boolean; onDone: () => void; focus?: string }) {
  const history = useHistoryIndex();
  const [range, setRange] = useState<RangeKey>('12w');
  const workouts = useMemo(() => inRange(history.sorted, range), [history, range]);
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? '';
  const from = useMemo(() => rangeStart(range), [range]);

  const widgets = useMemo<WidgetDef[]>(
    () => [
      {
        id: 'stats',
        title: 'Summary',
        description: 'Workouts, volume, time and PRs',
        icon: Layers,
        render: () => <StatsWidget workouts={workouts} />,
      },
      {
        id: 'goalWeeks',
        title: 'Weekly goal',
        description: 'Workouts per week vs your goal',
        icon: Target,
        render: () => <GoalWeeksWidget />,
      },
      {
        id: 'momentum',
        title: 'Momentum history',
        description: 'Your training fire over 60 days',
        icon: Flame,
        render: () => <MomentumHistoryWidget />,
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
        id: 'calories',
        title: 'Calories',
        description: '14 days of calories vs your target',
        icon: Utensils,
        render: () => <CaloriesTrendWidget />,
      },
      {
        id: 'macros',
        title: 'Macros',
        description: 'Macro split and protein consistency, 7 days',
        icon: PieChart,
        render: () => <MacroSplitWidget />,
      },
      {
        id: 'muscleTargets',
        title: 'Weekly sets per muscle',
        description: 'Each muscle vs the 10–20 sets growth range',
        icon: Crosshair,
        render: () => <MuscleTargetsWidget />,
      },
      {
        id: 'improved',
        title: 'Most improved',
        description: 'Biggest e1RM gains in the range',
        icon: Rocket,
        render: () => <MostImprovedWidget workouts={workouts} from={from} />,
      },
      {
        id: 'repRanges',
        title: 'Rep ranges',
        description: 'Strength vs hypertrophy vs endurance work',
        icon: PieChart,
        render: () => <RepRangesWidget workouts={workouts} />,
      },
      {
        id: 'weekdays',
        title: 'When you train',
        description: 'Favourite days and times',
        icon: Sunrise,
        render: () => <WhenYouTrainWidget workouts={workouts} />,
      },
      {
        id: 'duration',
        title: 'Session length',
        description: 'Average workout duration',
        icon: Timer,
        render: () => <SessionLengthWidget range={range} />,
      },
      {
        id: 'lifetime',
        title: 'Lifetime',
        description: 'Total lifted, reps and hours — with a twist',
        icon: Mountain,
        render: () => <LifetimeWidget />,
      },
      {
        id: 'bests',
        title: 'Records',
        description: 'Longest, heaviest and busiest sessions',
        icon: Medal,
        render: () => <RecordsWidget />,
      },
      {
        id: 'volume',
        title: 'Volume trend',
        description: 'Tonnage per week or month',
        icon: BarChart3,
        render: () => <VolumeWidget range={range} />,
      },
      {
        id: 'frequency',
        title: 'Training frequency',
        description: 'Calendar heat map',
        icon: Grid3x3,
        render: () => <FrequencyWidget linkToAnalytics={false} />,
      },
      {
        id: 'muscleMap',
        title: 'Muscle heat map',
        description: '3D body for the selected range',
        icon: PersonStanding,
        render: () => (
          <MuscleMapWidget
            workouts={workouts}
            title={`Muscles · ${rangeLabel}`}
            floor={Math.max(10, workouts.length * 3)}
            period="in this range"
          />
        ),
      },
      {
        id: 'keyLifts',
        title: 'Key lifts',
        description: 'Favourite lifts and 1RM trend',
        icon: TrendingUp,
        render: () => <KeyLiftsWidget />,
      },
      {
        id: 'prs',
        title: 'Recent PRs',
        description: 'Latest personal records',
        icon: Trophy,
        render: () => <RecentPRsWidget limit={6} />,
      },
      {
        id: 'muscleSplit',
        title: 'Muscle groups',
        description: 'Working sets per muscle group',
        icon: CalendarDays,
        render: () => <MuscleSplitWidget workouts={workouts} />,
      },
      {
        id: 'bodyWeight',
        title: 'Body weight',
        description: 'Latest weight and trend',
        icon: Weight,
        render: () => <BodyWeightWidget />,
      },
    ],
    [workouts, range, rangeLabel, from],
  );

  if (!history.sorted.length) {
    return (
      <Card>
        <EmptyState icon={ChartNoAxesCombined} title="Your progress lives here">
          Finish your first workout to unlock volume trends, frequency, strength curves and PRs.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {!editing && (
        <Segmented
          label="Time range"
          size="sm"
          value={range}
          onChange={setRange}
          options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
        />
      )}
      <WidgetBoard
        board="analytics"
        widgets={widgets}
        defaults={OVERVIEW_DEFAULTS}
        editing={editing}
        onDone={onDone}
        focus={focus}
      />
    </div>
  );
}

function StatsWidget({ workouts }: { workouts: Workout[] }) {
  const unit = useSettings((s) => s.unit);
  const totalVolume = workouts.reduce((n, w) => n + workoutVolume(w), 0);
  const avgDuration = workouts.length
    ? workouts.reduce((n, w) => n + ((w.endedAt ?? w.startedAt) - w.startedAt), 0) / workouts.length
    : 0;
  const prCount = workouts.reduce((n, w) => n + workoutPRCount(w), 0);
  const tile = 'rounded-2xl text-left transition-transform active:scale-95';
  return (
    <WidgetFrame title="Summary">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" className={tile} onClick={() => navigate('analytics', 'overview', 'frequency')}>
          <StatTile icon={CalendarDays} label="Workouts" value={workouts.length} />
        </button>
        <button type="button" className={tile} onClick={() => navigate('analytics', 'overview', 'volume')}>
          <StatTile icon={Weight} label="Volume" value={formatVolume(totalVolume, unit, false)} sub={unit} />
        </button>
        <button type="button" className={tile} onClick={() => navigate('workout')}>
          <StatTile icon={Clock} label="Avg time" value={formatDuration(avgDuration)} />
        </button>
        <button type="button" className={tile} onClick={() => navigate('analytics', 'strength')}>
          <StatTile icon={Trophy} label="PRs" value={prCount} />
        </button>
      </div>
    </WidgetFrame>
  );
}

function VolumeWidget({ range }: { range: RangeKey }) {
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  const buckets = useMemo(() => volumeBuckets(history.sorted, range), [history, range]);
  return (
    <WidgetFrame title={`Volume per ${bucketUnit(range)}`}>
      <Card>
        <PeriodBarChart
          data={buckets.map((b) => ({ ...b, value: toDisplayWeight(b.value, unit) }))}
          name="Volume"
          format={(v) => `${formatNumber(v, 0)} ${unit}`}
          tickFormat={(v) => (v >= 1000 ? `${formatNumber(v / 1000, 1)}k` : formatNumber(v, 0))}
        />
      </Card>
    </WidgetFrame>
  );
}

function MuscleSplitWidget({ workouts }: { workouts: Workout[] }) {
  const exMap = useExerciseMap();
  const split = useMemo(() => muscleSplit(workouts, exMap), [workouts, exMap]);
  return (
    <WidgetFrame
      title="Working sets by muscle group"
      action="Body map"
      onAction={() => navigate('analytics', 'muscles')}
    >
      <Card>
        <MuscleBars data={split} />
      </Card>
    </WidgetFrame>
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

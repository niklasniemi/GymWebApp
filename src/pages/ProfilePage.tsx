import { lazy, Suspense, useMemo, useState } from 'react';
import { CalendarDays, Clock, Dumbbell, Minus, Pencil, Plus, Settings, Weight } from 'lucide-react';
import { Flame } from '../components/fire/Flame';
import { Button } from '../components/ui/Button';
import { Card, PageHeader, StatTile } from '../components/ui/primitives';
import { NutritionTodayWidget } from '../components/food/NutritionWidgets';
import { FrequencyWidget, MuscleMapWidget, ToolsWidget } from '../components/widgets/sharedWidgets';
import { WidgetFrame } from '../components/widgets/WidgetBoard';
import { useMomentum } from '../hooks/useMomentum';
import { formatDate } from '../lib/format';
import { haptic } from '../lib/haptics';
import { muscleRangeStart } from '../lib/muscles';
import { formatVolume } from '../lib/units';
import { workoutVolume } from '../lib/history';
import { useHistoryIndex } from '../store/data';
import { useSettings } from '../store/settings';
import { navigate, useSubRoute } from '../store/ui';

const SettingsPage = lazy(() => import('./SettingsPage'));

export default function ProfilePage() {
  const [sub] = useSubRoute();
  if (sub === 'settings') {
    return (
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>
    );
  }
  return <Profile />;
}

function Profile() {
  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        title="Profile"
        subtitle="You"
        actions={
          <Button
            size="icon"
            variant="secondary"
            icon={Settings}
            aria-label="Settings"
            onClick={() => navigate('profile', 'settings')}
          />
        }
      />
      <IdentityCard />
      <LifetimeStats />
      <NutritionTodayWidget />
      <FrequencyWidget />
      <WeekMuscles />
      <ToolsWidget />
    </div>
  );
}

function IdentityCard() {
  const name = useSettings((s) => s.name);
  const goal = useSettings((s) => s.weeklyGoal);
  const update = useSettings((s) => s.update);
  const history = useHistoryIndex();
  const momentum = useMomentum();
  const [editing, setEditing] = useState(false);
  const first = history.sorted[history.sorted.length - 1];
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'F';

  const setGoal = (g: number) => {
    const next = Math.min(7, Math.max(1, g));
    if (next !== goal) {
      haptic('select');
      update({ weeklyGoal: next });
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-accent opacity-20 blur-3xl"
      />
      <div className="relative flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-full bg-accent text-2xl font-bold text-accent-fg shadow-sm">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              defaultValue={name}
              maxLength={40}
              placeholder="Your name"
              aria-label="Your name"
              onBlur={(e) => {
                update({ name: e.target.value.trim() });
                setEditing(false);
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="field h-11 min-h-0 text-lg font-bold"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex max-w-full items-center gap-1.5 rounded-lg text-left"
            >
              <span className="truncate text-xl font-bold">{name || 'Add your name'}</span>
              <Pencil size={14} className="shrink-0 text-muted" aria-hidden />
            </button>
          )}
          <p className="text-sm text-fg-2">
            {first ? `Training since ${formatDate(first.startedAt)}` : 'Your training story starts today'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('workout')}
          aria-label={`Momentum ${momentum.level}% — open workout tab`}
          className="flex shrink-0 flex-col items-center rounded-2xl"
        >
          <Flame level={momentum.level} size={58} embers={false} />
          <span className="text-xs font-bold text-[#f97316] tabular">{momentum.level}%</span>
        </button>
      </div>

      <div className="relative mt-4 flex items-center gap-3 rounded-2xl bg-fill p-2 pl-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Weekly goal</p>
          <p className="text-xs text-fg-2">Drives your fire, streak and reminders</p>
        </div>
        <div role="group" aria-label="Weekly workout goal" className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            icon={Minus}
            aria-label="Fewer workouts"
            onClick={() => setGoal(goal - 1)}
            disabled={goal <= 1}
          />
          <span className="w-12 text-center text-lg font-bold tabular" aria-live="polite">
            {goal}×
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            icon={Plus}
            aria-label="More workouts"
            onClick={() => setGoal(goal + 1)}
            disabled={goal >= 7}
          />
        </div>
      </div>
    </Card>
  );
}

function LifetimeStats() {
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  const [now] = useState(() => Date.now());
  const stats = useMemo(() => {
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
    let volume = 0;
    let ms = 0;
    let month = 0;
    for (const w of history.sorted) {
      volume += workoutVolume(w);
      ms += (w.endedAt ?? w.startedAt) - w.startedAt;
      if (w.startedAt >= monthStart) month++;
    }
    return { total: history.sorted.length, month, volume, hours: ms / 3_600_000 };
  }, [history, now]);

  return (
    <WidgetFrame title="Your training" action="Analytics" onAction={() => navigate('analytics')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={Dumbbell} label="Workouts" value={stats.total} sub="all time" />
        <StatTile icon={CalendarDays} label="This month" value={stats.month} sub="workouts" />
        <StatTile icon={Weight} label="Lifted" value={formatVolume(stats.volume, unit, false)} sub={`${unit} total`} />
        <StatTile
          icon={Clock}
          label="Time"
          value={`${stats.hours < 10 ? stats.hours.toFixed(1) : Math.round(stats.hours)} h`}
          sub="trained"
        />
      </div>
    </WidgetFrame>
  );
}

function WeekMuscles() {
  const history = useHistoryIndex();
  const [from] = useState(() => muscleRangeStart('week'));
  const workouts = useMemo(() => history.sorted.filter((w) => w.startedAt >= from), [history, from]);
  return <MuscleMapWidget workouts={workouts} title="Muscles this week" floor={10} period="in the last 7 days" />;
}

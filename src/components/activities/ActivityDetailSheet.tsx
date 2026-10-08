import { useState } from 'react';
import { Activity, Flame, HeartPulse, Pencil, Route, Timer, Trash2 } from 'lucide-react';
import { activityCalories, formatActiveTime, SPORT_INFO, type ActivityWorkout } from '../../lib/activities';
import { formatDate, formatTime } from '../../lib/format';
import { formatDistance } from '../../lib/running';
import { useData } from '../../store/data';
import { useTargets } from '../../store/nutrition';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { confirm } from '../../store/ui';
import { Button } from '../ui/Button';
import { StatTile } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { ActivitySheet } from './ActivitySheet';
import { SportIcon } from './SportIcon';

const EFFORT_LABELS: Record<number, string> = { 3: 'Easy', 5: 'Steady', 7: 'Hard', 9: 'All-out' };

/** A logged sport session: stats, edit and delete. */
export function ActivityDetailSheet({ workout, onClose }: { workout: ActivityWorkout | null; onClose: () => void }) {
  const unit = useSettings((s) => s.unit);
  const { weightKg } = useTargets();
  const workouts = useData((s) => s.workouts);
  const deleteWorkout = useData((s) => s.deleteWorkout);
  const [editing, setEditing] = useState(false);
  const current = workout
    ? ((workouts.find((w) => w.id === workout.id) as ActivityWorkout | undefined) ?? workout)
    : null;
  const a = current?.activity;

  const onDelete = async () => {
    if (!current) return;
    const ok = await confirm({
      title: 'Delete activity?',
      message: 'It is removed from your history and goal week.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    deleteWorkout(current.id);
    toast.show('Activity deleted');
    onClose();
  };

  return (
    <>
      <Sheet
        open={Boolean(workout)}
        onClose={onClose}
        title={current?.name ?? ''}
        description={
          current && a
            ? `${formatDate(current.startedAt)} · ${formatTime(current.startedAt)} · ${SPORT_INFO[a.sport].label}`
            : undefined
        }
        footer={
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="icon"
              icon={Trash2}
              aria-label="Delete activity"
              feedback="warning"
              onClick={onDelete}
            />
            <Button icon={Pencil} block onClick={() => setEditing(true)}>
              Edit activity
            </Button>
          </div>
        }
      >
        {current && a && (
          <div className="space-y-4 pb-2">
            <div className="flex items-center gap-3 rounded-2xl bg-accent-soft p-3 text-accent-text">
              <SportIcon sport={a.sport} size={28} aria-hidden />
              <span className="font-semibold">{SPORT_INFO[a.sport].label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={Timer} label="Duration" value={formatActiveTime(a.duration)} />
              <StatTile icon={Flame} label="Energy" value={`${activityCalories(a, weightKg)} kcal`} sub="estimated" />
              {a.distance !== undefined && (
                <StatTile icon={Route} label="Distance" value={formatDistance(a.distance, unit)} />
              )}
              {a.avgHr !== undefined && <StatTile icon={HeartPulse} label="Avg HR" value={`${a.avgHr} bpm`} />}
              {a.rpe !== undefined && (
                <StatTile icon={Activity} label="Effort" value={EFFORT_LABELS[a.rpe] ?? `RPE ${a.rpe}`} />
              )}
            </div>
            {current.notes && (
              <p className="rounded-2xl bg-fill p-3 text-sm whitespace-pre-wrap text-fg-2">{current.notes}</p>
            )}
          </div>
        )}
      </Sheet>
      <ActivitySheet open={editing} onClose={() => setEditing(false)} activity={current} />
    </>
  );
}

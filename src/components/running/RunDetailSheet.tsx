import { useMemo, useState } from 'react';
import { Activity, Flame, Footprints, Gauge, HeartPulse, Mountain, Pencil, Timer, Trash2, Trophy } from 'lucide-react';
import { formatDate, formatTime } from '../../lib/format';
import {
  BEST_EFFORTS,
  formatDistance,
  formatPace,
  formatRunTime,
  isRun,
  paceSeconds,
  RUN_TYPE_LABELS,
  runCalories,
  runRecords,
  type RunWorkout,
} from '../../lib/running';
import { formatNumber } from '../../lib/units';
import { useData } from '../../store/data';
import { useTargets } from '../../store/nutrition';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { confirm } from '../../store/ui';
import { Button } from '../ui/Button';
import { StatTile } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { RunSheet } from './RunSheet';

const EFFORT_LABELS: Record<number, string> = { 3: 'Easy', 5: 'Steady', 7: 'Hard', 9: 'All-out' };

/** A logged run: stats, records it holds, edit and delete. */
export function RunDetailSheet({ workout, onClose }: { workout: RunWorkout | null; onClose: () => void }) {
  const unit = useSettings((s) => s.unit);
  const { weightKg } = useTargets();
  const workouts = useData((s) => s.workouts);
  const deleteWorkout = useData((s) => s.deleteWorkout);
  const [editing, setEditing] = useState(false);
  // Follow edits: show the stored version of the open run.
  const current = workout ? ((workouts.find((w) => w.id === workout.id) as RunWorkout | undefined) ?? workout) : null;

  const records = useMemo(() => {
    if (!current) return [];
    const r = runRecords(workouts.filter(isRun));
    const out: string[] = [];
    if (r.longest?.id === current.id) out.push('Longest run');
    if (r.fastest?.id === current.id) out.push('Fastest pace');
    for (const e of BEST_EFFORTS) {
      const best = r.efforts[e.key];
      if (best?.workoutId === current.id) out.push(`Best ${e.label} · ${formatRunTime(best.time)}`);
    }
    return out;
  }, [workouts, current]);

  const onDelete = async () => {
    if (!current) return;
    const ok = await confirm({
      title: 'Delete run?',
      message: 'It is removed from your history, goal week and records.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    deleteWorkout(current.id);
    toast.show('Run deleted');
    onClose();
  };

  const r = current?.run;
  return (
    <>
      <Sheet
        open={Boolean(workout)}
        onClose={onClose}
        title={current?.name ?? ''}
        description={
          current
            ? `${formatDate(current.startedAt)} · ${formatTime(current.startedAt)} · ${RUN_TYPE_LABELS[current.run.type]}`
            : undefined
        }
        footer={
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="icon"
              icon={Trash2}
              aria-label="Delete run"
              feedback="warning"
              onClick={onDelete}
            />
            <Button icon={Pencil} block onClick={() => setEditing(true)}>
              Edit run
            </Button>
          </div>
        }
      >
        {current && r && (
          <div className="space-y-4 pb-2">
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={Footprints} label="Distance" value={formatDistance(r.distance, unit)} />
              <StatTile icon={Timer} label="Time" value={formatRunTime(r.duration)} />
              <StatTile icon={Gauge} label="Pace" value={formatPace(paceSeconds(r, unit), unit)} />
              <StatTile icon={Flame} label="Energy" value={`${runCalories(r, weightKg)} kcal`} sub="estimated" />
              {r.elevation !== undefined && (
                <StatTile
                  icon={Mountain}
                  label="Elevation"
                  value={unit === 'kg' ? `${r.elevation} m` : `${formatNumber(r.elevation / 0.3048, 0)} ft`}
                />
              )}
              {r.avgHr !== undefined && <StatTile icon={HeartPulse} label="Avg HR" value={`${r.avgHr} bpm`} />}
              {r.rpe !== undefined && (
                <StatTile icon={Activity} label="Effort" value={EFFORT_LABELS[r.rpe] ?? `RPE ${r.rpe}`} />
              )}
            </div>
            {records.length > 0 && (
              <ul className="space-y-2">
                {records.map((label) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 rounded-2xl bg-gold-soft p-3 text-sm font-semibold"
                  >
                    <Trophy size={18} className="shrink-0 text-gold" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            )}
            {current.notes && (
              <p className="rounded-2xl bg-fill p-3 text-sm whitespace-pre-wrap text-fg-2">{current.notes}</p>
            )}
          </div>
        )}
      </Sheet>
      <RunSheet open={editing} onClose={() => setEditing(false)} run={current} />
    </>
  );
}

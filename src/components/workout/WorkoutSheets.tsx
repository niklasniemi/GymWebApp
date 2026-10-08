import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookmarkPlus, Clock, Layers, PartyPopper, Pencil, Repeat, Trash2, Trophy, Weight } from 'lucide-react';
import { formatDate, formatDuration, formatTime, pluralize } from '../../lib/format';
import { PR_LABELS, workoutPRCount, workoutSetCount, workoutVolume } from '../../lib/history';
import { routineFromWorkout } from '../../lib/routines';
import { displayWeight, formatNumber, formatVolume } from '../../lib/units';
import { exerciseName, useData, useExerciseMap } from '../../store/data';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { confirm, navigate } from '../../store/ui';
import type { Workout } from '../../types';
import { Button } from '../ui/Button';
import { SectionTitle, StatTile } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { startWorkout } from './actions';
import { WorkoutBreakdown } from './WorkoutBreakdown';
import { WorkoutTimeSheet } from './WorkoutTimeSheet';
import { RunDetailSheet } from '../running/RunDetailSheet';
import { isRun } from '../../lib/running';
import { isActivity } from '../../lib/activities';
import { ActivityDetailSheet } from '../activities/ActivityDetailSheet';
import { Flame } from '../fire/Flame';
import { clampLevel, fireStage, fuelEvents, momentumAt } from '../../lib/momentum';

function saveAsRoutine(w: Workout) {
  const { routines, saveRoutine } = useData.getState();
  const routine = routineFromWorkout(w, routines.length);
  saveRoutine(routine);
  toast.success('Routine saved', routine.name);
  return routine;
}

function WorkoutStatsGrid({ workout }: { workout: Workout }) {
  const unit = useSettings((s) => s.unit);
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatTile
        icon={Clock}
        label="Duration"
        value={formatDuration((workout.endedAt ?? workout.startedAt) - workout.startedAt)}
      />
      <StatTile icon={Weight} label="Volume" value={formatVolume(workoutVolume(workout), unit)} />
      <StatTile
        icon={Layers}
        label="Sets"
        value={workoutSetCount(workout)}
        sub={pluralize(workout.exercises.length, 'exercise')}
      />
      <StatTile icon={Trophy} label="Records" value={workoutPRCount(workout)} />
    </div>
  );
}

/** Post-workout celebration and recap. */
export function WorkoutSummarySheet({ workout, onClose }: { workout: Workout | null; onClose: () => void }) {
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  const prSets = workout
    ? workout.exercises.flatMap((we) => we.sets.filter((s) => s.prs?.length).map((s) => ({ we, s })))
    : [];

  return (
    <Sheet
      open={Boolean(workout)}
      onClose={onClose}
      title="Workout complete"
      description={workout ? `${workout.name} · ${formatDate(workout.startedAt)}` : undefined}
      footer={
        <div className="flex gap-2">
          {workout && !workout.routineId && (
            <Button
              icon={BookmarkPlus}
              onClick={() => {
                saveAsRoutine(workout);
              }}
            >
              Save as routine
            </Button>
          )}
          <Button variant="primary" block onClick={onClose} feedback="success">
            Done
          </Button>
        </div>
      }
    >
      {workout && (
        <div className="space-y-5 pb-2">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.1 }}
            className="mx-auto grid size-20 place-items-center rounded-[28px] bg-success-soft text-success-text"
          >
            <PartyPopper size={40} strokeWidth={1.75} aria-hidden />
          </motion.div>
          <WorkoutStatsGrid workout={workout} />
          <MomentumGain workout={workout} />
          {prSets.length > 0 && (
            <section>
              <SectionTitle>New personal records</SectionTitle>
              <ul className="space-y-2">
                {prSets.map(({ we, s }, i) => (
                  <motion.li
                    key={s.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.06 }}
                    className="flex items-center gap-3 rounded-2xl bg-gold-soft p-3"
                  >
                    <Trophy size={20} className="shrink-0 text-gold" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{exerciseName(exMap, we.exerciseId)}</p>
                      <p className="text-xs text-fg-2">{s.prs?.map((p) => PR_LABELS[p]).join(' · ')}</p>
                    </div>
                    <p className="shrink-0 font-bold tabular">
                      {s.weight ? `${formatNumber(displayWeight(s.weight, unit) ?? 0)} × ` : ''}
                      {s.reps}
                    </p>
                  </motion.li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <SectionTitle>Exercises</SectionTitle>
            <WorkoutBreakdown workout={workout} />
          </section>
        </div>
      )}
    </Sheet>
  );
}

/** Past workout or run details (runs get their own sheet). */
export function WorkoutDetailSheet({ workout, onClose }: { workout: Workout | null; onClose: () => void }) {
  // Remember the kind so the right sheet plays its exit animation after `workout` clears.
  const kindOf = (w: Workout) => (isRun(w) ? 'run' : isActivity(w) ? 'activity' : 'strength');
  const [kind, setKind] = useState<'run' | 'activity' | 'strength'>('strength');
  if (workout && kindOf(workout) !== kind) setKind(kindOf(workout));
  if (kind === 'run') return <RunDetailSheet workout={workout && isRun(workout) ? workout : null} onClose={onClose} />;
  if (kind === 'activity')
    return <ActivityDetailSheet workout={workout && isActivity(workout) ? workout : null} onClose={onClose} />;
  return <StrengthDetailSheet workout={workout} onClose={onClose} />;
}

/** Past strength workout details with repeat / save / delete. */
function StrengthDetailSheet({ workout, onClose }: { workout: Workout | null; onClose: () => void }) {
  const deleteWorkout = useData((s) => s.deleteWorkout);
  const saveWorkout = useData((s) => s.saveWorkout);
  const [editing, setEditing] = useState(false);

  const onDelete = async () => {
    if (!workout) return;
    const ok = await confirm({
      title: 'Delete workout?',
      message: 'This removes it from your history and analytics. Records it set will be recalculated.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    deleteWorkout(workout.id);
    toast.show('Workout deleted');
    onClose();
  };

  return (
    <>
      <Sheet
        open={Boolean(workout)}
        onClose={onClose}
        size="full"
        title={workout?.name ?? ''}
        description={
          workout
            ? `${formatDate(workout.startedAt)} · ${formatTime(workout.startedAt)}–${formatTime(workout.endedAt ?? workout.startedAt)}`
            : undefined
        }
        footer={
          <div className="flex gap-2">
            <Button size="icon" icon={Pencil} aria-label="Edit name, date and time" onClick={() => setEditing(true)} />
            <Button
              variant="danger"
              size="icon"
              icon={Trash2}
              aria-label="Delete workout"
              feedback="warning"
              onClick={onDelete}
            />
            <Button
              icon={BookmarkPlus}
              className="flex-1"
              onClick={() => {
                if (workout) saveAsRoutine(workout);
              }}
            >
              Save routine
            </Button>
            <Button
              variant="primary"
              icon={Repeat}
              className="flex-1"
              onClick={async () => {
                if (workout && (await startWorkout({ template: workout }))) {
                  onClose();
                  navigate('workout');
                }
              }}
            >
              Repeat
            </Button>
          </div>
        }
      >
        {workout && (
          <div className="space-y-5 pb-2">
            <WorkoutStatsGrid workout={workout} />
            {workout.notes && (
              <p className="rounded-2xl bg-fill p-3 text-sm whitespace-pre-wrap text-fg-2">{workout.notes}</p>
            )}
            <WorkoutBreakdown workout={workout} />
          </div>
        )}
      </Sheet>
      {workout && (
        <WorkoutTimeSheet
          open={editing}
          onClose={() => setEditing(false)}
          title="Edit workout"
          description="Fix the name, date or times — sets stay as logged."
          name={workout.name}
          start={workout.startedAt}
          end={workout.endedAt ?? workout.startedAt}
          submitLabel="Save changes"
          onSubmit={({ start, end, name }) => {
            saveWorkout({ ...workout, name: name ?? workout.name, startedAt: start, endedAt: end ?? start });
            toast.success('Workout updated');
          }}
        />
      )}
    </>
  );
}

/** How much this session fed the fire. */
function MomentumGain({ workout }: { workout: Workout }) {
  const workouts = useData((s) => s.workouts);
  const goal = useSettings((s) => s.weeklyGoal);
  const { before, after } = useMemo(() => {
    const t = (workout.endedAt ?? workout.startedAt) + 1;
    const others = workouts.filter((w) => w.id !== workout.id);
    return {
      before: Math.round(clampLevel(momentumAt(fuelEvents(others, goal), t))),
      after: Math.round(clampLevel(momentumAt(fuelEvents(workouts, goal), t))),
    };
  }, [workouts, workout, goal]);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-fill p-3">
      <Flame level={after} size={56} embers={false} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          Momentum {after}% <span className="text-[#f97316]">+{Math.max(0, after - before)}</span>
        </p>
        <p className="text-xs text-fg-2">{fireStage(after).blurb}</p>
      </div>
    </div>
  );
}

import { memo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Dumbbell, Flag, Plus, StickyNote, Timer, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useNow } from '../../hooks/useNow';
import { useWakeLock } from '../../hooks/useWakeLock';
import { formatClock, formatRest } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { workoutVolume } from '../../lib/history';
import { formatVolume } from '../../lib/units';
import { REST_PRESETS, useSettings } from '../../store/settings';
import { useRestTimer } from '../../store/timer';
import { confirm } from '../../store/ui';
import { useActiveWorkout } from '../../store/workout';
import type { Workout } from '../../types';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { Button } from '../ui/Button';
import { ActionList, EmptyState } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { ExerciseCard } from './ExerciseCard';

export function ActiveWorkout({ onFinished }: { onFinished: (w: Workout) => void }) {
  // Subscribe to the exercise id list only — editing a set doesn't re-render this level.
  const exerciseIds = useActiveWorkout(useShallow((s) => s.workout?.exercises.map((e) => e.id) ?? []));
  const keepAwake = useSettings((s) => s.keepAwake);
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState<'none' | 'more' | 'timer' | 'notes'>('none');
  useWakeLock(keepAwake);

  const { addExercises, finish, discard } = useActiveWorkout.getState();

  const onFinish = async () => {
    const w = useActiveWorkout.getState().workout;
    if (!w) return;
    const sets = w.exercises.flatMap((e) => e.sets);
    const done = sets.filter((s) => s.completed).length;
    const open = sets.length - done;
    if (done === 0) {
      haptic('warning');
      const ok = await confirm({
        title: 'No completed sets',
        message: 'Tick off at least one set to save this workout — or discard it.',
        confirmLabel: 'Discard workout',
        cancelLabel: 'Keep training',
        destructive: true,
      });
      if (ok) {
        discard();
        useRestTimer.getState().stop();
      }
      return;
    }
    if (open > 0) {
      const ok = await confirm({
        title: 'Finish workout?',
        message: `${open} unfinished set${open > 1 ? 's' : ''} will not be saved.`,
        confirmLabel: 'Finish',
      });
      if (!ok) return;
    }
    const finished = finish();
    useRestTimer.getState().stop();
    if (finished) onFinished(finished);
  };

  const onDiscard = async () => {
    setMenu('none');
    const ok = await confirm({
      title: 'Discard workout?',
      message: 'All sets logged in this session will be lost.',
      confirmLabel: 'Discard',
      destructive: true,
    });
    if (ok) {
      discard();
      useRestTimer.getState().stop();
    }
  };

  return (
    <div className="pb-8">
      <WorkoutHeader onFinish={onFinish} onMore={() => setMenu('more')} onTimer={() => setMenu('timer')} />

      <div className="mt-4 space-y-3">
        <AnimatePresence initial={false}>
          {exerciseIds.map((id, i) => (
            <ExerciseCard key={id} weId={id} index={i} total={exerciseIds.length} />
          ))}
        </AnimatePresence>
      </div>

      {exerciseIds.length === 0 && (
        <EmptyState icon={Dumbbell} title="Empty workout">
          Add your first exercise to start logging sets.
        </EmptyState>
      )}

      <div className="mt-4 space-y-2">
        <Button variant="soft" size="lg" block icon={Plus} onClick={() => setPicker(true)}>
          Add exercises
        </Button>
        <Button variant="ghost" block icon={Trash2} className="text-danger" onClick={onDiscard} feedback="warning">
          Discard workout
        </Button>
      </div>

      <ExercisePicker
        open={picker}
        multi
        title="Add exercises"
        onClose={() => setPicker(false)}
        onSelect={(ids) => {
          addExercises(ids);
          setPicker(false);
        }}
      />

      <Sheet open={menu === 'more'} onClose={() => setMenu('none')} title="Workout">
        <ActionList
          items={[
            { label: 'Workout notes', icon: StickyNote, onSelect: () => setMenu('notes') },
            { label: 'Start rest timer', icon: Timer, onSelect: () => setMenu('timer') },
            { label: 'Finish workout', icon: Flag, onSelect: () => (setMenu('none'), void onFinish()) },
            { label: 'Discard workout', icon: Trash2, destructive: true, onSelect: onDiscard },
          ]}
        />
      </Sheet>

      <Sheet open={menu === 'timer'} onClose={() => setMenu('none')} title="Start rest timer">
        <div className="grid grid-cols-2 gap-2 pb-2">
          {REST_PRESETS.map((s) => (
            <Button
              key={s}
              size="lg"
              feedback="select"
              onClick={() => {
                useRestTimer.getState().start(s);
                setMenu('none');
              }}
            >
              {formatRest(s)}
            </Button>
          ))}
        </div>
      </Sheet>

      <Sheet open={menu === 'notes'} onClose={() => setMenu('none')} title="Workout notes">
        <NotesEditor onDone={() => setMenu('none')} />
      </Sheet>
    </div>
  );
}

function NotesEditor({ onDone }: { onDone: () => void }) {
  const initial = useActiveWorkout.getState().workout?.notes ?? '';
  const [notes, setNotes] = useState(initial);
  return (
    <div className="space-y-3 pb-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        data-autofocus=""
        aria-label="Workout notes"
        placeholder="How did it feel? Sleep, energy, anything worth remembering…"
        className="field resize-none py-3"
      />
      <Button
        variant="primary"
        block
        onClick={() => {
          useActiveWorkout.getState().setNotes(notes.trim());
          onDone();
        }}
      >
        Save notes
      </Button>
    </div>
  );
}

const WorkoutHeader = memo(function WorkoutHeader({
  onFinish,
  onMore,
  onTimer,
}: {
  onFinish: () => void;
  onMore: () => void;
  onTimer: () => void;
}) {
  const name = useActiveWorkout((s) => s.workout?.name ?? '');
  const startedAt = useActiveWorkout((s) => s.workout?.startedAt ?? 0);
  const rename = useActiveWorkout((s) => s.rename);

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 px-3 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <div className="surface-bar flex items-center gap-2 rounded-[22px] p-1.5 pl-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-fg-2 uppercase">Elapsed</p>
            <Elapsed startedAt={startedAt} />
          </div>
          <Button size="icon" variant="secondary" icon={Timer} aria-label="Start rest timer" onClick={onTimer} />
          <Button size="icon" variant="secondary" aria-label="Workout options" onClick={onMore}>
            <span aria-hidden className="text-lg leading-none font-bold">
              ···
            </span>
          </Button>
          <Button variant="success" icon={Flag} onClick={onFinish} feedback="success">
            Finish
          </Button>
        </div>
      </div>

      <div className="pt-2">
        <label htmlFor="workout-name" className="sr-only">
          Workout name
        </label>
        <input
          id="workout-name"
          defaultValue={name}
          key={name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== name) rename(v);
            else e.target.value = name;
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-full truncate rounded-lg bg-transparent text-[28px] leading-tight font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-accent-text"
        />
        <WorkoutStats />
      </div>
    </>
  );
});

function Elapsed({ startedAt }: { startedAt: number }) {
  const now = useNow(1000);
  return (
    <p role="timer" aria-label="Elapsed workout time" className="text-xl leading-tight font-bold tabular">
      {formatClock((now - startedAt) / 1000)}
    </p>
  );
}

function WorkoutStats() {
  const unit = useSettings((s) => s.unit);
  const stats = useActiveWorkout(
    useShallow((s) => {
      const w = s.workout;
      if (!w) return { volume: 0, done: 0, total: 0 };
      const sets = w.exercises.flatMap((e) => e.sets);
      return { volume: workoutVolume(w), done: sets.filter((x) => x.completed).length, total: sets.length };
    }),
  );
  return (
    <p className="mt-0.5 text-sm text-fg-2 tabular">
      {stats.done}/{stats.total} sets · {formatVolume(stats.volume, unit)} volume
    </p>
  );
}

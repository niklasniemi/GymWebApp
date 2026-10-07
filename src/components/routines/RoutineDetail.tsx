import { Pencil, Play } from 'lucide-react';
import { formatRelativeDay, formatRest, pluralize } from '../../lib/format';
import { exerciseName, useData, useExerciseMap } from '../../store/data';
import { useSettings } from '../../store/settings';
import { navigate, useUI } from '../../store/ui';
import { startWorkout } from '../workout/actions';
import { Button } from '../ui/Button';
import { SectionTitle } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { RoutineMuscleMap } from './RoutineMuscleMap';

/** App-level routine detail: muscle heat map, exercises, start / edit. */
export function RoutineDetailHost() {
  const id = useUI((s) => s.routineDetailId);
  const close = useUI((s) => s.closeRoutine);
  const editRoutine = useUI((s) => s.editRoutine);
  const routine = useData((s) => (id ? s.routines.find((r) => r.id === id) : undefined));
  const exMap = useExerciseMap();
  const defaultRest = useSettings((s) => s.defaultRest);

  const totalSets = routine?.exercises.reduce((n, e) => n + e.sets, 0) ?? 0;

  return (
    <Sheet
      open={Boolean(routine)}
      onClose={close}
      size="full"
      title={routine?.name ?? ''}
      description={
        routine
          ? [
              pluralize(routine.exercises.length, 'exercise'),
              pluralize(totalSets, 'set'),
              routine.lastUsedAt ? `last done ${formatRelativeDay(routine.lastUsedAt).toLowerCase()}` : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      footer={
        routine && (
          <div className="flex gap-2">
            <Button icon={Pencil} onClick={() => editRoutine(routine.id)}>
              Edit
            </Button>
            <Button
              variant="primary"
              block
              icon={Play}
              feedback="success"
              onClick={async () => {
                if (await startWorkout({ routine })) {
                  close();
                  navigate('workout');
                }
              }}
            >
              Start workout
            </Button>
          </div>
        )
      }
    >
      {routine && (
        <div className="space-y-5 pb-2">
          {routine.notes && <p className="rounded-2xl bg-fill p-3 text-sm text-fg-2">{routine.notes}</p>}
          <section aria-label="Muscles worked">
            <SectionTitle>Muscles worked</SectionTitle>
            <RoutineMuscleMap routine={routine} height={360} />
          </section>
          <section aria-label="Exercises">
            <SectionTitle>Exercises</SectionTitle>
            <ol className="divide-y divide-line overflow-hidden rounded-2xl bg-fill">
              {routine.exercises.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-5 shrink-0 font-semibold text-muted tabular">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{exerciseName(exMap, e.exerciseId)}</span>
                  <span className="shrink-0 text-fg-2 tabular">
                    {e.sets} × {e.reps} · {formatRest(e.restSeconds ?? defaultRest)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Sheet>
  );
}

import { lazy, Suspense, useState } from 'react';
import { Archive, Dumbbell, Medal, Pencil, Repeat, Target, Trash2, Trophy } from 'lucide-react';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../../data/exercises';
import { formatDate } from '../../lib/format';
import { topSet } from '../../lib/history';
import { displayWeight, formatNumber, formatWeight } from '../../lib/units';
import { useData, useExerciseMap, useHistoryIndex } from '../../store/data';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { confirm, useUI } from '../../store/ui';
import { Button } from '../ui/Button';
import { Badge, SectionTitle, StatTile } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { WarmupPlanner } from '../tools/WarmupPlanner';
import { ExerciseForm } from './ExerciseForm';

const ExerciseProgress = lazy(() => import('../analytics/ExerciseProgress'));

/** Global exercise detail sheet, opened from anywhere via `useUI().openExercise(id)`. */
export function ExerciseDetailHost() {
  const id = useUI((s) => s.exerciseDetailId);
  const close = useUI((s) => s.closeExercise);
  const exMap = useExerciseMap();
  const ex = id ? exMap.get(id) : undefined;
  const [editing, setEditing] = useState(false);

  return (
    <>
      <Sheet
        open={Boolean(ex)}
        onClose={close}
        size="full"
        title={ex?.name ?? ''}
        description={
          ex
            ? [MUSCLE_LABELS[ex.primaryMuscle], EQUIPMENT_LABELS[ex.equipment]].join(' · ') +
              (ex.secondaryMuscles.length
                ? ` · also ${ex.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}`
                : '')
            : undefined
        }
        headerAction={
          ex?.custom ? (
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label="Edit exercise"
              icon={Pencil}
              onClick={() => setEditing(true)}
            />
          ) : undefined
        }
      >
        {ex && <DetailBody exerciseId={ex.id} />}
      </Sheet>
      {ex?.custom && <ExerciseForm open={editing} onClose={() => setEditing(false)} exercise={ex} />}
    </>
  );
}

function DetailBody({ exerciseId }: { exerciseId: string }) {
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  const ex = useExerciseMap().get(exerciseId);
  const deleteExercise = useData((s) => s.deleteExercise);
  const close = useUI((s) => s.closeExercise);
  const bests = history.bests.get(exerciseId);
  const sessions = history.sessions.get(exerciseId) ?? [];
  const bodyweight = ex?.equipment === 'bodyweight';
  const lastTop = topSet(sessions[sessions.length - 1]?.sets ?? []);

  const onDelete = async () => {
    if (!ex) return;
    const ok = await confirm({
      title: `Delete “${ex.name}”?`,
      message: sessions.length
        ? 'It appears in your history, so it will be archived: past workouts keep it, but it disappears from the library.'
        : 'This exercise will be removed from the library and any routines.',
      confirmLabel: sessions.length ? 'Archive' : 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const result = deleteExercise(ex.id);
    toast.show(result === 'archived' ? 'Exercise archived' : 'Exercise deleted', ex.name);
    close();
  };

  return (
    <div className="space-y-6 pb-4">
      {ex?.notes && <p className="rounded-2xl bg-fill p-3 text-sm text-fg-2">{ex.notes}</p>}

      <section aria-label="Personal records">
        <SectionTitle>Personal records</SectionTitle>
        {bests ? (
          <div className="grid grid-cols-2 gap-2">
            {!bodyweight && (
              <>
                <StatTile
                  icon={Target}
                  label="Est. 1RM"
                  value={formatWeight(bests.e1rm, unit, true, 1)}
                  sub="Epley formula"
                />
                <StatTile icon={Trophy} label="Heaviest" value={formatWeight(bests.weight, unit)} />
                <StatTile icon={Medal} label="Best set" value={formatWeight(bests.volume, unit)} sub="weight × reps" />
              </>
            )}
            <StatTile icon={Repeat} label="Most reps" value={bests.reps} sub={`${sessions.length} sessions`} />
          </div>
        ) : (
          <p className="rounded-2xl bg-fill p-4 text-sm text-fg-2">
            No history yet. Complete a set of this exercise to start tracking records.
          </p>
        )}
      </section>

      {sessions.length > 0 && (
        <section aria-label="Progress chart">
          <SectionTitle>Progress</SectionTitle>
          <Suspense fallback={<div className="h-[268px] animate-pulse rounded-2xl bg-fill" />}>
            <ExerciseProgress exerciseId={exerciseId} bodyweight={bodyweight} />
          </Suspense>
        </section>
      )}

      {!bodyweight && (
        <section aria-label="Warm-up calculator">
          <SectionTitle>Warm-up calculator</SectionTitle>
          <WarmupPlanner
            initialWeight={displayWeight(lastTop?.weight ?? null, unit)}
            unit={unit}
            barbell={ex?.equipment === 'barbell'}
          />
        </section>
      )}

      {sessions.length > 0 && (
        <section aria-label="History">
          <SectionTitle>History</SectionTitle>
          <ol className="space-y-2">
            {[...sessions]
              .reverse()
              .slice(0, 12)
              .map((s) => (
                <li key={s.workoutId} className="rounded-2xl bg-fill p-3">
                  <p className="mb-1.5 text-[13px] font-semibold text-fg-2">{formatDate(s.date)}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {s.sets.map((set) => (
                      <li key={set.id}>
                        <Badge
                          tone={set.prs?.length ? 'gold' : set.type === 'warmup' ? 'neutral' : 'accent'}
                          className="text-[13px]"
                        >
                          {set.prs?.length ? <Trophy size={11} aria-label="PR" /> : null}
                          {set.type === 'warmup' && 'W · '}
                          {set.weight ? `${formatNumber(displayWeight(set.weight, unit) ?? 0)} × ` : ''}
                          {set.reps}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ol>
        </section>
      )}

      {ex?.custom && (
        <Button variant="danger" block icon={sessions.length ? Archive : Trash2} feedback="warning" onClick={onDelete}>
          {sessions.length ? 'Archive exercise' : 'Delete exercise'}
        </Button>
      )}
      {!ex && (
        <p className="flex items-center gap-2 text-sm text-fg-2">
          <Dumbbell size={16} aria-hidden /> This exercise no longer exists.
        </p>
      )}
    </div>
  );
}

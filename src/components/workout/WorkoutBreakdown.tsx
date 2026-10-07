import { memo } from 'react';
import { Trophy } from 'lucide-react';
import { setLabels } from '../../lib/history';
import { displayWeight, formatNumber } from '../../lib/units';
import { cn } from '../../lib/utils';
import { exerciseName, useExerciseMap } from '../../store/data';
import { useSettings } from '../../store/settings';
import type { Workout } from '../../types';

/** Read-only list of exercises and sets for a finished workout. */
export const WorkoutBreakdown = memo(function WorkoutBreakdown({ workout }: { workout: Workout }) {
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  return (
    <ol className="space-y-2">
      {workout.exercises.map((we) => {
        const labels = setLabels(we.sets);
        return (
          <li key={we.id} className="rounded-2xl bg-fill p-3">
            <p className="mb-2 font-semibold">{exerciseName(exMap, we.exerciseId)}</p>
            <table className="w-full text-sm tabular">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Set</th>
                  <th scope="col">Weight × reps</th>
                  <th scope="col">Records</th>
                </tr>
              </thead>
              <tbody>
                {we.sets.map((s, i) => {
                  const label = labels[i];
                  return (
                    <tr key={s.id} className="h-8">
                      <td className="w-8">
                        <span
                          className={cn(
                            'grid size-6 place-items-center rounded-md text-[11px] font-bold',
                            s.type === 'warmup' ? 'bg-gold-soft text-gold' : 'bg-surface text-fg-2 dark:bg-surface-3',
                          )}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="font-medium">
                        {s.weight ? `${formatNumber(displayWeight(s.weight, unit) ?? 0)} ${unit} × ` : 'BW × '}
                        {s.reps}
                        {s.rpe !== null && <span className="ml-1.5 text-xs text-fg-2">@{s.rpe}</span>}
                        {s.rir !== null && <span className="ml-1.5 text-xs text-fg-2">{s.rir} RIR</span>}
                      </td>
                      <td className="text-right">
                        {s.prs?.length ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gold">
                            <Trophy size={13} aria-hidden /> PR
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </li>
        );
      })}
    </ol>
  );
});

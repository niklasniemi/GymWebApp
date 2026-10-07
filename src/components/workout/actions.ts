import { haptic } from '../../lib/haptics';
import { playChime } from '../../lib/sound';
import { formatWeight } from '../../lib/units';
import { useData, getExerciseMap, exerciseName } from '../../store/data';
import { getSettings } from '../../store/settings';
import { useRestTimer } from '../../store/timer';
import { toast } from '../../store/toast';
import { confirm } from '../../store/ui';
import { getActivePRs, useActiveWorkout, type ToggleResult } from '../../store/workout';
import type { Routine, Workout } from '../../types';

/**
 * Completes / un-completes a set and runs every side effect: haptics,
 * PR detection + celebration, and the automatic rest timer.
 */
export function toggleSetDone(weId: string, setId: string): ToggleResult {
  const store = useActiveWorkout.getState();
  const result = store.toggleSet(weId, setId);

  if (result.status === 'missing-reps') {
    haptic('warning');
    return result;
  }
  if (result.status === 'uncompleted') {
    haptic('tap');
    return result;
  }

  const workout = useActiveWorkout.getState().workout;
  const we = workout?.exercises.find((x) => x.id === weId);
  if (!workout || !we) return result;
  const name = exerciseName(getExerciseMap(useData.getState().exercises), we.exerciseId);
  const settings = getSettings();

  const prs = getActivePRs(workout).get(setId);
  if (prs?.length) {
    haptic('pr');
    playChime('pr');
    const { weight, reps } = result.set;
    toast.pr(`New PR · ${name}`, prs, weight ? `${formatWeight(weight, settings.unit)} × ${reps}` : `${reps} reps`);
  } else {
    haptic('success');
  }

  if (settings.autoStartRest) {
    useRestTimer.getState().start(we.restSeconds ?? settings.defaultRest, name);
  }
  return result;
}

/** Deletes a set from the active workout, offering an Undo toast. */
export function deleteSet(weId: string, setId: string) {
  const store = useActiveWorkout.getState();
  const we = store.workout?.exercises.find((x) => x.id === weId);
  const index = we?.sets.findIndex((s) => s.id === setId) ?? -1;
  if (!we || index < 0) return;
  const removed = we.sets[index];
  store.removeSet(weId, setId);
  toast.undo('Set deleted', () => {
    useActiveWorkout.getState().insertSet(weId, removed, index);
    haptic('tap');
  });
}

/** Starts a workout, confirming before replacing one in progress. */
export async function startWorkout(opts: { routine?: Routine; template?: Workout } = {}): Promise<boolean> {
  const active = useActiveWorkout.getState().workout;
  if (active) {
    const ok = await confirm({
      title: 'Replace current workout?',
      message: `“${active.name}” is still in progress. Starting a new workout will discard it.`,
      confirmLabel: 'Discard & start',
      destructive: true,
    });
    if (!ok) return false;
  }
  useActiveWorkout.getState().start(opts);
  useRestTimer.getState().stop();
  haptic('success');
  return true;
}

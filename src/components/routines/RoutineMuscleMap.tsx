import { useMemo } from 'react';
import { routineMuscleLoad } from '../../lib/muscles';
import { useExerciseMap } from '../../store/data';
import type { Routine } from '../../types';
import { MuscleMap } from '../body/MuscleMap';

/** Planned sets per muscle for a routine (primary = 1 set, assisting = ½). */
export function RoutineMuscleMap({
  routine,
  height = 340,
  showList = true,
}: {
  routine: Pick<Routine, 'exercises'>;
  height?: number;
  showList?: boolean;
}) {
  const exMap = useExerciseMap();
  const { exercises } = routine;
  // Depend on the exercise list only — typing the routine name shouldn't recolour the body.
  const load = useMemo(() => routineMuscleLoad({ exercises }, exMap), [exercises, exMap]);
  return (
    <MuscleMap
      load={load}
      height={height}
      showList={showList}
      unitLabel="sets"
      emptyMessage="Add exercises to see the muscles this routine trains."
    />
  );
}

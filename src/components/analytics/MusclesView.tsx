import { useMemo, useState } from 'react';
import { MUSCLES } from '../../data/anatomy';
import { muscleRangeStart, MUSCLE_RANGES, workoutsMuscleLoad, type MuscleRange } from '../../lib/muscles';
import { pluralize } from '../../lib/format';
import { formatNumber } from '../../lib/units';
import { useExerciseMap, useHistoryIndex } from '../../store/data';
import { useActiveWorkout } from '../../store/workout';
import { MuscleMap } from '../body/MuscleMap';
import { Card } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';

/** Full-body heat map of training volume over a rolling window. */
export function MusclesView() {
  const history = useHistoryIndex();
  const exMap = useExerciseMap();
  const active = useActiveWorkout((s) => s.workout);
  const [range, setRange] = useState<MuscleRange>('week');
  const def = MUSCLE_RANGES.find((r) => r.value === range) ?? MUSCLE_RANGES[1];

  const { load, sessions, sets } = useMemo(() => {
    const from = muscleRangeStart(range);
    const list = history.sorted.filter((w) => w.startedAt >= from);
    // Include today's in-progress session so the map updates live.
    if (active && active.startedAt >= from) list.push(active);
    const load = workoutsMuscleLoad(list, exMap);
    const sets = list.reduce(
      (n, w) =>
        n + w.exercises.reduce((k, e) => k + e.sets.filter((s) => s.completed && s.type !== 'warmup').length, 0),
      0,
    );
    return { load, sessions: list.length, sets };
  }, [history, exMap, active, range]);

  const trainedCount = MUSCLES.filter((m) => load[m] > 0).length;

  return (
    <div className="space-y-4">
      <Segmented
        label="Period"
        value={range}
        onChange={setRange}
        options={MUSCLE_RANGES.map((r) => ({ value: r.value, label: r.label }))}
      />
      <p className="px-1 text-sm text-fg-2">
        {pluralize(sessions, 'workout')} · {formatNumber(sets, 0)} working sets · {trainedCount}/{MUSCLES.length}{' '}
        muscles hit {def.noun}
      </p>
      <Card>
        <MuscleMap
          load={load}
          floor={def.floor}
          height={420}
          unitLabel="sets"
          emptyMessage={`No training ${def.noun}.`}
        />
      </Card>
    </div>
  );
}

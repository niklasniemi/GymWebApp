import { memo } from 'react';
import { ChevronRight, Clock, Footprints, Trophy, Weight } from 'lucide-react';
import { formatDuration, formatRelativeDay } from '../../lib/format';
import { topSet, workoutPRCount, workoutVolume } from '../../lib/history';
import { formatDistance, formatPace, formatRunTime, isRun, paceSeconds, type RunWorkout } from '../../lib/running';
import { formatActiveTime, isActivity, SPORT_INFO, type ActivityWorkout } from '../../lib/activities';
import { SportIcon } from '../activities/SportIcon';
import { displayWeight, formatNumber, formatVolume } from '../../lib/units';
import { exerciseName, useExerciseMap } from '../../store/data';
import { useSettings } from '../../store/settings';
import type { Workout } from '../../types';

export const WorkoutHistoryCard = memo(function WorkoutHistoryCard({
  workout,
  onOpen,
}: {
  workout: Workout;
  onOpen: (id: string) => void;
}) {
  const exMap = useExerciseMap();
  const unit = useSettings((s) => s.unit);
  if (isRun(workout)) return <RunHistoryCard workout={workout} onOpen={onOpen} />;
  if (isActivity(workout)) return <ActivityHistoryCard workout={workout} onOpen={onOpen} />;
  const prs = workoutPRCount(workout);
  const shown = workout.exercises.slice(0, 4);

  return (
    <button
      type="button"
      onClick={() => onOpen(workout.id)}
      className="surface block w-full rounded-2xl p-4 text-left transition-transform active:scale-[0.98] [content-visibility:auto] [contain-intrinsic-size:auto_160px]"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold">{workout.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-fg-2">
            <span>{formatRelativeDay(workout.startedAt)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} aria-hidden />
              {formatDuration((workout.endedAt ?? workout.startedAt) - workout.startedAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Weight size={12} aria-hidden />
              {formatVolume(workoutVolume(workout), unit)}
            </span>
            {prs > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-gold">
                <Trophy size={12} aria-hidden />
                {prs} PR{prs > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <ChevronRight size={18} className="mt-1 shrink-0 text-muted" aria-hidden />
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {shown.map((we) => {
          const best = topSet(we.sets);
          const working = we.sets.filter((s) => s.type !== 'warmup').length;
          return (
            <li key={we.id} className="flex gap-2">
              <span className="min-w-0 flex-1 truncate">
                <span className="text-fg-2 tabular">{working} × </span>
                {exerciseName(exMap, we.exerciseId)}
              </span>
              {best && (
                <span className="shrink-0 font-medium text-fg-2 tabular">
                  {best.weight ? `${formatNumber(displayWeight(best.weight, unit) ?? 0)} × ` : ''}
                  {best.reps}
                </span>
              )}
            </li>
          );
        })}
        {workout.exercises.length > shown.length && (
          <li className="text-xs text-muted">+{workout.exercises.length - shown.length} more</li>
        )}
      </ul>
    </button>
  );
});

function RunHistoryCard({ workout, onOpen }: { workout: RunWorkout; onOpen: (id: string) => void }) {
  const unit = useSettings((s) => s.unit);
  const r = workout.run;
  return (
    <button
      type="button"
      onClick={() => onOpen(workout.id)}
      className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-[0.98] [content-visibility:auto] [contain-intrinsic-size:auto_88px]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
        <Footprints size={22} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold">{workout.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-fg-2">
          <span>{formatRelativeDay(workout.startedAt)}</span>
          <span className="font-semibold text-fg tabular">{formatDistance(r.distance, unit)}</span>
          <span className="inline-flex items-center gap-1 tabular">
            <Clock size={12} aria-hidden />
            {formatRunTime(r.duration)}
          </span>
          <span className="tabular">{formatPace(paceSeconds(r, unit), unit)}</span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </button>
  );
}

function ActivityHistoryCard({ workout, onOpen }: { workout: ActivityWorkout; onOpen: (id: string) => void }) {
  const unit = useSettings((s) => s.unit);
  const a = workout.activity;
  return (
    <button
      type="button"
      onClick={() => onOpen(workout.id)}
      className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-[0.98] [content-visibility:auto] [contain-intrinsic-size:auto_88px]"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
        <SportIcon sport={a.sport} size={22} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold">{workout.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-fg-2">
          <span>{formatRelativeDay(workout.startedAt)}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-fg tabular">
            <Clock size={12} aria-hidden />
            {formatActiveTime(a.duration)}
          </span>
          {a.distance !== undefined && <span className="tabular">{formatDistance(a.distance, unit)}</span>}
          {workout.name !== SPORT_INFO[a.sport].label && <span>{SPORT_INFO[a.sport].label}</span>}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </button>
  );
}

import { memo } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../../data/exercises';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';
import type { Exercise } from '../../types';
import { FavoriteButton } from './FavoriteButton';

interface Props {
  exercise: Exercise;
  onPress: (id: string) => void;
  /** undefined = navigation row; boolean = selectable row. */
  selected?: boolean;
  meta?: string;
}

export const ExerciseRow = memo(function ExerciseRow({ exercise, onPress, selected, meta }: Props) {
  const selectable = selected !== undefined;
  return (
    <div
      className={cn(
        'flex min-h-16 items-center gap-1 rounded-2xl pr-1 transition-transform',
        selected ? 'bg-accent-soft' : 'hover:bg-fill',
      )}
    >
      <button
        type="button"
        role={selectable ? 'checkbox' : undefined}
        aria-checked={selectable ? selected : undefined}
        onClick={() => {
          haptic(selectable ? 'select' : 'tap');
          onPress(exercise.id);
        }}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2 pl-3 text-left transition-transform active:scale-[0.98]"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-fill text-sm font-bold text-fg-2"
        >
          {exercise.name.charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">
            {exercise.name}
            {exercise.custom && <span className="ml-1.5 text-xs font-medium text-accent-text">Custom</span>}
          </span>
          <span className="block truncate text-[13px] text-fg-2">
            {MUSCLE_LABELS[exercise.primaryMuscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
            {meta ? ` · ${meta}` : ''}
          </span>
        </span>
        {selectable && (
          <span
            aria-hidden
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-full border-2',
              selected ? 'border-accent bg-accent text-accent-fg' : 'border-fill-strong',
            )}
          >
            {selected && <Check size={16} strokeWidth={3} />}
          </span>
        )}
      </button>
      <FavoriteButton exerciseId={exercise.id} name={exercise.name} size="sm" />
      {!selectable && <ChevronRight size={18} aria-hidden className="mr-1 shrink-0 text-muted" />}
    </div>
  );
});

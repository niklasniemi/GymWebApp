import { memo } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../../data/exercises';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';
import type { Exercise } from '../../types';

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
    <button
      type="button"
      role={selectable ? 'checkbox' : undefined}
      aria-checked={selectable ? selected : undefined}
      onClick={() => {
        haptic(selectable ? 'select' : 'tap');
        onPress(exercise.id);
      }}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-transform active:scale-[0.98]',
        selected ? 'bg-accent-soft' : 'hover:bg-fill',
      )}
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
      {selectable ? (
        <span
          aria-hidden
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full border-2 transition-transform',
            selected ? 'scale-100 border-accent bg-accent text-accent-fg' : 'border-fill-strong',
          )}
        >
          {selected && <Check size={16} strokeWidth={3} />}
        </span>
      ) : (
        <ChevronRight size={18} aria-hidden className="shrink-0 text-muted" />
      )}
    </button>
  );
});

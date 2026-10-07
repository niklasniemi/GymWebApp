import { Search, X } from 'lucide-react';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../../data/exercises';
import { EQUIPMENT, MUSCLE_GROUPS } from '../../types';
import { Chip } from '../ui/primitives';

import type { useExerciseFilter } from './useExerciseFilter';

type FilterState = ReturnType<typeof useExerciseFilter>;

export function ExerciseFilters({
  filter,
  autoFocus,
  inset = 'px-5',
}: {
  filter: FilterState;
  autoFocus?: boolean;
  /** Horizontal padding; chip rows scroll edge-to-edge within it. */
  inset?: string;
}) {
  return (
    <div>
      <div className={inset}>
        <div className="relative">
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={filter.query}
            onChange={(e) => filter.setQuery(e.target.value)}
            placeholder="Search exercises"
            aria-label="Search exercises"
            autoComplete="off"
            enterKeyHint="search"
            data-autofocus={autoFocus ? '' : undefined}
            className="field pr-10 pl-10 text-[16px]"
          />
          {filter.query && (
            <button
              type="button"
              onClick={() => filter.setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <div
        role="group"
        aria-label="Filter by muscle group"
        className={`mt-2.5 flex gap-1.5 overflow-x-auto no-scrollbar ${inset}`}
      >
        {MUSCLE_GROUPS.map((m) => (
          <Chip key={m} selected={filter.muscle === m} onClick={() => filter.setMuscle(filter.muscle === m ? null : m)}>
            {MUSCLE_LABELS[m]}
          </Chip>
        ))}
      </div>
      <div
        role="group"
        aria-label="Filter by equipment"
        className={`mt-1.5 flex gap-1.5 overflow-x-auto no-scrollbar ${inset}`}
      >
        {EQUIPMENT.map((eq) => (
          <Chip
            key={eq}
            selected={filter.equipment === eq}
            onClick={() => filter.setEquipment(filter.equipment === eq ? null : eq)}
          >
            {EQUIPMENT_LABELS[eq]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

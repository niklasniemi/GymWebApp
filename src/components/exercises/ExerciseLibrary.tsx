import { useState } from 'react';
import { Plus, SearchX } from 'lucide-react';
import { useData, useHistoryIndex } from '../../store/data';
import { useUI } from '../../store/ui';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/primitives';
import { ExerciseFilters } from './ExerciseFilters';
import { useExerciseFilter } from './useExerciseFilter';
import { ExerciseForm } from './ExerciseForm';
import { ExerciseRow } from './ExerciseRow';

export function ExerciseLibrary() {
  const exercises = useData((s) => s.exercises);
  const history = useHistoryIndex();
  const openExercise = useUI((s) => s.openExercise);
  const filter = useExerciseFilter(exercises);
  const [creating, setCreating] = useState(false);
  const sessionMeta = (id: string) => {
    const n = history.sessions.get(id)?.length ?? 0;
    return n ? `${n} session${n > 1 ? 's' : ''}` : undefined;
  };

  return (
    <div className="space-y-3">
      <div className="-mx-4">
        <ExerciseFilters filter={filter} inset="px-4" />
      </div>
      <div className="flex items-center justify-between px-1">
        <p className="text-[13px] text-fg-2" aria-live="polite">
          {filter.results.length} exercise{filter.results.length === 1 ? '' : 's'}
        </p>
        <Button size="sm" variant="soft" icon={Plus} onClick={() => setCreating(true)}>
          Custom exercise
        </Button>
      </div>
      {!filter.filtered && filter.favoriteList.length > 0 && (
        <section aria-label="Favourites">
          <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Favourites</h2>
          <div className="surface rounded-3xl p-1.5">
            {filter.favoriteList.map((e) => (
              <ExerciseRow key={e.id} exercise={e} onPress={openExercise} meta={sessionMeta(e.id)} />
            ))}
          </div>
          <h2 className="mt-4 px-1 text-[13px] font-semibold tracking-wide text-fg-2 uppercase">All exercises</h2>
        </section>
      )}
      <div className="surface rounded-3xl p-1.5">
        {filter.results.map((e) => (
          <ExerciseRow key={e.id} exercise={e} onPress={openExercise} meta={sessionMeta(e.id)} />
        ))}
        {filter.results.length === 0 && (
          <EmptyState icon={SearchX} title="No matches">
            Adjust the filters or create a custom exercise.
          </EmptyState>
        )}
      </div>
      <ExerciseForm open={creating} onClose={() => setCreating(false)} initialName={filter.query} />
    </div>
  );
}

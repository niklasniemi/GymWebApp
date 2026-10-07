import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Plus, SearchX, Star } from 'lucide-react';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { useData, useHistoryIndex } from '../../store/data';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { ExerciseFilters } from './ExerciseFilters';
import { useExerciseFilter } from './useExerciseFilter';
import { ExerciseForm } from './ExerciseForm';
import { ExerciseRow } from './ExerciseRow';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (ids: string[]) => void;
  title?: string;
  /** Allow picking several exercises at once (default: single). */
  multi?: boolean;
}

export function ExercisePicker({ open, onClose, onSelect, title = 'Add exercise', multi = false }: Props) {
  const exercises = useData((s) => s.exercises);
  const history = useHistoryIndex();
  const desktop = useIsDesktop();
  const filter = useExerciseFilter(exercises);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Fresh selection and search every time the picker opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected([]);
      filter.reset();
    }
  }

  const recent = useMemo(() => {
    if (!open) return [];
    const ids: string[] = [];
    for (const w of history.sorted.slice(0, 6)) {
      for (const we of w.exercises) if (!ids.includes(we.exerciseId)) ids.push(we.exerciseId);
    }
    const byId = new Map(exercises.map((e) => [e.id, e]));
    return ids
      .map((id) => byId.get(id))
      .filter((e) => e && !e.archived)
      .slice(0, 6) as typeof exercises;
  }, [open, history, exercises]);

  const toggle = useCallback(
    (id: string) => {
      if (!multi) {
        onSelect([id]);
        return;
      }
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    },
    [multi, onSelect],
  );

  const showRecent = !filter.filtered && recent.length > 0;

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={title}
        size="full"
        flush
        headerAction={
          <Button size="sm" variant="soft" icon={Plus} onClick={() => setCreating(true)}>
            New
          </Button>
        }
        toolbar={<ExerciseFilters filter={filter} autoFocus={desktop} />}
        footer={
          multi ? (
            <Button
              variant="primary"
              size="lg"
              block
              disabled={!selected.length}
              feedback="success"
              onClick={() => onSelect(selected)}
            >
              {selected.length
                ? `Add ${selected.length} exercise${selected.length > 1 ? 's' : ''}`
                : 'Select exercises'}
            </Button>
          ) : undefined
        }
      >
        <div className="px-2 pb-4">
          {!filter.filtered && filter.favoriteList.length > 0 && (
            <PickerSection title="Favourites" first>
              {filter.favoriteList.map((e) => (
                <ExerciseRow
                  key={`f-${e.id}`}
                  exercise={e}
                  onPress={toggle}
                  selected={multi ? selected.includes(e.id) : undefined}
                />
              ))}
            </PickerSection>
          )}
          {showRecent && (
            <PickerSection title="Recent" first={!filter.favoriteList.length}>
              {recent.map((e) => (
                <ExerciseRow
                  key={`r-${e.id}`}
                  exercise={e}
                  onPress={toggle}
                  selected={multi ? selected.includes(e.id) : undefined}
                />
              ))}
            </PickerSection>
          )}
          {!filter.filtered && (filter.favoriteList.length > 0 || showRecent) && (
            <h3 className="px-3 pt-4 pb-1 text-[12px] font-semibold tracking-wide text-fg-2 uppercase">
              All exercises
            </h3>
          )}
          {filter.results.map((e) => (
            <ExerciseRow
              key={e.id}
              exercise={e}
              onPress={toggle}
              selected={multi ? selected.includes(e.id) : undefined}
            />
          ))}
          {filter.results.length === 0 && filter.favoritesOnly && !filter.favoriteList.length ? (
            <EmptyState icon={Star} title="No favourites yet">
              Tap the ☆ next to any exercise to pin it here.
            </EmptyState>
          ) : (
            filter.results.length === 0 && (
              <EmptyState
                icon={SearchX}
                title="No matches"
                action={
                  <Button variant="soft" icon={Plus} onClick={() => setCreating(true)}>
                    Create “{filter.query || 'custom exercise'}”
                  </Button>
                }
              >
                Try a different search or create a custom exercise.
              </EmptyState>
            )
          )}
        </div>
      </Sheet>
      <ExerciseForm
        open={creating}
        onClose={() => setCreating(false)}
        initialName={filter.query}
        onSaved={(ex) => {
          setCreating(false);
          if (multi) setSelected((s) => [...s, ex.id]);
          else onSelect([ex.id]);
        }}
      />
    </>
  );
}

function PickerSection({ title, first, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3
        className={`px-3 pb-1 text-[12px] font-semibold tracking-wide text-fg-2 uppercase ${first ? 'pt-1' : 'pt-4'}`}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

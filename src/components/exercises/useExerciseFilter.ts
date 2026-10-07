import { useDeferredValue, useMemo, useState } from 'react';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../../data/exercises';
import type { Equipment, Exercise, MuscleGroup } from '../../types';

export function useExerciseFilter(exercises: Exercise[]) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  // Typing stays responsive; filtering a few hundred rows happens at lower priority.
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const tokens = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return exercises
      .filter((e) => {
        if (e.archived) return false;
        if (muscle && e.primaryMuscle !== muscle) return false;
        if (equipment && e.equipment !== equipment) return false;
        if (!tokens.length) return true;
        const hay = `${e.name} ${MUSCLE_LABELS[e.primaryMuscle]} ${EQUIPMENT_LABELS[e.equipment]}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, deferredQuery, muscle, equipment]);

  const filtered = Boolean(query || muscle || equipment);
  const reset = () => {
    setQuery('');
    setMuscle(null);
    setEquipment(null);
  };
  return { query, setQuery, muscle, setMuscle, equipment, setEquipment, results, filtered, reset };
}

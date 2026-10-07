import { useId, useState } from 'react';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../../data/exercises';
import { uid } from '../../lib/utils';
import { useData } from '../../store/data';
import { toast } from '../../store/toast';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup } from '../../types';
import { Button } from '../ui/Button';
import { Chip, Field, TextInput } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit an existing custom exercise, or create a new one when omitted. */
  exercise?: Exercise;
  initialName?: string;
  onSaved?: (exercise: Exercise) => void;
}

export function ExerciseForm({ open, onClose, exercise, initialName = '', onSaved }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={exercise ? 'Edit exercise' : 'New exercise'}>
      <FormBody exercise={exercise} initialName={initialName} onClose={onClose} onSaved={onSaved} />
    </Sheet>
  );
}

function FormBody({ exercise, initialName, onClose, onSaved }: Omit<Props, 'open'>) {
  const exercises = useData((s) => s.exercises);
  const saveExercise = useData((s) => s.saveExercise);
  const nameId = useId();
  const notesId = useId();
  const [name, setName] = useState(exercise?.name ?? initialName ?? '');
  const [primary, setPrimary] = useState<MuscleGroup>(exercise?.primaryMuscle ?? 'chest');
  const [secondary, setSecondary] = useState<MuscleGroup[]>(exercise?.secondaryMuscles ?? []);
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'barbell');
  const [notes, setNotes] = useState(exercise?.notes ?? '');
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const duplicate = exercises.some(
    (e) => !e.archived && e.id !== exercise?.id && e.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const error = !trimmed
    ? 'Give the exercise a name.'
    : duplicate
      ? 'An exercise with this name already exists.'
      : null;

  const submit = () => {
    setTouched(true);
    if (error) return;
    const saved: Exercise = {
      id: exercise?.id ?? `custom-${uid()}`,
      name: trimmed,
      primaryMuscle: primary,
      secondaryMuscles: secondary.filter((m) => m !== primary),
      equipment,
      custom: true,
      notes: notes.trim() || undefined,
      createdAt: exercise?.createdAt ?? Date.now(),
    };
    saveExercise(saved);
    toast.success(exercise ? 'Exercise updated' : 'Exercise created', saved.name);
    onSaved?.(saved);
    onClose?.();
  };

  return (
    <form
      className="space-y-5 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field
        label="Name"
        htmlFor={nameId}
        hint={touched && error ? <span className="text-danger">{error}</span> : undefined}
      >
        <TextInput
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Landmine Press"
          autoComplete="off"
          aria-invalid={touched && Boolean(error)}
          data-autofocus=""
        />
      </Field>

      <fieldset>
        <legend className="mb-1.5 px-1 text-[13px] font-semibold text-fg-2">Primary muscle</legend>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.map((m) => (
            <Chip key={m} selected={primary === m} onClick={() => setPrimary(m)}>
              {MUSCLE_LABELS[m]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 px-1 text-[13px] font-semibold text-fg-2">Secondary muscles</legend>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.filter((m) => m !== primary).map((m) => (
            <Chip
              key={m}
              selected={secondary.includes(m)}
              onClick={() => setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}
            >
              {MUSCLE_LABELS[m]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 px-1 text-[13px] font-semibold text-fg-2">Equipment</legend>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT.map((eq) => (
            <Chip key={eq} selected={equipment === eq} onClick={() => setEquipment(eq)}>
              {EQUIPMENT_LABELS[eq]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Field label="Notes (optional)" htmlFor={notesId}>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="field resize-none py-3"
          placeholder="Setup, cues, machine settings…"
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" block feedback="success">
        {exercise ? 'Save changes' : 'Create exercise'}
      </Button>
    </form>
  );
}

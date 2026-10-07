import { useId, useState, type KeyboardEvent } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, ListPlus, Plus, Trash2 } from 'lucide-react';
import { formatRest } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { uid } from '../../lib/utils';
import { exerciseName, useData, useExerciseMap } from '../../store/data';
import { REST_PRESETS } from '../../store/settings';
import { toast } from '../../store/toast';
import { confirm } from '../../store/ui';
import type { Routine, RoutineExercise } from '../../types';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { Button } from '../ui/Button';
import { EmptyState, Field, Select, TextInput } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';

interface Props {
  open: boolean;
  /** Routine to edit; null creates a new one. */
  routine: Routine | null;
  onClose: () => void;
}

export function RoutineEditor({ open, routine, onClose }: Props) {
  const [draft, setDraft] = useState<Routine>(() => blank(routine));
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState(false);
  const [touched, setTouched] = useState(false);
  const saveRoutine = useData((s) => s.saveRoutine);
  const nameId = useId();
  const notesId = useId();

  // Reset the draft whenever the editor opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(blank(routine));
      setDirty(false);
      setTouched(false);
    }
  }

  const update = (patch: Partial<Routine>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const updateItem = (id: string, patch: Partial<RoutineExercise>) =>
    update({ exercises: draft.exercises.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const moveItem = (id: string, dir: -1 | 1) => {
    const i = draft.exercises.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= draft.exercises.length) return;
    const next = draft.exercises.slice();
    [next[i], next[j]] = [next[j], next[i]];
    haptic('select');
    update({ exercises: next });
  };

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard changes?',
        message: 'Your edits to this routine will be lost.',
        confirmLabel: 'Discard',
        destructive: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  const save = () => {
    setTouched(true);
    const name = draft.name.trim();
    if (!name) {
      haptic('warning');
      return;
    }
    saveRoutine({ ...draft, name, notes: draft.notes?.trim() || undefined, updatedAt: Date.now() });
    toast.success(routine ? 'Routine updated' : 'Routine created', name);
    onClose();
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={requestClose}
        size="full"
        title={routine ? 'Edit routine' : 'New routine'}
        footer={
          <Button variant="primary" size="lg" block feedback="success" onClick={save}>
            Save routine
          </Button>
        }
      >
        <div className="space-y-4 pb-4">
          <Field
            label="Name"
            htmlFor={nameId}
            hint={touched && !draft.name.trim() ? <span className="text-danger">Name your routine.</span> : undefined}
          >
            <TextInput
              id={nameId}
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Upper A"
              autoComplete="off"
            />
          </Field>
          <Field label="Notes (optional)" htmlFor={notesId}>
            <TextInput
              id={notesId}
              value={draft.notes ?? ''}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Focus, tempo, progression scheme…"
            />
          </Field>

          <div>
            <p className="mb-1.5 px-1 text-[13px] font-semibold text-fg-2">
              Exercises <span className="font-normal text-muted">· drag the handle to reorder</span>
            </p>
            {draft.exercises.length === 0 ? (
              <div className="rounded-2xl bg-fill">
                <EmptyState icon={ListPlus} title="No exercises yet" className="py-6">
                  Add the movements for this session in the order you'll do them.
                </EmptyState>
              </div>
            ) : (
              <Reorder.Group
                axis="y"
                values={draft.exercises}
                onReorder={(exercises) => update({ exercises })}
                className="space-y-2"
              >
                {draft.exercises.map((item, i) => (
                  <RoutineItem
                    key={item.id}
                    item={item}
                    index={i}
                    count={draft.exercises.length}
                    onChange={(patch) => updateItem(item.id, patch)}
                    onRemove={() => update({ exercises: draft.exercises.filter((x) => x.id !== item.id) })}
                    onMove={(dir) => moveItem(item.id, dir)}
                  />
                ))}
              </Reorder.Group>
            )}
            <Button variant="soft" block icon={Plus} className="mt-3" onClick={() => setPicker(true)}>
              Add exercises
            </Button>
          </div>
        </div>
      </Sheet>
      <ExercisePicker
        open={picker}
        multi
        title="Add to routine"
        onClose={() => setPicker(false)}
        onSelect={(ids) => {
          update({
            exercises: [
              ...draft.exercises,
              ...ids.map((exerciseId) => ({ id: uid(), exerciseId, sets: 3, reps: '8-12' })),
            ],
          });
          setPicker(false);
        }}
      />
    </>
  );
}

function blank(routine: Routine | null): Routine {
  if (routine) return structuredClone(routine);
  const now = Date.now();
  return {
    id: uid(),
    name: '',
    exercises: [],
    order: useData.getState().routines.length,
    createdAt: now,
    updatedAt: now,
  };
}

function RoutineItem({
  item,
  index,
  count,
  onChange,
  onRemove,
  onMove,
}: {
  item: RoutineExercise;
  index: number;
  count: number;
  onChange: (patch: Partial<RoutineExercise>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const controls = useDragControls();
  const exMap = useExerciseMap();
  const name = exerciseName(exMap, item.exerciseId);
  const repsId = useId();
  const restId = useId();

  const onHandleKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      onMove(-1);
    } else if (e.key === 'ArrowDown' && index < count - 1) {
      e.preventDefault();
      onMove(1);
    }
  };

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => haptic('select')}
      className="relative list-none rounded-2xl bg-fill p-2.5"
      style={{ position: 'relative' }}
      whileDrag={{ scale: 1.03, zIndex: 10 }}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Reorder ${name}. Use arrow keys to move up or down. Position ${index + 1} of ${count}.`}
          onPointerDown={(e) => controls.start(e)}
          onKeyDown={onHandleKey}
          className="grid size-10 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted active:cursor-grabbing"
        >
          <GripVertical size={18} aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate font-semibold">{name}</p>
        <Button size="icon-sm" variant="ghost" icon={Trash2} aria-label={`Remove ${name}`} onClick={onRemove} />
      </div>
      <div className="mt-2 grid grid-cols-[1.3fr_1fr_1fr] gap-2">
        <div>
          <p className="mb-1 px-1 text-[11px] font-semibold tracking-wide text-fg-2 uppercase">Sets</p>
          <Stepper
            label={`Sets for ${name}`}
            value={item.sets}
            onChange={(v) => onChange({ sets: Math.max(1, Math.round(v ?? 1)) })}
            step={1}
            min={1}
            max={20}
            decimals={0}
            inputMode="numeric"
            className="bg-surface dark:bg-surface-3"
          />
        </div>
        <div>
          <label
            htmlFor={repsId}
            className="mb-1 block px-1 text-[11px] font-semibold tracking-wide text-fg-2 uppercase"
          >
            Reps
          </label>
          <input
            id={repsId}
            value={item.reps}
            onChange={(e) => onChange({ reps: e.target.value.replace(/[^\d\-–]/g, '').slice(0, 7) })}
            inputMode="text"
            placeholder="8-12"
            className="field bg-surface px-2 text-center font-semibold dark:bg-surface-3"
          />
        </div>
        <div>
          <label
            htmlFor={restId}
            className="mb-1 block px-1 text-[11px] font-semibold tracking-wide text-fg-2 uppercase"
          >
            Rest
          </label>
          <Select
            id={restId}
            value={item.restSeconds ?? ''}
            onChange={(e) => onChange({ restSeconds: e.target.value ? Number(e.target.value) : undefined })}
            className="[&_select]:bg-surface [&_select]:px-2 [&_select]:pr-7 [&_select]:font-semibold dark:[&_select]:bg-surface-3"
          >
            <option value="">Default</option>
            {[30, 45, ...REST_PRESETS, 150, 240, 300].map((s) => (
              <option key={s} value={s}>
                {formatRest(s)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Reorder.Item>
  );
}

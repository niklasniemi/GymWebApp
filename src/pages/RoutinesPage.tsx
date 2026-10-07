import { memo, useState, type KeyboardEvent } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { ClipboardList, Copy, Ellipsis, GripVertical, Pencil, Play, Plus, Trash2, Zap } from 'lucide-react';
import { ExerciseLibrary } from '../components/exercises/ExerciseLibrary';
import { RoutineEditor } from '../components/routines/RoutineEditor';
import { startWorkout } from '../components/workout/actions';
import { Button } from '../components/ui/Button';
import { ActionList, Card, EmptyState, PageHeader } from '../components/ui/primitives';
import { Segmented } from '../components/ui/Segmented';
import { Sheet } from '../components/ui/Sheet';
import { formatRelativeDay } from '../lib/format';
import { haptic } from '../lib/haptics';
import { sampleRoutines } from '../lib/routines';
import { uid } from '../lib/utils';
import { exerciseName, useData, useExerciseMap } from '../store/data';
import { toast } from '../store/toast';
import { confirm, navigate } from '../store/ui';
import type { Routine } from '../types';

type View = 'routines' | 'exercises';

export default function RoutinesPage() {
  const [view, setView] = useState<View>('routines');
  const [editing, setEditing] = useState<{ routine: Routine | null } | null>(null);

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title={view === 'routines' ? 'Routines' : 'Exercises'}
        subtitle="Library"
        actions={
          view === 'routines' && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({ routine: null })}>
              New
            </Button>
          )
        }
      />
      <Segmented
        label="Library section"
        value={view}
        onChange={setView}
        options={[
          { value: 'routines', label: 'Routines' },
          { value: 'exercises', label: 'Exercises' },
        ]}
      />
      {view === 'routines' ? (
        <RoutineList onEdit={(routine) => setEditing({ routine })} onCreate={() => setEditing({ routine: null })} />
      ) : (
        <ExerciseLibrary />
      )}
      <RoutineEditor open={editing !== null} routine={editing?.routine ?? null} onClose={() => setEditing(null)} />
    </div>
  );
}

function RoutineList({ onEdit, onCreate }: { onEdit: (r: Routine) => void; onCreate: () => void }) {
  const routines = useData((s) => s.routines);
  const reorderRoutines = useData((s) => s.reorderRoutines);
  const saveRoutine = useData((s) => s.saveRoutine);
  const [order, setOrder] = useState(routines);
  const [synced, setSynced] = useState(routines);
  const [menuFor, setMenuFor] = useState<Routine | null>(null);

  // Local order for smooth dragging; adopt store changes when they arrive.
  if (routines !== synced) {
    setSynced(routines);
    setOrder(routines);
  }

  const addSamples = () => {
    for (const r of sampleRoutines(routines.length)) saveRoutine(r);
    haptic('success');
    toast.success('Starter routines added', 'Push, Pull and Legs are ready to go.');
  };

  const move = (id: string, dir: -1 | 1) => {
    const i = order.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    reorderRoutines(next.map((r) => r.id));
  };

  if (!routines.length) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="Build your first routine"
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="primary" icon={Plus} onClick={onCreate}>
                Create routine
              </Button>
              <Button variant="soft" icon={Zap} onClick={addSamples}>
                Add Push / Pull / Legs
              </Button>
            </div>
          }
        >
          Routines are reusable workout templates — sets, rep targets and rest times pre-filled.
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
        {order.map((r, i) => (
          <RoutineCard
            key={r.id}
            routine={r}
            index={i}
            count={order.length}
            onDrop={() => reorderRoutines(order.map((x) => x.id))}
            onMove={(dir) => move(r.id, dir)}
            onMenu={setMenuFor}
          />
        ))}
      </Reorder.Group>

      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)} title={menuFor?.name ?? 'Routine'}>
        {menuFor && (
          <ActionList
            items={[
              {
                label: 'Start workout',
                icon: Play,
                onSelect: async () => {
                  const r = menuFor;
                  setMenuFor(null);
                  if (await startWorkout({ routine: r })) navigate('workout');
                },
              },
              { label: 'Edit', icon: Pencil, onSelect: () => (setMenuFor(null), onEdit(menuFor)) },
              {
                label: 'Duplicate',
                icon: Copy,
                onSelect: () => {
                  const now = Date.now();
                  saveRoutine({
                    ...structuredClone(menuFor),
                    id: uid(),
                    name: `${menuFor.name} (copy)`,
                    order: routines.length,
                    createdAt: now,
                    updatedAt: now,
                    lastUsedAt: undefined,
                  });
                  toast.success('Routine duplicated');
                  setMenuFor(null);
                },
              },
              {
                label: 'Delete',
                icon: Trash2,
                destructive: true,
                onSelect: async () => {
                  const r = menuFor;
                  setMenuFor(null);
                  const ok = await confirm({
                    title: `Delete “${r.name}”?`,
                    message: 'Past workouts started from this routine are kept.',
                    confirmLabel: 'Delete',
                    destructive: true,
                  });
                  if (ok) {
                    useData.getState().deleteRoutine(r.id);
                    toast.show('Routine deleted', r.name);
                  }
                },
              },
            ]}
          />
        )}
      </Sheet>
    </>
  );
}

const RoutineCard = memo(function RoutineCard({
  routine,
  index,
  count,
  onDrop,
  onMove,
  onMenu,
}: {
  routine: Routine;
  index: number;
  count: number;
  onDrop: () => void;
  onMove: (dir: -1 | 1) => void;
  onMenu: (r: Routine) => void;
}) {
  const controls = useDragControls();
  const exMap = useExerciseMap();
  const totalSets = routine.exercises.reduce((n, e) => n + e.sets, 0);

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
      value={routine}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => haptic('select')}
      onDragEnd={onDrop}
      style={{ position: 'relative' }}
      whileDrag={{ scale: 1.03, zIndex: 10 }}
      className="surface list-none rounded-3xl p-3"
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          aria-label={`Reorder ${routine.name}. Use arrow keys to move. Position ${index + 1} of ${count}.`}
          onPointerDown={(e) => controls.start(e)}
          onKeyDown={onHandleKey}
          className="grid h-12 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted active:cursor-grabbing"
        >
          <GripVertical size={18} aria-hidden />
        </button>
        <div className="min-w-0 flex-1 py-1">
          <h3 className="truncate text-[17px] font-bold">{routine.name}</h3>
          <p className="text-[13px] text-fg-2">
            {routine.exercises.length} exercises · {totalSets} sets
            {routine.lastUsedAt ? ` · ${formatRelativeDay(routine.lastUsedAt)}` : ''}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Options for ${routine.name}`}
          icon={Ellipsis}
          onClick={() => onMenu(routine)}
        />
        <Button
          size="icon"
          variant="primary"
          icon={Play}
          aria-label={`Start ${routine.name}`}
          feedback="success"
          onClick={async () => {
            if (await startWorkout({ routine })) navigate('workout');
          }}
        />
      </div>
      {routine.exercises.length > 0 && (
        <ul className="mt-2 ml-9 space-y-0.5 text-sm text-fg-2">
          {routine.exercises.slice(0, 5).map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="min-w-0 flex-1 truncate">{exerciseName(exMap, e.exerciseId)}</span>
              <span className="shrink-0 tabular">
                {e.sets} × {e.reps}
              </span>
            </li>
          ))}
          {routine.exercises.length > 5 && <li className="text-xs text-muted">+{routine.exercises.length - 5} more</li>}
        </ul>
      )}
      {routine.notes && <p className="mt-2 ml-9 text-xs text-muted">{routine.notes}</p>}
    </Reorder.Item>
  );
});

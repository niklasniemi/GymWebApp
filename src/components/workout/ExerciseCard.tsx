import { memo, useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Ellipsis, Flame, Info, Plus, Replace, StickyNote, Timer, Trash2 } from 'lucide-react';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '../../data/exercises';
import { formatRest } from '../../lib/format';
import { inSessionHints, lastSession, matchPreviousSets, setLabels, topSet } from '../../lib/history';
import { displayWeight } from '../../lib/units';
import { cn } from '../../lib/utils';
import { useExerciseMap, useHistoryIndex } from '../../store/data';
import { REST_PRESETS, useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { useActiveWorkout } from '../../store/workout';
import { SET_TYPES, type SetType } from '../../types';
import { Button } from '../ui/Button';
import { ActionList } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { WarmupPlanner } from '../tools/WarmupPlanner';
import { ExercisePicker } from '../exercises/ExercisePicker';
import { deleteSet } from './actions';
import { SetRow } from './SetRow';

interface Props {
  weId: string;
  index: number;
  total: number;
}

type Panel = 'menu' | 'rest' | 'warmup' | 'replace' | null;

const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normal',
  warmup: 'Warm-up',
  drop: 'Drop set',
  failure: 'Failure',
};

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const RIR_VALUES = [0, 1, 2, 3, 4, 5];

export const ExerciseCard = memo(function ExerciseCard({ weId, index, total }: Props) {
  const we = useActiveWorkout((s) => s.workout?.exercises.find((e) => e.id === weId));
  const actions = useActiveWorkout.getState();
  const exMap = useExerciseMap();
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  const effort = useSettings((s) => s.effortMetric);
  const defaultRest = useSettings((s) => s.defaultRest);
  const openExercise = useUI((s) => s.openExercise);

  const [panel, setPanel] = useState<Panel>(null);
  const [menuSetId, setMenuSetId] = useState<string | null>(null);
  const [effortSetId, setEffortSetId] = useState<string | null>(null);
  const [focusSetId, setFocusSetId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(Boolean(we?.notes));

  const exerciseId = we?.exerciseId ?? '';
  const sets = we?.sets;
  // Back-filled sessions compare against what happened before them.
  const before = useActiveWorkout((s) => (s.workout?.plannedEnd ? s.workout.startedAt : undefined));
  const last = useMemo(() => lastSession(history, exerciseId, undefined, before), [history, exerciseId, before]);
  const prevSets = useMemo(() => matchPreviousSets(sets ?? [], last?.sets), [sets, last]);
  const labels = useMemo(() => setLabels(sets ?? []), [sets]);
  const hints = useMemo(() => inSessionHints(sets ?? []), [sets]);

  const onOpenMenu = useCallback((id: string) => setMenuSetId(id), []);
  const onOpenEffort = useCallback((id: string) => setEffortSetId(id), []);

  if (!we || !sets) return null;
  const ex = exMap.get(we.exerciseId);
  const rest = we.restSeconds ?? defaultRest;
  const done = sets.filter((s) => s.completed).length;
  const menuSet = sets.find((s) => s.id === menuSetId);
  const effortSet = sets.find((s) => s.id === effortSetId);
  const firstWorking = sets.find((s) => s.type !== 'warmup' && s.weight);
  const warmupBase = displayWeight(firstWorking?.weight ?? topSet(last?.sets ?? [])?.weight ?? null, unit);

  return (
    <motion.section
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      aria-label={ex?.name}
      className="surface rounded-3xl p-3"
    >
      <header className="flex items-start gap-2 pb-2 pl-1">
        <button
          type="button"
          onClick={() => openExercise(we.exerciseId)}
          className="min-w-0 flex-1 rounded-lg py-1 text-left"
        >
          <h3 className="flex items-center gap-1.5 truncate text-[17px] leading-tight font-bold text-accent-text">
            {ex?.name ?? 'Unknown exercise'}
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-fg-2">
            {ex ? `${MUSCLE_LABELS[ex.primaryMuscle]} · ${EQUIPMENT_LABELS[ex.equipment]}` : ''}
            {we.targetReps ? ` · Target ${we.targetReps} reps` : ''}
            <span className="tabular">
              {' '}
              · {done}/{sets.length} done
            </span>
          </p>
        </button>
        <button
          type="button"
          onClick={() => setPanel('rest')}
          aria-label={`Rest timer: ${formatRest(rest)}. Change`}
          className="flex min-h-10 items-center gap-1 rounded-xl bg-fill px-2.5 text-[13px] font-semibold text-fg-2 tabular transition-transform active:scale-95"
        >
          <Timer size={15} aria-hidden />
          {formatRest(rest)}
        </button>
        <button
          type="button"
          onClick={() => setPanel('menu')}
          aria-label={`More options for ${ex?.name ?? 'exercise'}`}
          className="grid size-10 place-items-center rounded-xl bg-fill text-fg-2 transition-transform active:scale-90"
        >
          <Ellipsis size={18} aria-hidden />
        </button>
      </header>

      {showNotes && (
        <textarea
          defaultValue={we.notes}
          onBlur={(e) => actions.setExerciseNotes(weId, e.target.value)}
          placeholder="Notes (seat height, grip, cues…)"
          rows={2}
          className="field mb-2 resize-none py-2.5 text-[15px]"
          aria-label="Exercise notes"
        />
      )}

      <div className="space-y-1">
        <AnimatePresence initial={false}>
          {sets.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.18 }}
            >
              <SetRow
                weId={weId}
                set={s}
                label={labels[i]}
                prev={prevSets[i]}
                hint={hints[i]}
                unit={unit}
                effort={effort}
                autoFocus={s.id === focusSetId}
                onOpenMenu={onOpenMenu}
                onOpenEffort={onOpenEffort}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Button
        variant="ghost"
        block
        icon={Plus}
        className="mt-1 text-accent-text"
        onClick={() => setFocusSetId(actions.addSet(weId) ?? null)}
      >
        Add set
      </Button>

      {/* Exercise menu */}
      <Sheet open={panel === 'menu'} onClose={() => setPanel(null)} title={ex?.name ?? 'Exercise'}>
        <ActionList
          items={[
            {
              label: 'Exercise details & history',
              icon: Info,
              onSelect: () => (setPanel(null), openExercise(we.exerciseId)),
            },
            { label: 'Add warm-up sets', icon: Flame, onSelect: () => setPanel('warmup') },
            {
              label: showNotes ? 'Hide notes' : 'Add notes',
              icon: StickyNote,
              onSelect: () => (setShowNotes((v) => !v), setPanel(null)),
            },
            { label: 'Replace exercise', icon: Replace, onSelect: () => setPanel('replace') },
            {
              label: 'Move up',
              icon: ArrowUp,
              disabled: index === 0,
              onSelect: () => (actions.moveExercise(weId, -1), setPanel(null)),
            },
            {
              label: 'Move down',
              icon: ArrowDown,
              disabled: index === total - 1,
              onSelect: () => (actions.moveExercise(weId, 1), setPanel(null)),
            },
            {
              label: 'Remove exercise',
              icon: Trash2,
              destructive: true,
              onSelect: () => (setPanel(null), actions.removeExercise(weId)),
            },
          ]}
        />
      </Sheet>

      {/* Rest presets */}
      <Sheet
        open={panel === 'rest'}
        onClose={() => setPanel(null)}
        title="Rest timer"
        description={`Starts automatically after each completed ${ex?.name ?? ''} set.`}
      >
        <div className="grid grid-cols-2 gap-2 pb-2">
          {[...REST_PRESETS, 45, 150, 240, 300]
            .sort((a, b) => a - b)
            .map((s) => (
              <Button
                key={s}
                variant={rest === s ? 'primary' : 'secondary'}
                size="lg"
                onClick={() => {
                  actions.setRest(weId, s);
                  setPanel(null);
                }}
              >
                {formatRest(s)}
              </Button>
            ))}
        </div>
      </Sheet>

      {/* Warm-up generator */}
      <Sheet
        open={panel === 'warmup'}
        onClose={() => setPanel(null)}
        title="Warm-up sets"
        description="Generated from your first working weight."
      >
        <WarmupPlanner
          initialWeight={warmupBase}
          unit={unit}
          barbell={ex?.equipment === 'barbell'}
          applyLabel="Add to workout"
          onApply={(warmups) => {
            actions.addWarmups(weId, warmups);
            setPanel(null);
          }}
        />
      </Sheet>

      <ExercisePicker
        open={panel === 'replace'}
        onClose={() => setPanel(null)}
        title="Replace exercise"
        onSelect={([id]) => {
          if (id) actions.replaceExercise(weId, id);
          setPanel(null);
        }}
      />

      {/* Set type / delete */}
      <Sheet
        open={Boolean(menuSet)}
        onClose={() => setMenuSetId(null)}
        title={menuSet ? `Set ${labels[sets.indexOf(menuSet)]}` : 'Set'}
      >
        <div role="radiogroup" aria-label="Set type" className="grid grid-cols-2 gap-2">
          {SET_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={menuSet?.type === t}
              onClick={() => {
                if (menuSet) actions.updateSet(weId, menuSet.id, { type: t });
                setMenuSetId(null);
              }}
              className={cn(
                'min-h-14 rounded-2xl text-[15px] font-semibold transition-transform active:scale-95',
                menuSet?.type === t ? 'bg-accent text-accent-fg' : 'bg-fill',
              )}
            >
              {SET_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <Button
          variant="danger"
          block
          icon={Trash2}
          className="mt-4 mb-2"
          feedback="warning"
          onClick={() => {
            if (menuSet) deleteSet(weId, menuSet.id);
            setMenuSetId(null);
          }}
        >
          Delete set
        </Button>
      </Sheet>

      {/* RPE / RIR */}
      <Sheet
        open={Boolean(effortSet)}
        onClose={() => setEffortSetId(null)}
        title={effort === 'rir' ? 'Reps in reserve' : 'Rate of perceived exertion'}
        description={
          effort === 'rir'
            ? 'How many more reps could you have done?'
            : '10 = max effort, 9 = one rep left, 8 = two reps left.'
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {(effort === 'rir' ? RIR_VALUES : RPE_VALUES).map((v) => {
            const current = effort === 'rir' ? effortSet?.rir : effortSet?.rpe;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={current === v}
                onClick={() => {
                  if (effortSet) actions.updateSet(weId, effortSet.id, effort === 'rir' ? { rir: v } : { rpe: v });
                  setEffortSetId(null);
                }}
                className={cn(
                  'min-h-14 rounded-2xl text-lg font-bold tabular transition-transform active:scale-95',
                  current === v ? 'bg-accent text-accent-fg' : 'bg-fill',
                )}
              >
                {effort === 'rir' && v === 5 ? '5+' : v}
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          block
          className="mt-3 mb-1"
          onClick={() => {
            if (effortSet) actions.updateSet(weId, effortSet.id, effort === 'rir' ? { rir: null } : { rpe: null });
            setEffortSetId(null);
          }}
        >
          Clear
        </Button>
      </Sheet>
    </motion.section>
  );
});

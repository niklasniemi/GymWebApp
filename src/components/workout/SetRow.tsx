import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Trophy } from 'lucide-react';
import { haptic } from '../../lib/haptics';
import { PR_LABELS } from '../../lib/history';
import { displayWeight, formatNumber, fromDisplayWeight, weightStep } from '../../lib/units';
import { cn } from '../../lib/utils';
import { useActiveWorkout } from '../../store/workout';
import { useSetPRs } from '../../store/workout';
import type { EffortMetric, PRType, Unit, WorkoutSet } from '../../types';
import { Stepper } from '../ui/Stepper';
import { toggleSetDone } from './actions';

export interface SetRowProps {
  weId: string;
  set: WorkoutSet;
  /** "1", "2", "W", "D", "F" */
  label: string;
  prev?: WorkoutSet;
  /** Earlier set in this session — placeholder fallback when there's no history. */
  hint?: WorkoutSet;
  unit: Unit;
  effort: EffortMetric;
  autoFocus?: boolean;
  onOpenMenu: (setId: string) => void;
  onOpenEffort: (setId: string) => void;
}

const TYPE_STYLES: Record<WorkoutSet['type'], string> = {
  normal: 'bg-fill text-fg',
  warmup: 'bg-gold-soft text-gold',
  drop: 'bg-accent-soft text-accent-text',
  failure: 'bg-danger-soft text-danger',
};

const TYPE_NAMES: Record<WorkoutSet['type'], string> = {
  normal: 'Set',
  warmup: 'Warm-up set',
  drop: 'Drop set',
  failure: 'Failure set',
};

export const SetRow = memo(function SetRow({
  weId,
  set,
  label,
  prev,
  hint,
  unit,
  effort,
  autoFocus,
  onOpenMenu,
  onOpenEffort,
}: SetRowProps) {
  const updateSet = useActiveWorkout((s) => s.updateSet);
  const prKey = useSetPRs(set.id);
  const prs = prKey ? (prKey.split(',') as PRType[]) : [];
  const [editing, setEditing] = useState(false);
  const weightRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && set.weight === null) weightRef.current?.focus();
    // Only on mount of a freshly added set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onWeight = useCallback(
    (v: number | null) => updateSet(weId, set.id, { weight: v === null ? null : fromDisplayWeight(v, unit) }),
    [updateSet, weId, set.id, unit],
  );
  const onReps = useCallback(
    (v: number | null) => updateSet(weId, set.id, { reps: v === null ? null : Math.round(v) }),
    [updateSet, weId, set.id],
  );
  const focusReps = useCallback(() => repsRef.current?.focus(), []);

  const prevWeight = prev ? displayWeight(prev.weight, unit) : null;
  const ghost = prev ?? hint;
  const ghostWeight = ghost ? displayWeight(ghost.weight, unit) : null;
  const prevText = prev ? `${prevWeight ? formatNumber(prevWeight) : 'BW'} × ${prev.reps ?? '–'}` : '—';
  const effortValue = effort === 'rpe' ? set.rpe : effort === 'rir' ? set.rir : null;
  const label_ = `${TYPE_NAMES[set.type]} ${/\d/.test(label) ? label : ''}`.trim();

  const onCheck = () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (set.completed && editing) {
      setEditing(false);
      haptic('tap');
      return;
    }
    const res = toggleSetDone(weId, set.id);
    if (res.status === 'missing-reps') repsRef.current?.focus();
    if (res.status === 'completed') setEditing(false);
  };

  const usePrevious = () => {
    if (!prev) return;
    haptic('select');
    updateSet(weId, set.id, { weight: prev.weight, reps: prev.reps });
  };

  const collapsed = set.completed && !editing;

  return (
    <div className={cn('relative overflow-hidden rounded-2xl transition-transform', collapsed ? 'p-1.5' : 'p-2')}>
      {/* Completed tint lives on its own layer so it fades via opacity only. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 bg-success-soft transition-opacity duration-300',
          set.completed ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div className="relative flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenMenu(set.id)}
          aria-label={`${label_}. Change set type or delete`}
          className={cn(
            'order-1 grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold tabular transition-transform active:scale-90',
            TYPE_STYLES[set.type],
          )}
        >
          {label}
        </button>

        {collapsed ? (
          <button
            type="button"
            onClick={() => {
              haptic('tap');
              setEditing(true);
            }}
            aria-label={`Edit ${label_}`}
            className="order-2 flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg text-left"
          >
            <span className="truncate text-[17px] font-semibold tabular">
              {set.weight ? `${formatNumber(displayWeight(set.weight, unit) ?? 0)} ${unit}` : 'Bodyweight'}
              <span className="text-fg-2"> × </span>
              {set.reps}
            </span>
            {effortValue !== null && (
              <span className="shrink-0 text-xs font-semibold text-fg-2">
                {effort === 'rpe' ? `@${effortValue}` : `${effortValue} RIR`}
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={usePrevious}
            disabled={!prev}
            aria-label={
              prev
                ? `Use previous: ${prevWeight ? `${formatNumber(prevWeight)} ${unit}` : 'bodyweight'} × ${prev.reps ?? 0} reps`
                : 'No previous data'
            }
            className="order-2 flex min-h-10 min-w-0 flex-1 flex-col justify-center rounded-lg px-1 text-left disabled:cursor-default sm:w-24 sm:flex-none"
          >
            <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">Previous</span>
            <span className="truncate text-sm font-semibold text-fg-2 tabular">{prevText}</span>
          </button>
        )}

        {!collapsed && (
          <div className="order-5 flex basis-full gap-2 sm:order-3 sm:flex-1 sm:basis-auto">
            <Stepper
              label={`Weight in ${unit}`}
              value={displayWeight(set.weight, unit)}
              placeholder={ghostWeight}
              onChange={onWeight}
              step={weightStep(unit)}
              max={2000}
              inputRef={weightRef}
              onEnter={focusReps}
              className="min-w-0 flex-1"
            />
            <Stepper
              label="Reps"
              value={set.reps}
              placeholder={ghost?.reps ?? null}
              onChange={onReps}
              step={1}
              max={999}
              decimals={0}
              inputMode="numeric"
              inputRef={repsRef}
              className="min-w-0 flex-1"
            />
          </div>
        )}

        <div className="order-3 flex items-center gap-1.5 sm:order-4">
          <AnimatePresence>
            {prs.length > 0 && (
              <motion.span
                initial={{ scale: 0, rotate: -30, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                className="grid size-8 place-items-center rounded-full bg-gold-soft text-gold"
                role="img"
                aria-label={`Personal record: ${prs.map((p) => PR_LABELS[p]).join(', ')}`}
              >
                <Trophy size={16} strokeWidth={2.5} aria-hidden />
              </motion.span>
            )}
          </AnimatePresence>
          {effort !== 'off' && !collapsed && (
            <button
              type="button"
              onClick={() => onOpenEffort(set.id)}
              aria-label={`${effort.toUpperCase()}: ${effortValue ?? 'not set'}`}
              className={cn(
                'min-h-10 min-w-12 rounded-xl px-2 text-xs font-bold transition-transform active:scale-90',
                effortValue !== null ? 'bg-accent-soft text-accent-text' : 'bg-fill text-muted',
              )}
            >
              {effort === 'rpe' ? 'RPE' : 'RIR'}
              {effortValue !== null && <span className="ml-1 tabular">{effortValue}</span>}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onCheck}
          aria-pressed={set.completed}
          aria-label={set.completed ? (editing ? 'Save changes' : `Mark ${label_} not done`) : `Complete ${label_}`}
          className={cn(
            'relative order-4 grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl transition-transform duration-150 active:scale-90 sm:order-5',
            !set.completed && 'bg-fill text-fg-2',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'absolute inset-0 bg-success transition-opacity duration-200',
              set.completed ? 'opacity-100' : 'opacity-0',
            )}
          />
          <motion.span
            key={set.completed ? 'done' : 'todo'}
            initial={set.completed ? { scale: 0.3, rotate: -45 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 15 }}
            className={cn('relative', set.completed && 'text-white')}
          >
            <Check size={24} strokeWidth={3} aria-hidden />
          </motion.span>
        </button>
      </div>
    </div>
  );
});

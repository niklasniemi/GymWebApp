import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type Ref,
} from 'react';
import { Minus, Plus } from 'lucide-react';
import { haptic } from '../../lib/haptics';
import { inputNumber } from '../../lib/units';
import { clamp, cn, debounce, parseNumber, round } from '../../lib/utils';

export interface StepperProps {
  value: number | null;
  onChange: (value: number | null) => void;
  step: number;
  min?: number;
  max?: number;
  decimals?: number;
  /** Ghost value shown when empty (e.g. last session's number); +/- start from it. */
  placeholder?: number | null;
  /** Accessible name, e.g. "Weight in kg". */
  label: string;
  inputMode?: 'decimal' | 'numeric';
  size?: 'md' | 'lg';
  inputRef?: Ref<HTMLInputElement>;
  onEnter?: () => void;
  className?: string;
  disabled?: boolean;
}

const HOLD_DELAY = 420;
const HOLD_INTERVAL = 85;

/**
 * Gym-optimized number input: 48px +/- targets with press-and-hold repeat,
 * select-all on focus, comma decimals, and debounced commits so typing
 * never re-renders the whole workout per keystroke.
 */
export const Stepper = memo(function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max = 9999,
  decimals = 2,
  placeholder,
  label,
  inputMode = 'decimal',
  size = 'md',
  inputRef,
  onEnter,
  className,
  disabled,
}: StepperProps) {
  const [text, setText] = useState(() => inputNumber(value, decimals));
  const [focused, setFocused] = useState(false);
  const [syncedValue, setSyncedValue] = useState(value);

  // Adopt external value changes (autofill, +/-) unless the user is typing.
  if (!focused && value !== syncedValue) {
    setSyncedValue(value);
    setText(inputNumber(value, decimals));
  }

  const onChangeRef = useRef(onChange);
  const currentRef = useRef(value);
  useEffect(() => {
    onChangeRef.current = onChange;
    currentRef.current = value;
  });

  const commit = useMemo(() => debounce((v: number | null) => onChangeRef.current(v), 300), []);
  useEffect(() => () => commit.flush(), [commit]);

  const holdRef = useRef<{ delay?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});
  const pointerPressRef = useRef(false);

  const bump = (dir: 1 | -1, withHaptic = true) => {
    commit.flush();
    const base = currentRef.current ?? placeholder ?? 0;
    const next = clamp(round(base + dir * step, decimals), min, max);
    currentRef.current = next;
    setText(inputNumber(next, decimals));
    setSyncedValue(next);
    onChangeRef.current(next);
    if (withHaptic) haptic('tap');
  };

  const stopHold = () => {
    clearTimeout(holdRef.current.delay);
    clearInterval(holdRef.current.repeat);
    holdRef.current = {};
  };
  useEffect(() => stopHold, []);

  const pressHandlers = (dir: 1 | -1) => ({
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0 || disabled) return;
      pointerPressRef.current = true;
      bump(dir);
      holdRef.current.delay = setTimeout(() => {
        holdRef.current.repeat = setInterval(() => bump(dir, false), HOLD_INTERVAL);
      }, HOLD_DELAY);
    },
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
    // Keyboard / assistive-tech activation (no pointerdown precedes it).
    onClick: () => {
      if (pointerPressRef.current) {
        pointerPressRef.current = false;
        return;
      }
      bump(dir);
    },
  });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      bump(1, false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      bump(-1, false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit.flush();
      if (onEnter) onEnter();
      else e.currentTarget.blur();
    }
  };

  const btn = cn(
    'grid shrink-0 place-items-center text-fg-2 transition-transform duration-100 active:scale-90 disabled:opacity-40',
    size === 'lg' ? 'w-14' : 'w-12',
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex items-stretch overflow-hidden rounded-xl bg-fill',
        size === 'lg' ? 'h-14' : 'h-12',
        focused && 'ring-2 ring-accent-text',
        className,
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Decrease ${label}`}
        className={btn}
        disabled={disabled}
        {...pressHandlers(-1)}
      >
        <Minus size={size === 'lg' ? 22 : 18} strokeWidth={2.5} aria-hidden />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode={inputMode}
        enterKeyHint={onEnter ? 'next' : 'done'}
        autoComplete="off"
        aria-label={label}
        disabled={disabled}
        value={text}
        placeholder={placeholder != null ? inputNumber(placeholder, decimals) : '–'}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          commit.flush();
          setFocused(false);
          const parsed = parseNumber(text);
          const clean = parsed === null ? null : clamp(round(parsed, decimals), min, max);
          setText(inputNumber(clean, decimals));
          setSyncedValue(clean);
          if (clean !== currentRef.current) onChangeRef.current(clean);
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, '');
          setText(raw);
          const parsed = parseNumber(raw);
          const v = parsed === null ? null : clamp(round(parsed, decimals), min, max);
          currentRef.current = v;
          commit(v);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full min-w-0 flex-1 bg-transparent text-center font-semibold tabular outline-none placeholder:font-medium placeholder:text-muted/70',
          size === 'lg' ? 'text-2xl' : 'text-lg',
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Increase ${label}`}
        className={btn}
        disabled={disabled}
        {...pressHandlers(1)}
      >
        <Plus size={size === 'lg' ? 22 : 18} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
});

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
}

interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** iOS-style segmented control with a spring-animated selection pill. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  const pillId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (v: T) => {
    if (v === value) return;
    haptic('select');
    onChange(v);
  };

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + options.length) % options.length;
    select(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn('relative flex rounded-xl bg-fill p-1', className)}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={opt.ariaLabel}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'relative flex-1 rounded-lg px-2 font-semibold whitespace-nowrap transition-transform active:scale-95',
              size === 'sm' ? 'min-h-9 text-[13px]' : 'min-h-10 text-sm',
              selected ? 'text-fg' : 'text-fg-2',
            )}
          >
            {selected && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-lg bg-surface shadow-sm dark:bg-surface-3"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

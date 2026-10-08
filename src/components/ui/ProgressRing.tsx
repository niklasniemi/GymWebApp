import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface Props {
  /** 0–1 (values above 1 draw an overflow lap in `overColor`). */
  value: number;
  size: number;
  width?: number;
  /** Text-color class for the arc + track, e.g. "text-accent". */
  className?: string;
  overColor?: string;
  children?: ReactNode;
  label?: string;
}

/**
 * Compositor-only progress ring (see `.progress-ring` in index.css): two
 * clipped half-rings rotate on transform. Crossing the halfway point delays
 * the second half so the arc fills continuously.
 */
export function ProgressRing({
  value,
  size,
  width = 10,
  className,
  overColor = 'text-danger',
  children,
  label,
}: Props) {
  const v = Number.isFinite(value) ? Math.max(0, value) : 0;
  const base = Math.min(1, v);
  const over = Math.min(1, Math.max(0, v - 1));
  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <Ring value={base} width={width} track />
      {over > 0 && <Ring value={over} width={width} className={overColor} />}
      {children && <div className="absolute inset-0 grid place-items-center text-center">{children}</div>}
    </div>
  );
}

function Ring({
  value,
  width,
  track,
  className,
}: {
  value: number;
  width: number;
  track?: boolean;
  className?: string;
}) {
  // Remember the previous value to sequence the halves when crossing 50 %.
  const [state, setState] = useState({ value, prev: value });
  if (state.value !== value) setState({ value, prev: state.value });
  const crosses = (state.prev - 0.5) * (value - 0.5) < 0;
  const up = value > state.prev;
  const style = {
    '--ring-w': `${width}px`,
    '--pr-right': `${Math.min(value, 0.5) * 360}deg`,
    '--pr-left': `${Math.max(0, value - 0.5) * 360}deg`,
    '--pr-left-delay': crosses && up ? '0.32s' : '0s',
  } as CSSProperties;
  return (
    <div aria-hidden className={cn('progress-ring', className)} style={style}>
      {track && <span className="pr-track" />}
      <span className="pr-half is-right">
        <span className="pr-arc" style={crosses && !up ? { transitionDelay: '0.32s' } : undefined} />
      </span>
      <span className="pr-half is-left">
        <span className="pr-arc" />
      </span>
    </div>
  );
}

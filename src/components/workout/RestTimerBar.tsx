import { memo, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Pause, Play, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useNow } from '../../hooks/useNow';
import { formatClock, formatRest } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';
import { REST_PRESETS } from '../../store/settings';
import { isTimerActive, useRestTimer } from '../../store/timer';

/** Floating rest timer, docked above the tab bar. Mounted once at the app root. */
export function RestTimerBar() {
  const visible = useRestTimer((s) => isTimerActive(s) || s.finishedAt !== null);
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+5rem)] z-30 mx-auto max-w-md lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96">
      <AnimatePresence>
        {visible && (
          <motion.div
            key="timer"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            className="pointer-events-auto"
          >
            <TimerPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TimerPanel = memo(function TimerPanel() {
  const { endsAt, pausedRemaining, duration, finishedAt, label } = useRestTimer(
    useShallow((s) => ({
      endsAt: s.endsAt,
      pausedRemaining: s.pausedRemaining,
      duration: s.duration,
      finishedAt: s.finishedAt,
      label: s.label,
    })),
  );
  const { adjust, pause, resume, stop, dismiss, start } = useRestTimer.getState();
  const running = endsAt !== null;
  const paused = pausedRemaining !== null;
  const now = useNow(250, running);
  const [expanded, setExpanded] = useState(false);

  // Auto-hide the "done" state after a few seconds.
  useEffect(() => {
    if (finishedAt === null) return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [finishedAt, dismiss]);

  const remainingMs = running ? Math.max(0, endsAt - now) : (pausedRemaining ?? 0);
  const remaining = Math.ceil(remainingMs / 1000);
  const done = finishedAt !== null && !running && !paused;
  const ringKey = `${endsAt ?? 'p'}-${duration}-${paused}`;

  if (done) {
    return (
      <div role="status" className="surface-float flex items-center gap-3 rounded-[22px] p-2 pl-3">
        <motion.div
          initial={{ scale: 0.5, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          className="grid size-11 place-items-center rounded-full bg-success text-white"
        >
          <BellRing size={20} aria-hidden />
        </motion.div>
        <div className="flex-1">
          <p className="font-semibold">Rest complete</p>
          <p className="text-[13px] text-fg-2">Time for your next set</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="grid size-12 place-items-center rounded-full text-fg-2 transition-transform active:scale-90"
        >
          <X size={20} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="surface-float overflow-hidden rounded-[22px]">
      <div className="flex items-center gap-2 p-2 pl-2.5">
        <button
          type="button"
          onClick={() => {
            haptic('select');
            if (paused) resume();
            else pause();
          }}
          aria-label={paused ? 'Resume rest timer' : 'Pause rest timer'}
          className="relative grid size-12 shrink-0 place-items-center text-accent-text transition-transform active:scale-90"
        >
          <Ring key={ringKey} duration={duration} endsAt={endsAt} pausedRemaining={pausedRemaining} />
          {paused ? (
            <Play size={16} fill="currentColor" aria-hidden />
          ) : (
            <Pause size={16} fill="currentColor" aria-hidden />
          )}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="min-w-0 flex-1 rounded-xl py-1 text-left"
        >
          <span className="block truncate text-[11px] font-semibold tracking-wide text-fg-2 uppercase">
            {paused ? 'Paused' : 'Rest'}
            {label ? ` · ${label}` : ''}
          </span>
          <span role="timer" aria-live="off" className="block text-2xl leading-tight font-bold tabular">
            {formatClock(remaining)}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <TimerButton label="Subtract 15 seconds" onClick={() => adjust(-15)}>
            −15
          </TimerButton>
          <TimerButton label="Add 15 seconds" onClick={() => adjust(15)}>
            +15
          </TimerButton>
          <TimerButton label="Skip rest" onClick={stop} className="bg-accent text-accent-fg">
            Skip
          </TimerButton>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex gap-1.5 border-t border-line px-2.5 py-2"
          >
            {REST_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  haptic('select');
                  start(s, label);
                  setExpanded(false);
                }}
                className="min-h-10 flex-1 rounded-xl bg-fill text-sm font-semibold transition-transform active:scale-95"
              >
                {formatRest(s)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

function TimerButton({
  children,
  label,
  onClick,
  className,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className={cn(
        'min-h-12 min-w-12 rounded-xl bg-fill px-2 text-sm font-bold tabular transition-transform active:scale-90',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Progress ring rendered by CSS keyframes on two rotating half-arcs. The
 * animation is started once per countdown with a negative delay equal to the
 * elapsed time, so it runs on the compositor with zero per-frame JS.
 */
function Ring({
  duration,
  endsAt,
  pausedRemaining,
}: {
  duration: number;
  endsAt: number | null;
  pausedRemaining: number | null;
}) {
  // Freeze the starting offset for this countdown segment (the parent re-keys
  // on start/pause/resume/adjust). Read the wall clock here rather than a
  // ticking prop, which is stale right after resuming from pause.
  const [start] = useState(() => {
    const remainingMs = endsAt !== null ? endsAt - Date.now() : (pausedRemaining ?? 0);
    return Math.min(Math.max(duration - remainingMs / 1000, 0), duration);
  });
  return (
    <span
      aria-hidden
      className="timer-ring absolute inset-0"
      data-paused={pausedRemaining !== null}
      style={
        {
          '--ring-w': '4px',
          '--ring-duration': `${Math.max(duration, 0.001)}s`,
          '--ring-delay': `${-start}s`,
        } as CSSProperties
      }
    >
      <span className="timer-ring-track" />
      <span className="timer-ring-half is-right">
        <span className="timer-ring-arc" />
      </span>
      <span className="timer-ring-half is-left">
        <span className="timer-ring-arc" />
      </span>
    </span>
  );
}

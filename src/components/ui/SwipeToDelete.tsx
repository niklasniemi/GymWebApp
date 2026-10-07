import { useRef, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

const ACTION_WIDTH = 88;
const SPRING = { type: 'spring', stiffness: 520, damping: 42 } as const;

interface Props {
  children: ReactNode;
  onDelete: () => void;
  /** Accessible name of the revealed button, e.g. "Delete set 2". */
  label: string;
  className?: string;
  disabled?: boolean;
}

/**
 * iOS-style swipe-to-delete. Drag left to reveal a red Delete action that
 * slides in from the right edge; a long swipe deletes straight away.
 * Transform-only: the red panel shares the row's x motion value, so it sits
 * flush against the row's right edge and never overlaps translucent content.
 * Keyboard / screen-reader users delete via the set menu instead.
 */
export function SwipeToDelete({ children, onDelete, label, className, disabled }: Props) {
  const x = useMotionValue(0);
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const dragged = useRef(false);
  const crossed = useRef(false);

  const settle = (to: number) => {
    void animate(x, to, SPRING);
    setOpen(to !== 0);
  };

  const remove = () => {
    haptic('warning');
    const width = ref.current?.offsetWidth ?? 400;
    void animate(x, -width, { duration: 0.16, ease: 'easeIn' }).then(onDelete);
  };

  const onDrag = (_: unknown, info: PanInfo) => {
    // Tick once when passing the "release to delete" threshold.
    const width = ref.current?.offsetWidth ?? 400;
    const past = info.offset.x < -width * 0.5;
    if (past !== crossed.current) {
      crossed.current = past;
      haptic('select');
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const width = ref.current?.offsetWidth ?? 400;
    crossed.current = false;
    // Delete on a long swipe, or a fast flick that has also travelled past the action.
    const flick = info.velocity.x < -1100 && info.offset.x < -ACTION_WIDTH * 1.5;
    if (info.offset.x < -width * 0.5 || flick) remove();
    else if (x.get() < -ACTION_WIDTH / 2) settle(-ACTION_WIDTH);
    else settle(0);
    // The click that follows pointerup must not toggle buttons under the finger.
    setTimeout(() => {
      dragged.current = false;
    }, 0);
  };

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      <motion.div style={{ x }} className="absolute inset-y-0 left-full flex w-full bg-danger" aria-hidden={!open}>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          aria-label={label}
          onClick={remove}
          className="flex h-full flex-col items-center justify-center gap-0.5 text-xs font-semibold text-white"
          style={{ width: ACTION_WIDTH }}
        >
          <Trash2 size={20} aria-hidden />
          Delete
        </button>
      </motion.div>
      <motion.div
        style={{ x }}
        drag={disabled ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ right: 0 }}
        dragElastic={{ right: 0 }}
        dragMomentum={false}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onClickCapture={(e) => {
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
          } else if (open) {
            // Tapping an opened row closes it instead of acting.
            e.stopPropagation();
            e.preventDefault();
            settle(0);
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

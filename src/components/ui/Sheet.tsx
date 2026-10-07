import { useId, useRef, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/utils';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional element rendered left of the close button. */
  headerAction?: ReactNode;
  /** Non-scrolling content under the header (search, filters). */
  toolbar?: ReactNode;
  /** 'full' for pickers/editors that need a fixed tall viewport. */
  size?: 'auto' | 'full';
  /** Body without horizontal padding (for edge-to-edge lists). */
  flush?: boolean;
  className?: string;
}

/**
 * Responsive modal surface: a drag-to-dismiss bottom sheet on phones, a
 * fade/scale dialog on wider screens. Animates only transform + opacity.
 */
export function Sheet(props: SheetProps) {
  return createPortal(
    <AnimatePresence>{props.open && <SheetPanel key="sheet" {...props} />}</AnimatePresence>,
    document.body,
  );
}

const SPRING = { type: 'spring', damping: 36, stiffness: 420, mass: 0.9 } as const;
const FADE = { duration: 0.18, ease: [0.22, 1, 0.36, 1] } as const;

function SheetPanel({
  onClose,
  title,
  description,
  children,
  footer,
  headerAction,
  toolbar,
  size = 'auto',
  flush,
  className,
}: SheetProps) {
  const desktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const dragControls = useDragControls();
  useDialog(panelRef, onClose);

  const startDrag = (e: PointerEvent) => {
    if (desktop) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    dragControls.start(e);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        aria-hidden
        className="absolute inset-0 touch-none bg-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={FADE}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'surface-sheet relative flex w-full flex-col overflow-hidden rounded-t-[28px] outline-none',
          'sm:max-w-lg sm:rounded-[28px]',
          size === 'full' ? 'h-[92dvh] sm:h-[min(86dvh,780px)]' : 'max-h-[92dvh] sm:max-h-[86dvh]',
          className,
        )}
        initial={desktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        animate={desktop ? { opacity: 1, scale: 1 } : { y: 0 }}
        exit={desktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        transition={desktop ? FADE : SPRING}
        drag={desktop ? false : 'y'}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
      >
        <div onPointerDown={startDrag} className="shrink-0 touch-none select-none">
          {!desktop && (
            <div className="flex justify-center pt-2.5 pb-1" aria-hidden>
              <div className="h-1.5 w-10 rounded-full bg-fg/20" />
            </div>
          )}
          <div className="flex items-start gap-2 px-5 pt-2 pb-3 sm:pt-5">
            <div className="min-w-0 flex-1 pt-1.5">
              <h2 id={titleId} className="text-lg leading-tight font-bold tracking-tight">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-fg-2">
                  {description}
                </p>
              )}
            </div>
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-fg-2 transition-transform active:scale-90"
            >
              <X size={18} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </div>
        {toolbar && <div className="shrink-0 pb-3">{toolbar}</div>}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain',
            !flush && 'px-5',
            !footer && 'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}

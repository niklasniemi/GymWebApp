import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, CircleCheck, Info, Trophy, X } from 'lucide-react';
import { PR_LABELS } from '../../lib/history';
import { cn } from '../../lib/utils';
import { useToasts, type Toast } from '../../store/toast';

/** Top-anchored toast stack. Announced politely to screen readers. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const ICONS = { default: Info, success: CircleCheck, error: CircleAlert, pr: Trophy };
const ICON_TONES = {
  default: 'text-accent-text',
  success: 'text-success-text',
  error: 'text-danger',
  pr: 'text-gold',
};

const ToastItem = memo(function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  const Icon = ICONS[toast.tone];
  const isPR = toast.tone === 'pr';
  return (
    <motion.div
      layout
      role={toast.tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: -24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
      className={cn(
        'surface-float pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl p-3.5',
      )}
    >
      {isPR && <Burst />}
      <motion.div
        className={cn(
          'relative grid size-9 shrink-0 place-items-center rounded-xl',
          isPR ? 'bg-gold-soft' : 'bg-fill',
          ICON_TONES[toast.tone],
        )}
        initial={isPR ? { scale: 0.4, rotate: -25 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 12, delay: 0.05 }}
      >
        <Icon size={20} strokeWidth={2.25} aria-hidden />
      </motion.div>
      <div className="relative min-w-0 flex-1 pt-0.5">
        <p className="text-[15px] leading-snug font-semibold">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-[13px] text-fg-2">{toast.description}</p>}
        {toast.prs && toast.prs.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {toast.prs.map((p) => (
              <span key={p} className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-gold">
                {PR_LABELS[p]}
              </span>
            ))}
          </div>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              dismiss(toast.id);
            }}
            className="mt-2 min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg transition-transform active:scale-95"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="relative -m-1 grid size-9 shrink-0 place-items-center rounded-full text-muted transition-transform active:scale-90"
      >
        <X size={16} aria-hidden />
      </button>
    </motion.div>
  );
});

const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const dist = 38 + (i % 3) * 14;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    color: ['var(--gold)', 'var(--chart-1)', 'var(--chart-2)', 'var(--success)'][i % 4],
    size: 4 + (i % 3),
  };
});

/** Celebratory particle burst — transform/opacity only. */
function Burst() {
  return (
    <div aria-hidden className="pointer-events-none absolute top-[34px] left-[34px]">
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        />
      ))}
    </div>
  );
}

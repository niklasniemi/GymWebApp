import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Unit } from '../../types';
import { plateStyle } from './plateStyles';

/** One loaded sleeve, collar → outward. Plates spring in/out with transforms only. */
export const Barbell = memo(function Barbell({ stack, unit }: { stack: number[]; unit: Unit }) {
  return (
    <div
      role="img"
      aria-label={stack.length ? `Plates per side: ${stack.join(', ')} ${unit}` : 'Empty bar'}
      className="relative flex h-40 items-center overflow-x-auto overflow-y-hidden no-scrollbar"
    >
      {/* Shaft + collar */}
      <div aria-hidden className="h-3 w-12 shrink-0 rounded-l-full bg-gradient-to-b from-zinc-300 to-zinc-500" />
      <div aria-hidden className="h-9 w-2.5 shrink-0 rounded-sm bg-gradient-to-b from-zinc-300 to-zinc-500" />
      <div className="relative flex items-center">
        {/* Sleeve */}
        <div
          aria-hidden
          className="absolute top-1/2 left-0 h-5 -translate-y-1/2 rounded-r-md bg-gradient-to-b from-zinc-200 to-zinc-400"
          style={{ width: Math.max(140, stack.reduce((a, p) => a + plateStyle(p, unit).w + 2, 0) + 28) }}
        />
        <AnimatePresence initial={false} mode="popLayout">
          {stack.map((p, i) => {
            const s = plateStyle(p, unit);
            return (
              <motion.div
                key={`${i}-${p}`}
                layout
                initial={{ opacity: 0, x: 40, scaleY: 0.6 }}
                animate={{ opacity: 1, x: 0, scaleY: 1 }}
                exit={{ opacity: 0, x: 30, scaleY: 0.6 }}
                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                className="relative mr-0.5 shrink-0 rounded-[5px]"
                style={{
                  height: s.h,
                  width: s.w,
                  background: `linear-gradient(90deg, rgb(255 255 255 / 0.18), transparent 40%, rgb(0 0 0 / 0.18)), ${s.color}`,
                  boxShadow: s.light ? 'inset 0 0 0 1px rgb(0 0 0 / 0.18)' : undefined,
                }}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
});

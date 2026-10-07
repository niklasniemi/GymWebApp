import { memo } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useFavorites } from '../../store/favorites';

/** Star toggle for an exercise. */
export const FavoriteButton = memo(function FavoriteButton({
  exerciseId,
  name,
  className,
  size = 'md',
}: {
  exerciseId: string;
  name: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const on = useFavorites((s) => s.ids.includes(exerciseId));
  const toggle = useFavorites((s) => s.toggle);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
      onClick={(e) => {
        e.stopPropagation();
        toggle(exerciseId);
      }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full transition-transform active:scale-90',
        size === 'sm' ? 'size-10' : 'size-11',
        on ? 'text-gold' : 'text-muted',
        className,
      )}
    >
      <motion.span
        key={on ? 'on' : 'off'}
        initial={on ? { scale: 0.4, rotate: -40 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 14 }}
        className="grid place-items-center"
      >
        <Star size={size === 'sm' ? 18 : 20} strokeWidth={2} fill={on ? 'currentColor' : 'none'} aria-hidden />
      </motion.span>
    </button>
  );
});

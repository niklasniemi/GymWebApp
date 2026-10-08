import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  ChartNoAxesCombined,
  CircleUserRound,
  ClipboardList,
  Dumbbell,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';
import { useActiveWorkout } from '../../store/workout';
import { navigate, useRoute, type Tab } from '../../store/ui';

const ITEMS: { tab: Tab; label: string; icon: LucideIcon }[] = [
  { tab: 'workout', label: 'Workout', icon: Dumbbell },
  { tab: 'routines', label: 'Routines', icon: ClipboardList },
  { tab: 'food', label: 'Food', icon: UtensilsCrossed },
  { tab: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { tab: 'profile', label: 'Profile', icon: CircleUserRound },
];

/** Floating bottom tab bar on phones; vertical rail on large screens. */
export const BottomNav = memo(function BottomNav() {
  const route = useRoute();
  const inWorkout = useActiveWorkout((s) => s.workout !== null);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'surface-bar fixed z-40 rounded-[26px] p-1.5',
        'inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] mx-auto max-w-md',
        'lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-5 lg:w-[88px] lg:-translate-y-1/2',
      )}
    >
      <ul className="flex lg:flex-col lg:gap-1">
        {ITEMS.map(({ tab, label, icon: Icon }) => {
          // Tools (Utilities) live under Profile now.
          const active = route === tab || (route === 'utilities' && tab === 'profile');
          return (
            <li key={tab} className="flex-1">
              <a
                href={`#/${tab}`}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  if (!active) haptic('select');
                  navigate(tab);
                }}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[20px] transition-transform duration-150 active:scale-90 lg:min-h-[68px]',
                  active ? 'text-accent-text' : 'text-fg-2',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-[20px] bg-accent-soft"
                    transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                  />
                )}
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {tab === 'workout' && inWorkout && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-1 size-2.5 rounded-full border-2 border-[var(--surface)] bg-success"
                    />
                  )}
                </span>
                <span className="relative text-[11px] font-semibold tracking-tight">
                  {label}
                  {tab === 'workout' && inWorkout && <span className="sr-only"> (in progress)</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});

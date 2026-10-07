import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { haptic } from '../lib/haptics';
import { playChime } from '../lib/sound';
import { safeLocalStorage } from './storage';

interface RestTimerState {
  /** Wall-clock end; null when idle or paused. Timestamps keep it accurate in background tabs. */
  endsAt: number | null;
  /** Total length of the current countdown in seconds (drives the ring). */
  duration: number;
  /** Remaining ms while paused. */
  pausedRemaining: number | null;
  /** Set when a countdown completes, until dismissed. */
  finishedAt: number | null;
  label: string | null;
  start: (seconds: number, label?: string | null) => void;
  adjust: (deltaSeconds: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  dismiss: () => void;
}

let timeout: ReturnType<typeof setTimeout> | undefined;

function schedule() {
  if (timeout) clearTimeout(timeout);
  timeout = undefined;
  const { endsAt } = useRestTimer.getState();
  if (endsAt === null) return;
  const ms = endsAt - Date.now();
  if (ms <= 0) {
    complete();
    return;
  }
  timeout = setTimeout(complete, ms);
}

function complete() {
  const { endsAt } = useRestTimer.getState();
  if (endsAt === null) return;
  // Only alert if we actually reached the end recently (not on a stale reload).
  const stale = Date.now() - endsAt > 30_000;
  useRestTimer.setState({ endsAt: null, pausedRemaining: null, finishedAt: stale ? null : Date.now() });
  if (!stale) {
    haptic('timer');
    playChime('timer');
  }
}

export const useRestTimer = create<RestTimerState>()(
  persist(
    (set, get) => ({
      endsAt: null,
      duration: 0,
      pausedRemaining: null,
      finishedAt: null,
      label: null,

      start: (seconds, label = null) => {
        set({ endsAt: Date.now() + seconds * 1000, duration: seconds, pausedRemaining: null, finishedAt: null, label });
        schedule();
      },

      adjust: (delta) => {
        const { endsAt, pausedRemaining, duration } = get();
        if (pausedRemaining !== null) {
          const next = Math.max(0, pausedRemaining + delta * 1000);
          set({ pausedRemaining: next, duration: Math.max(1, duration + delta) });
          return;
        }
        if (endsAt === null) return;
        const remaining = endsAt - Date.now() + delta * 1000;
        if (remaining <= 0) {
          get().stop();
          return;
        }
        set({ endsAt: Date.now() + remaining, duration: Math.max(1, duration + delta) });
        schedule();
      },

      pause: () => {
        const { endsAt } = get();
        if (endsAt === null) return;
        set({ endsAt: null, pausedRemaining: Math.max(0, endsAt - Date.now()) });
        schedule();
      },

      resume: () => {
        const { pausedRemaining } = get();
        if (pausedRemaining === null) return;
        set({ endsAt: Date.now() + pausedRemaining, pausedRemaining: null });
        schedule();
      },

      stop: () => {
        set({ endsAt: null, pausedRemaining: null, finishedAt: null });
        schedule();
      },

      dismiss: () => set({ finishedAt: null }),
    }),
    {
      name: 'forge:rest-timer',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ endsAt, duration, pausedRemaining, label }) => ({ endsAt, duration, pausedRemaining, label }),
      onRehydrateStorage: () => () => {
        // Defer so the store is fully hydrated before we read it.
        queueMicrotask(schedule);
      },
    },
  ),
);

export const isTimerActive = (s: Pick<RestTimerState, 'endsAt' | 'pausedRemaining'>) =>
  s.endsAt !== null || s.pausedRemaining !== null;

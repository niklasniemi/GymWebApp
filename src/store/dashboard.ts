import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeLocalStorage } from './storage';

export type BoardId = 'workout' | 'analytics';

interface DashboardState {
  /** Ordered widget ids per board; absent = use the board's defaults. */
  layouts: Partial<Record<BoardId, string[]>>;
  setLayout: (board: BoardId, ids: string[]) => void;
  reset: (board: BoardId) => void;
}

/** User-customised widget layouts for the Workout and Analytics pages. */
export const useDashboard = create<DashboardState>()(
  persist(
    (set, get) => ({
      layouts: {},
      setLayout: (board, ids) => set({ layouts: { ...get().layouts, [board]: ids } }),
      reset: (board) => {
        const { [board]: _removed, ...rest } = get().layouts;
        set({ layouts: rest });
      },
    }),
    {
      name: 'forge:dashboard',
      version: 3,
      // v2 introduced the momentum fire and weekly-goal widgets, v3 nutrition (and tools, since
      // Utilities left the tab bar) — surface them in saved layouts.
      migrate: (persisted, version) => {
        const state = (persisted ?? { layouts: {} }) as Pick<DashboardState, 'layouts'>;
        const insertAfter = (ids: string[] | undefined, after: string, id: string) => {
          if (!ids || ids.includes(id)) return ids;
          const i = ids.indexOf(after);
          return [...ids.slice(0, i + 1), id, ...ids.slice(i + 1)];
        };
        if (version < 2) {
          state.layouts = {
            ...state.layouts,
            workout: insertAfter(state.layouts.workout, 'quickStart', 'fire'),
            analytics: insertAfter(insertAfter(state.layouts.analytics, 'stats', 'goalWeeks'), 'goalWeeks', 'momentum'),
          };
        }
        if (version < 3) {
          const workout = insertAfter(state.layouts.workout, 'fire', 'nutrition');
          const withTools = workout && !workout.includes('tools') ? [...workout, 'tools'] : workout;
          state.layouts = {
            ...state.layouts,
            workout: withTools,
            analytics: insertAfter(insertAfter(state.layouts.analytics, 'momentum', 'calories'), 'calories', 'macros'),
          };
        }
        return state as DashboardState;
      },
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ layouts }) => ({ layouts }),
    },
  ),
);

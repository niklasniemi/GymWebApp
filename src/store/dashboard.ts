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
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ layouts }) => ({ layouts }),
    },
  ),
);

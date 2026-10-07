import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_KG_PLATES, DEFAULT_LB_PLATES } from '../lib/calc';
import type { Unit } from '../types';
import { safeLocalStorage } from './storage';

interface ToolsState {
  unit: Unit | null;
  bar: Record<Unit, number>;
  plates: Record<Unit, number[]>;
  target: Record<Unit, number>;
  set: (patch: Partial<Omit<ToolsState, 'set'>>) => void;
}

/** Remembered plate-calculator preferences (per unit). */
export const useTools = create<ToolsState>()(
  persist(
    (set) => ({
      unit: null,
      bar: { kg: 20, lb: 45 },
      plates: { kg: DEFAULT_KG_PLATES, lb: DEFAULT_LB_PLATES },
      target: { kg: 100, lb: 225 },
      set: (patch) => set(patch),
    }),
    {
      name: 'forge:tools',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ set: _s, ...rest }) => rest,
    },
  ),
);

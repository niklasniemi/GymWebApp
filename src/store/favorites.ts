import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { haptic } from '../lib/haptics';
import { safeLocalStorage } from './storage';

interface FavoritesState {
  ids: string[];
  toggle: (id: string) => void;
  replace: (ids: string[]) => void;
}

/** Starred exercises — surfaced first in pickers, the library and analytics. */
export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const on = get().ids.includes(id);
        haptic(on ? 'tap' : 'success');
        set({ ids: on ? get().ids.filter((x) => x !== id) : [...get().ids, id] });
      },
      replace: (ids) => set({ ids: [...new Set(ids)] }),
    }),
    {
      name: 'forge:favorites',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ ids }) => ({ ids }),
    },
  ),
);

const setCache = new WeakMap<string[], Set<string>>();

/** Stable Set view of the favourites for O(1) lookups in lists. */
export function useFavoriteSet(): Set<string> {
  const ids = useFavorites((s) => s.ids);
  let set = setCache.get(ids);
  if (!set) {
    set = new Set(ids);
    setCache.set(ids, set);
  }
  return set;
}

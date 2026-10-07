import type { StateStorage } from 'zustand/middleware';

const memory = new Map<string, string>();

/**
 * localStorage that never throws (Safari private mode, quota, disabled
 * storage) and degrades to in-memory storage instead.
 */
export const safeLocalStorage: StateStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

const flushers = new Set<() => void>();

if (typeof window !== 'undefined') {
  const flushAll = () => flushers.forEach((f) => f());
  // pagehide + visibilitychange are the last reliable moments on mobile.
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });
}

/**
 * Debounced localStorage writer for hot state (the active workout). Writes
 * coalesce while the user is typing and are flushed synchronously when the
 * tab is hidden or closed, so progress survives refreshes and app switches.
 */
export function createDebouncedStorage(wait = 250): StateStorage {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    pending.forEach((value, key) => safeLocalStorage.setItem(key, value));
    pending.clear();
  };
  flushers.add(flush);
  return {
    getItem: (key) => pending.get(key) ?? safeLocalStorage.getItem(key),
    setItem: (key, value) => {
      pending.set(key, value);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, wait);
    },
    removeItem: (key) => {
      pending.delete(key);
      safeLocalStorage.removeItem(key);
    },
  };
}

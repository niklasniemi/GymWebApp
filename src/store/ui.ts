import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Hash router — GitHub Pages has no SPA rewrites, so hash URLs are the
// zero-config way to get deep links and a working back button.
// ---------------------------------------------------------------------------

export const TABS = ['workout', 'routines', 'analytics', 'utilities', 'settings'] as const;
export type Tab = (typeof TABS)[number];

function parseHash(): Tab {
  const seg = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (TABS as readonly string[]).includes(seg) ? (seg as Tab) : 'workout';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Tab {
  return useSyncExternalStore(subscribe, parseHash, () => 'workout');
}

export function navigate(tab: Tab) {
  if (parseHash() !== tab || !window.location.hash) window.location.hash = `/${tab}`;
}

// ---------------------------------------------------------------------------
// Global overlays
// ---------------------------------------------------------------------------

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface UIState {
  exerciseDetailId: string | null;
  openExercise: (id: string) => void;
  closeExercise: () => void;
  confirmRequest: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
}

export const useUI = create<UIState>()((set) => ({
  exerciseDetailId: null,
  openExercise: (id) => set({ exerciseDetailId: id }),
  closeExercise: () => set({ exerciseDetailId: null }),
  confirmRequest: null,
}));

/** Promise-based confirm dialog: `if (await confirm({...})) …` */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useUI.getState().confirmRequest?.resolve(false);
    useUI.setState({
      confirmRequest: {
        ...opts,
        resolve: (ok) => {
          useUI.setState({ confirmRequest: null });
          resolve(ok);
        },
      },
    });
  });
}

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Hash router — GitHub Pages has no SPA rewrites, so hash URLs are the
// zero-config way to get deep links and a working back button.
// ---------------------------------------------------------------------------

export const TABS = ['workout', 'routines', 'food', 'analytics', 'profile', 'utilities'] as const;
export type Tab = (typeof TABS)[number];

/** `#/tab/sub/param` → segments (decoded). Legacy `#/settings` maps to `#/profile/settings`. */
export function parseSegments(hash: string): string[] {
  const segs = rawSegments(hash);
  return segs[0] === 'settings' ? ['profile', 'settings', ...segs.slice(1)] : segs;
}

function rawSegments(hash: string): string[] {
  return hash
    .replace(/^#\/?/, '')
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

function parseTab(): Tab {
  const seg = parseSegments(window.location.hash)[0] ?? '';
  return (TABS as readonly string[]).includes(seg) ? (seg as Tab) : 'workout';
}

// Cached so useSyncExternalStore gets a stable snapshot between hash changes.
let subCache: { hash: string; value: readonly [string | undefined, string | undefined] } | null = null;
function parseSub() {
  const hash = window.location.hash;
  if (subCache?.hash !== hash) {
    const [, sub, param] = parseSegments(hash);
    subCache = { hash, value: [sub, param] as const };
  }
  return subCache.value;
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

const EMPTY_SUB = [undefined, undefined] as const;

export function useRoute(): Tab {
  return useSyncExternalStore(subscribe, parseTab, () => 'workout');
}

/** Sub-route within the current tab, e.g. ['strength', 'bench-press']. */
export function useSubRoute(): readonly [string | undefined, string | undefined] {
  return useSyncExternalStore(subscribe, parseSub, () => EMPTY_SUB);
}

export function routeHref(tab: Tab, sub?: string, param?: string): string {
  return `#/${[tab, sub, param]
    .filter(Boolean)
    .map((s) => encodeURIComponent(s as string))
    .join('/')}`;
}

/**
 * Navigates to a tab (and optional sub-route). `replace` swaps the history
 * entry — used for in-page segment switches so Back leaves the tab.
 */
export function navigate(tab: Tab, sub?: string, param?: string, opts: { replace?: boolean } = {}) {
  const href = routeHref(tab, sub, param);
  if (window.location.hash === href) return;
  if (opts.replace) {
    window.history.replaceState(null, '', href);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = href.slice(1);
  }
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
  routineDetailId: string | null;
  openRoutine: (id: string) => void;
  closeRoutine: () => void;
  /** null = closed; { id: null } = creating a new routine. */
  routineEditor: { id: string | null } | null;
  editRoutine: (id: string | null) => void;
  closeRoutineEditor: () => void;
  confirmRequest: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
}

export const useUI = create<UIState>()((set) => ({
  exerciseDetailId: null,
  openExercise: (id) => set({ exerciseDetailId: id }),
  closeExercise: () => set({ exerciseDetailId: null }),
  routineDetailId: null,
  openRoutine: (id) => set({ routineDetailId: id }),
  closeRoutine: () => set({ routineDetailId: null }),
  routineEditor: null,
  editRoutine: (id) => set({ routineEditor: { id }, routineDetailId: null }),
  closeRoutineEditor: () => set({ routineEditor: null }),
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

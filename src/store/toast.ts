import { create } from 'zustand';
import type { PRType } from '../types';
import { uid } from '../lib/utils';

export type ToastTone = 'default' | 'success' | 'error' | 'pr';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  prs?: PRType[];
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'duration' | 'tone'> & { tone?: ToastTone; duration?: number }) => string;
  dismiss: (id: string) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = uid();
    const toast: Toast = { tone: 'default', duration: 3200, ...t, id };
    // Keep the stack short so it never covers the workout.
    set({ toasts: [...get().toasts.slice(-2), toast] });
    if (toast.duration > 0) {
      timers.set(
        id,
        setTimeout(() => get().dismiss(id), toast.duration),
      );
    }
    return id;
  },
  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  show: (title: string, description?: string) => useToasts.getState().push({ title, description }),
  success: (title: string, description?: string) => useToasts.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) =>
    useToasts.getState().push({ title, description, tone: 'error', duration: 5000 }),
  pr: (title: string, prs: PRType[], description?: string) =>
    useToasts.getState().push({ title, description, prs, tone: 'pr', duration: 4200 }),
  action: (title: string, action: Toast['action'], description?: string) =>
    useToasts.getState().push({ title, description, action, duration: 0 }),
  undo: (title: string, onUndo: () => void, description?: string) =>
    useToasts.getState().push({ title, description, action: { label: 'Undo', onClick: onUndo }, duration: 5000 }),
};

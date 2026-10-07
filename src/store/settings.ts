import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Settings } from '../types';
import { safeLocalStorage } from './storage';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  glass: true,
  autoPowerSaver: true,
  unit: 'kg',
  defaultRest: 90,
  autoStartRest: true,
  effortMetric: 'rpe',
  haptics: true,
  sound: true,
  keepAwake: true,
};

export const REST_PRESETS = [60, 90, 120, 180] as const;

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'forge:settings',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ update: _u, reset: _r, ...settings }) => settings,
    },
  ),
);

/** Keeps only valid, known settings from untrusted input (e.g. an imported backup). */
export function sanitizeSettings(raw: Partial<Record<keyof Settings, unknown>>): Partial<Settings> {
  const out: Partial<Settings> = {};
  const bool = (k: 'glass' | 'autoPowerSaver' | 'autoStartRest' | 'haptics' | 'sound' | 'keepAwake') => {
    if (typeof raw[k] === 'boolean') out[k] = raw[k] as boolean;
  };
  if (raw.theme === 'system' || raw.theme === 'light' || raw.theme === 'dark') out.theme = raw.theme;
  if (raw.unit === 'kg' || raw.unit === 'lb') out.unit = raw.unit;
  if (raw.effortMetric === 'rpe' || raw.effortMetric === 'rir' || raw.effortMetric === 'off')
    out.effortMetric = raw.effortMetric;
  if (typeof raw.defaultRest === 'number' && raw.defaultRest >= 10 && raw.defaultRest <= 900)
    out.defaultRest = raw.defaultRest;
  (['glass', 'autoPowerSaver', 'autoStartRest', 'haptics', 'sound', 'keepAwake'] as const).forEach(bool);
  return out;
}

export function getSettings(): Settings {
  const { update: _u, reset: _r, ...settings } = useSettings.getState();
  return settings;
}

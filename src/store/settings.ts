import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ACCENTS, type AccentId, type Settings } from '../types';
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
  // No Vibration API (iPhone) → default to audible "haptic" clicks instead.
  hapticSound: typeof navigator !== 'undefined' && typeof navigator.vibrate !== 'function',
  sound: true,
  keepAwake: true,
  accent: 'blue',
  weeklyGoal: 3,
  name: '',
};

export const ACCENT_OPTIONS: { id: AccentId; label: string; swatch: string }[] = [
  { id: 'blue', label: 'Blue', swatch: '#256abf' },
  { id: 'violet', label: 'Violet', swatch: '#6a45d1' },
  { id: 'teal', label: 'Teal', swatch: '#0e7781' },
  { id: 'green', label: 'Green', swatch: '#1d7a39' },
  { id: 'orange', label: 'Orange', swatch: '#c2410c' },
  { id: 'pink', label: 'Pink', swatch: '#be2f69' },
  { id: 'red', label: 'Red', swatch: '#c22a2a' },
  { id: 'graphite', label: 'Graphite', swatch: '#3d3d45' },
];

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
      version: 2,
      // v1 → v2 adds accent, weekly goal, haptic sounds and profile name.
      migrate: (persisted) => ({ ...DEFAULT_SETTINGS, ...(persisted as Partial<Settings>) }),
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: ({ update: _u, reset: _r, ...settings }) => settings,
    },
  ),
);

/** Keeps only valid, known settings from untrusted input (e.g. an imported backup). */
export function sanitizeSettings(raw: Partial<Record<keyof Settings, unknown>>): Partial<Settings> {
  const out: Partial<Settings> = {};
  const bool = (
    k: 'glass' | 'autoPowerSaver' | 'autoStartRest' | 'haptics' | 'hapticSound' | 'sound' | 'keepAwake',
  ) => {
    if (typeof raw[k] === 'boolean') out[k] = raw[k] as boolean;
  };
  if (raw.theme === 'system' || raw.theme === 'light' || raw.theme === 'dark') out.theme = raw.theme;
  if (raw.unit === 'kg' || raw.unit === 'lb') out.unit = raw.unit;
  if (raw.effortMetric === 'rpe' || raw.effortMetric === 'rir' || raw.effortMetric === 'off')
    out.effortMetric = raw.effortMetric;
  if (typeof raw.defaultRest === 'number' && raw.defaultRest >= 10 && raw.defaultRest <= 900)
    out.defaultRest = raw.defaultRest;
  (['glass', 'autoPowerSaver', 'autoStartRest', 'haptics', 'hapticSound', 'sound', 'keepAwake'] as const).forEach(bool);
  if (ACCENTS.includes(raw.accent as AccentId)) out.accent = raw.accent as AccentId;
  if (typeof raw.weeklyGoal === 'number' && raw.weeklyGoal >= 1 && raw.weeklyGoal <= 14)
    out.weeklyGoal = Math.round(raw.weeklyGoal);
  if (typeof raw.name === 'string') out.name = raw.name.slice(0, 40);
  return out;
}

export function getSettings(): Settings {
  const { update: _u, reset: _r, ...settings } = useSettings.getState();
  return settings;
}

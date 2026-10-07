import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  Check,
  Vibrate,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Monitor,
  Moon,
  Share,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../components/ui/Button';
import { Card, PageHeader, SectionTitle } from '../components/ui/primitives';
import { Segmented } from '../components/ui/Segmented';
import { Sheet } from '../components/ui/Sheet';
import { SwitchRow } from '../components/ui/Switch';
import { usePowerSaver } from '../hooks/useAppearance';
import { formatRest, pluralize } from '../lib/format';
import { haptic } from '../lib/haptics';
import {
  createBackup,
  datedFilename,
  deliverFile,
  ImportError,
  parseBackup,
  workoutsFromCSV,
  workoutsToCSV,
} from '../lib/io';
import { promptInstall, usePWA } from '../lib/pwa';
import { playChime, playHapticSound } from '../lib/sound';
import { getExerciseMap, getSnapshot, useData, type ImportMode } from '../store/data';
import { useFavorites } from '../store/favorites';
import { ACCENT_OPTIONS, getSettings, REST_PRESETS, sanitizeSettings, useSettings } from '../store/settings';
import { cn } from '../lib/utils';
import type { AccentId } from '../types';
import { toast } from '../store/toast';
import { confirm, navigate } from '../store/ui';
import type { DataSnapshot, Settings } from '../types';

const STORAGE_LABELS = {
  indexeddb: 'IndexedDB',
  localstorage: 'localStorage (fallback)',
  memory: 'memory only — data will not persist',
};

export default function SettingsPage() {
  const s = useSettings();
  const powerSaver = usePowerSaver();
  const vibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  return (
    <div className="space-y-6 pb-6">
      <button
        type="button"
        onClick={() => navigate('profile')}
        className="-mb-4 -ml-2 flex min-h-11 items-center gap-1 rounded-xl px-2 pt-4 text-sm font-semibold text-accent-text"
      >
        <ArrowLeft size={18} aria-hidden /> Profile
      </button>
      <PageHeader title="Settings" subtitle="Preferences" />

      <section aria-labelledby="appearance">
        <SectionTitle>
          <span id="appearance">Appearance</span>
        </SectionTitle>
        <Card className="space-y-1">
          <div className="pb-2">
            <p className="mb-2 text-[15px] font-medium">Theme</p>
            <Segmented
              label="Theme"
              value={s.theme}
              onChange={(theme) => s.update({ theme })}
              options={[
                {
                  value: 'system',
                  label: <IconLabel icon={<Monitor size={15} />}>Auto</IconLabel>,
                  ariaLabel: 'System',
                },
                { value: 'light', label: <IconLabel icon={<Sun size={15} />}>Light</IconLabel>, ariaLabel: 'Light' },
                { value: 'dark', label: <IconLabel icon={<Moon size={15} />}>Dark</IconLabel>, ariaLabel: 'Dark' },
              ]}
            />
          </div>
          <div className="pb-2">
            <p className="mb-2 text-[15px] font-medium">Accent colour</p>
            <AccentPicker value={s.accent} onChange={(accent) => s.update({ accent })} />
          </div>
          <SwitchRow
            checked={s.glass}
            onChange={(glass) => s.update({ glass })}
            label="Liquid Glass"
            description="Translucent, blurred surfaces inspired by iOS and visionOS."
          />
          <SwitchRow
            checked={s.autoPowerSaver}
            onChange={(autoPowerSaver) => s.update({ autoPowerSaver })}
            disabled={!s.glass}
            label="Battery saver"
            description={
              s.glass && s.autoPowerSaver && powerSaver
                ? 'Active now — using solid surfaces to save power.'
                : 'Switch to solid surfaces on low battery, Save-Data, or Reduce Transparency.'
            }
          />
        </Card>
      </section>

      <section aria-labelledby="training">
        <SectionTitle>
          <span id="training">Training</span>
        </SectionTitle>
        <Card className="space-y-4">
          <SettingBlock label="Weekly workout goal">
            <Segmented
              label="Weekly workout goal"
              value={s.weeklyGoal}
              onChange={(weeklyGoal) => s.update({ weeklyGoal })}
              options={[1, 2, 3, 4, 5, 6, 7].map((v) => ({ value: v, label: `${v}×`, ariaLabel: `${v} per week` }))}
            />
            <p className="mt-1.5 px-1 text-xs text-fg-2">
              Your fire burns at full heat when you hit this; the streak only counts weeks that reach it.
            </p>
          </SettingBlock>
          <SettingBlock label="Units">
            <Segmented
              label="Units"
              value={s.unit}
              onChange={(unit) => s.update({ unit })}
              options={[
                { value: 'kg', label: 'Kilograms (kg)' },
                { value: 'lb', label: 'Pounds (lb)' },
              ]}
            />
          </SettingBlock>
          <SettingBlock label="Default rest timer">
            <Segmented
              label="Default rest timer"
              value={s.defaultRest}
              onChange={(defaultRest) => s.update({ defaultRest })}
              options={REST_PRESETS.map((v) => ({ value: v, label: formatRest(v) }))}
            />
          </SettingBlock>
          <SettingBlock label="Effort tracking">
            <Segmented
              label="Effort tracking"
              value={s.effortMetric}
              onChange={(effortMetric) => s.update({ effortMetric })}
              options={[
                { value: 'rpe', label: 'RPE' },
                { value: 'rir', label: 'RIR' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </SettingBlock>
          <div>
            <SwitchRow
              checked={s.autoStartRest}
              onChange={(autoStartRest) => s.update({ autoStartRest })}
              label="Auto-start rest timer"
              description="Starts when you complete a set."
            />
            <SwitchRow
              checked={s.keepAwake}
              onChange={(keepAwake) => s.update({ keepAwake })}
              disabled={!wakeLockSupported}
              label="Keep screen awake"
              description={wakeLockSupported ? 'During an active workout.' : 'Not supported in this browser.'}
            />
          </div>
        </Card>
      </section>

      <section aria-labelledby="feedback">
        <SectionTitle>
          <span id="feedback">Feedback</span>
        </SectionTitle>
        <Card>
          <SwitchRow
            checked={s.haptics}
            onChange={(haptics) => {
              s.update({ haptics });
              if (haptics) haptic('success');
            }}
            label="Haptics"
            description={
              vibrationSupported
                ? 'Vibration for completed sets, timers and PRs.'
                : 'Uses system haptics where available (iOS 18+).'
            }
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SwitchRow
                checked={s.hapticSound}
                onChange={(hapticSound) => {
                  s.update({ hapticSound });
                  if (hapticSound) playHapticSound('success');
                }}
                label="Haptic sounds"
                description={
                  vibrationSupported
                    ? 'Soft clicks alongside vibration.'
                    : 'Soft clicks and thuds stand in for vibration — iPhone web apps can’t vibrate. Muted by the silent switch.'
                }
              />
            </div>
            <Button size="sm" variant="secondary" icon={Vibrate} onClick={() => playHapticSound('pr')}>
              Test
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SwitchRow
                checked={s.sound}
                onChange={(sound) => s.update({ sound })}
                label="Sounds"
                description="Chime when rest is over or you hit a PR."
              />
            </div>
            <Button size="sm" variant="secondary" icon={Volume2} onClick={() => playChime('timer', true)}>
              Test
            </Button>
          </div>
        </Card>
      </section>

      <DataSection />
      <AppSection />
    </div>
  );
}

function AccentPicker({ value, onChange }: { value: AccentId; onChange: (a: AccentId) => void }) {
  return (
    <div role="radiogroup" aria-label="Accent colour" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {ACCENT_OPTIONS.map((a) => {
        const selected = a.id === value;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={a.label}
            onClick={() => {
              haptic('select');
              onChange(a.id);
            }}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition-transform active:scale-95',
              selected ? 'bg-fill-strong text-fg' : 'text-fg-2',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'grid size-8 place-items-center rounded-full text-white shadow-sm',
                selected && 'ring-2 ring-fg ring-offset-2 ring-offset-[var(--surface)]',
              )}
              style={{ background: a.swatch }}
            >
              {selected && <Check size={16} strokeWidth={3} />}
            </span>
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

function IconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

function SettingBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[15px] font-medium">{label}</p>
      {children}
    </div>
  );
}

interface PendingImport {
  kind: 'json' | 'csv';
  fileName: string;
  data: DataSnapshot;
  settings?: Partial<Settings>;
  favorites?: string[];
}

function DataSection() {
  const storage = useData((s) => s.storage);
  const persisted = useData((s) => s.persisted);
  const counts = useData(useShallow((s) => ({ w: s.workouts.length, r: s.routines.length, m: s.measurements.length })));
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [busy, setBusy] = useState(false);

  const exportJSON = async () => {
    const backup = createBackup(getSnapshot(), getSettings(), useFavorites.getState().ids);
    const res = await deliverFile(
      datedFilename('forge-backup', 'json'),
      JSON.stringify(backup, null, 2),
      'application/json',
    );
    if (res !== 'cancelled') toast.success('Backup exported', `${pluralize(backup.workouts.length, 'workout')} saved.`);
  };

  const exportCSV = async () => {
    const { workouts, exercises } = useData.getState();
    if (!workouts.length) {
      toast.show('Nothing to export yet', 'Finish a workout first.');
      return;
    }
    const csv = workoutsToCSV(workouts, getExerciseMap(exercises));
    const res = await deliverFile(datedFilename('forge-workouts', 'csv'), csv, 'text/csv');
    if (res !== 'cancelled') toast.success('CSV exported', 'One row per set — opens in any spreadsheet.');
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const isCSV = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');
      if (isCSV) {
        setPending({ kind: 'csv', fileName: file.name, data: workoutsFromCSV(text, useData.getState().exercises) });
      } else {
        const { data, settings, favorites } = parseBackup(text);
        setPending({ kind: 'json', fileName: file.name, data, settings, favorites });
      }
    } catch (err) {
      haptic('warning');
      toast.error('Import failed', err instanceof ImportError ? err.message : 'The file could not be read.');
    }
  };

  const runImport = async (mode: ImportMode) => {
    if (!pending) return;
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace all data?',
        message: 'Everything currently on this device is overwritten by the backup. This cannot be undone.',
        confirmLabel: 'Replace',
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await useData.getState().importData(pending.data, mode);
      if (pending.settings) useSettings.getState().update(sanitizeSettings(pending.settings));
      if (pending.favorites) {
        const fav = useFavorites.getState();
        fav.replace(mode === 'replace' ? pending.favorites : [...fav.ids, ...pending.favorites]);
      }
      haptic('success');
      toast.success('Import complete', `${pluralize(pending.data.workouts.length, 'workout')} imported.`);
      setPending(null);
    } catch (err) {
      console.error(err);
      toast.error('Import failed', 'Your data was not changed.');
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Delete all data?',
      message:
        'Workouts, routines, custom exercises and measurements will be permanently erased from this device. Export a backup first if you might need it.',
      confirmLabel: 'Delete everything',
      destructive: true,
    });
    if (!ok) return;
    await useData.getState().clearAll();
    toast.show('All data deleted');
  };

  return (
    <section aria-labelledby="data">
      <SectionTitle>
        <span id="data">Data & backup</span>
      </SectionTitle>
      <Card className="space-y-4">
        <div className="flex gap-3 rounded-2xl bg-fill p-3">
          <Database size={20} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">Stored on this device</p>
            <p className="text-fg-2">
              {storage ? STORAGE_LABELS[storage] : 'Loading…'} · {pluralize(counts.w, 'workout')},{' '}
              {pluralize(counts.r, 'routine')}, {pluralize(counts.m, 'measurement')}
            </p>
            {persisted && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success-text">
                <ShieldCheck size={13} aria-hidden /> Protected from automatic eviction
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button icon={FileJson} onClick={exportJSON}>
            Export backup (JSON)
          </Button>
          <Button icon={FileSpreadsheet} onClick={exportCSV}>
            Export workouts (CSV)
          </Button>
          <Button icon={Upload} className="sm:col-span-2" onClick={() => fileRef.current?.click()}>
            Import JSON or CSV
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          onChange={onFile}
          className="hidden"
          aria-hidden
          tabIndex={-1}
        />
        <p className="text-xs text-muted">
          Move data between devices: export here, then import on the other device. Nothing ever leaves your device
          otherwise.
        </p>
        <Button variant="danger" block icon={Trash2} feedback="warning" onClick={clearAll}>
          Delete all data
        </Button>
      </Card>

      <Sheet
        open={pending !== null}
        onClose={() => !busy && setPending(null)}
        title="Import data"
        description={pending?.fileName}
        footer={
          <div className="flex gap-2">
            {pending?.kind === 'json' && (
              <Button variant="danger" block disabled={busy} onClick={() => runImport('replace')}>
                Replace all
              </Button>
            )}
            <Button variant="primary" block disabled={busy} feedback="success" onClick={() => runImport('merge')}>
              Merge
            </Button>
          </div>
        }
      >
        {pending && (
          <div className="space-y-3 pb-2 text-sm">
            <ul className="grid grid-cols-2 gap-2">
              {[
                ['Workouts', pending.data.workouts.length],
                ['Routines', pending.data.routines.length],
                ['Custom exercises', pending.data.exercises.length],
                ['Measurements', pending.data.measurements.length],
              ].map(([label, n]) => (
                <li key={label} className="rounded-2xl bg-fill p-3">
                  <p className="text-xs font-semibold text-fg-2 uppercase">{label}</p>
                  <p className="text-xl font-bold tabular">{n}</p>
                </li>
              ))}
            </ul>
            <p className="text-fg-2">
              <strong className="text-fg">Merge</strong> adds new items and updates matching ones.
              {pending.kind === 'json' && (
                <>
                  {' '}
                  <strong className="text-fg">Replace all</strong> wipes this device first.
                </>
              )}
            </p>
          </div>
        )}
      </Sheet>
    </section>
  );
}

function AppSection() {
  const { canInstall, offlineReady, standalone, iosInstallable } = usePWA();
  return (
    <section aria-labelledby="app">
      <SectionTitle>
        <span id="app">App</span>
      </SectionTitle>
      <Card className="space-y-3">
        {canInstall && (
          <Button variant="primary" block icon={Download} onClick={() => promptInstall()}>
            Install Forge
          </Button>
        )}
        {iosInstallable && (
          <p className="flex gap-2 rounded-2xl bg-fill p-3 text-sm text-fg-2">
            <Share size={18} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
            <span>
              Install on iPhone: tap <strong className="text-fg">Share</strong>, then{' '}
              <strong className="text-fg">Add to Home Screen</strong> for full-screen, offline use.
            </span>
          </p>
        )}
        <ul className="space-y-1.5 text-sm text-fg-2">
          <li className="flex items-center gap-2">
            <Smartphone size={16} aria-hidden /> {standalone ? 'Running as an installed app' : 'Running in the browser'}
          </li>
          <li className="flex items-center gap-2">
            <WifiOff size={16} aria-hidden />{' '}
            {offlineReady ? 'Ready to work offline' : 'Offline support activates after first load'}
          </li>
        </ul>
        <p className="text-xs text-muted">
          Forge v{__APP_VERSION__} · Runs entirely on your device. No account, no tracking.
        </p>
        <p className="text-xs text-muted">
          3D body model:{' '}
          <a
            className="underline"
            href="https://sketchfab.com/3d-models/human-body-f022e4a3641943328b2fbfdf0f7c3e1e"
            target="_blank"
            rel="noreferrer"
          >
            “HUMAN_BODY”
          </a>{' '}
          by{' '}
          <a className="underline" href="https://sketchfab.com/vistaalienprime5665288" target="_blank" rel="noreferrer">
            vistaalienprime
          </a>
          , licensed{' '}
          <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          . Optimised and segmented into muscle regions for this app.
        </p>
      </Card>
    </section>
  );
}

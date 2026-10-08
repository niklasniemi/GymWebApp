import { useId, useState, type FormEvent } from 'react';
import { ChevronDown, CircleAlert } from 'lucide-react';
import { combineDateTime, toDateInput, toTimeInput } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import {
  distanceUnit,
  formatDistance,
  formatPace,
  fromDisplayDistance,
  isRun,
  newRunRecords,
  paceSeconds,
  RUN_TYPE_LABELS,
  runCalories,
  runNameForTime,
  toDisplayDistance,
  type RunWorkout,
} from '../../lib/running';
import { cn, parseNumber, round, uid } from '../../lib/utils';
import { useData } from '../../store/data';
import { useTargets } from '../../store/nutrition';
import { useSettings } from '../../store/settings';
import { toast, useToasts } from '../../store/toast';
import { RUN_TYPES, type RunType } from '../../types';
import { Button } from '../ui/Button';
import { Chip, Field, TextInput } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';

const KM_CHIPS = [3, 5, 10, 21.1];
const MI_CHIPS = [1, 3.1, 5, 6.2, 13.1];
const EFFORTS = [
  { value: 3, label: 'Easy' },
  { value: 5, label: 'Steady' },
  { value: 7, label: 'Hard' },
  { value: 9, label: 'All-out' },
];

/** Log a past run, or edit one (`run` set). */
export function RunSheet({ open, onClose, run }: { open: boolean; onClose: () => void; run?: RunWorkout | null }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={run ? 'Edit run' : 'Log a run'}
      description={run ? undefined : 'Enter it from your watch or running app.'}
      size="full"
    >
      {open && <RunForm key={run?.id ?? 'new'} run={run ?? undefined} onDone={onClose} />}
    </Sheet>
  );
}

export function RunForm({ run, onDone }: { run?: RunWorkout; onDone: () => void }) {
  const unit = useSettings((s) => s.unit);
  const { weightKg } = useTargets();
  const ids = { date: useId(), time: useId(), name: useId(), h: useId(), elev: useId(), hr: useId(), notes: useId() };
  const [now] = useState(() => Date.now());
  const initialStart = run?.startedAt ?? now - 60 * 60_000;
  const initialDur = run?.run.duration ?? 0;

  const [type, setType] = useState<RunType>(run?.run.type ?? 'outdoor');
  const [distance, setDistance] = useState<number | null>(
    run ? round(toDisplayDistance(run.run.distance, unit), 2) : null,
  );
  const [h, setH] = useState(initialDur >= 3600 ? String(Math.floor(initialDur / 3600)) : '');
  const [m, setM] = useState(initialDur ? String(Math.floor((initialDur % 3600) / 60)) : '');
  const [s, setS] = useState(initialDur ? String(Math.round(initialDur % 60)).padStart(2, '0') : '');
  const [date, setDate] = useState(() => toDateInput(initialStart));
  const [time, setTime] = useState(() => toTimeInput(initialStart));
  const [name, setName] = useState(run?.name ?? '');
  const [rpe, setRpe] = useState<number | undefined>(run?.run.rpe);
  const [elevation, setElevation] = useState(
    run?.run.elevation !== undefined
      ? String(Math.round(unit === 'kg' ? run.run.elevation : run.run.elevation / 0.3048))
      : '',
  );
  const [hr, setHr] = useState(run?.run.avgHr !== undefined ? String(run.run.avgHr) : '');
  const [notes, setNotes] = useState(run?.notes ?? '');
  const [more, setMore] = useState(Boolean(run && (run.run.elevation || run.run.avgHr || run.notes)));

  const duration = (parseNumber(h) ?? 0) * 3600 + (parseNumber(m) ?? 0) * 60 + (parseNumber(s) ?? 0);
  const meters = distance ? fromDisplayDistance(distance, unit) : 0;
  const start = combineDateTime(date, time);
  const pace = meters > 0 && duration > 0 ? paceSeconds({ distance: meters, duration }, unit) : 0;
  const secPerKm = meters > 0 ? duration / (meters / 1000) : 0;
  const elevM = parseNumber(elevation);
  const hrN = parseNumber(hr);
  const data = {
    type,
    distance: Math.round(meters),
    duration: Math.round(duration),
    elevation: elevM !== null && elevM > 0 ? Math.round(unit === 'kg' ? elevM : elevM * 0.3048) : undefined,
    avgHr: hrN !== null && hrN > 30 && hrN < 250 ? Math.round(hrN) : undefined,
    rpe,
  };

  const error =
    start > now + 60_000
      ? 'The start time is in the future.'
      : duration > 0 && duration > 24 * 3600
        ? 'That is longer than a day — check the time.'
        : null;
  const warning =
    secPerKm > 0 && secPerKm < 150
      ? 'That pace is faster than world-record speed — check distance and time.'
      : secPerKm > 1200
        ? 'That is slower than 20 min/km — more of a walk?'
        : null;
  const valid = meters > 0 && duration > 0 && !error;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) {
      haptic('warning');
      return;
    }
    const workout: RunWorkout = {
      id: run?.id ?? uid(),
      name: name.trim() || (run && run.name !== runNameForTime(run.startedAt) ? run.name : runNameForTime(start)),
      startedAt: start,
      endedAt: start + data.duration * 1000,
      exercises: [],
      notes: notes.trim() || undefined,
      run: data,
    };
    const { workouts, saveWorkout } = useData.getState();
    const earlier = workouts.filter((w): w is RunWorkout => isRun(w) && w.id !== workout.id && w.startedAt <= start);
    saveWorkout(workout);
    const records = run ? [] : newRunRecords(workout, earlier);
    const summary = `${formatDistance(workout.run.distance, unit)} · ${formatPace(pace, unit)}`;
    if (records.length) {
      haptic('pr');
      useToasts.getState().push({ title: records.join(' · '), description: summary, tone: 'pr', duration: 4500 });
    } else {
      haptic('success');
      toast.success(run ? 'Run updated' : 'Run logged', summary);
    }
    onDone();
  };

  const timeInput = (id: string, value: string, set: (v: string) => void, label: string, max: number) => (
    <label htmlFor={id} className="field flex cursor-text items-center gap-1 focus-within:border-accent-text">
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder="0"
        aria-label={label}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2);
          set(v && Number(v) > max ? String(max) : v);
        }}
        className="w-full min-w-0 bg-transparent text-center text-xl font-semibold tabular outline-none placeholder:text-muted/60"
      />
      <span className="shrink-0 text-xs font-semibold text-muted">{label.slice(0, label === 'minutes' ? 3 : 1)}</span>
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-5 pb-4">
      <Segmented
        label="Run type"
        value={type}
        onChange={setType}
        options={RUN_TYPES.map((t) => ({ value: t, label: RUN_TYPE_LABELS[t] }))}
      />

      <div className="space-y-2">
        <p className="px-1 text-[13px] font-semibold text-fg-2">Distance ({distanceUnit(unit)})</p>
        <Stepper
          size="lg"
          value={distance}
          onChange={setDistance}
          step={0.5}
          min={0}
          max={unit === 'kg' ? 300 : 200}
          decimals={2}
          label={`Distance in ${distanceUnit(unit) === 'km' ? 'kilometres' : 'miles'}`}
        />
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Common distances">
          {(unit === 'kg' ? KM_CHIPS : MI_CHIPS).map((d) => (
            <Chip key={d} selected={distance === d} onClick={() => setDistance(d)}>
              {d === 21.1 || d === 13.1 ? 'Half' : `${d} ${distanceUnit(unit)}`}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[13px] font-semibold text-fg-2" id={ids.h}>
          Time
        </p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby={ids.h}>
          {timeInput(`${ids.h}-h`, h, setH, 'hours', 23)}
          {timeInput(`${ids.h}-m`, m, setM, 'minutes', 59)}
          {timeInput(`${ids.h}-s`, s, setS, 'seconds', 59)}
        </div>
      </div>

      <div className="surface grid grid-cols-3 gap-2 rounded-2xl p-4 text-center" aria-live="polite">
        <div>
          <p className="text-xs font-semibold text-fg-2">Pace</p>
          <p className="text-lg font-bold tabular">{pace ? formatPace(pace, unit, false) : '–'}</p>
          <p className="text-[11px] text-muted">/{distanceUnit(unit)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-fg-2">Speed</p>
          <p className="text-lg font-bold tabular">
            {duration > 0 && meters > 0 ? round(toDisplayDistance(meters, unit) / (duration / 3600), 1) : '–'}
          </p>
          <p className="text-[11px] text-muted">{unit === 'kg' ? 'km/h' : 'mph'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-fg-2">Energy</p>
          <p className="text-lg font-bold tabular">{meters > 0 ? runCalories(data, weightKg) : '–'}</p>
          <p className="text-[11px] text-muted">kcal est.</p>
        </div>
      </div>
      {warning && <p className="px-1 text-sm text-warning">{warning}</p>}

      <div className="space-y-2">
        <p className="px-1 text-[13px] font-semibold text-fg-2">How did it feel?</p>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Effort">
          {EFFORTS.map((e) => (
            <Chip
              key={e.value}
              selected={rpe === e.value}
              onClick={() => setRpe(rpe === e.value ? undefined : e.value)}
              className="justify-center"
            >
              {e.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor={ids.date}>
          <input
            id={ids.date}
            type="date"
            value={date}
            max={toDateInput(now)}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="field"
          />
        </Field>
        <Field label="Started" htmlFor={ids.time}>
          <input
            id={ids.time}
            type="time"
            value={time}
            onChange={(e) => e.target.value && setTime(e.target.value)}
            className="field"
          />
        </Field>
      </div>

      <button
        type="button"
        aria-expanded={more}
        onClick={() => setMore((v) => !v)}
        className="flex min-h-11 w-full items-center gap-1.5 px-1 text-sm font-semibold text-accent-text"
      >
        More details
        <ChevronDown size={16} aria-hidden className={cn('transition-transform', more && 'rotate-180')} />
      </button>
      {more && (
        <div className="space-y-4">
          <Field label="Name" htmlFor={ids.name}>
            <TextInput
              id={ids.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={runNameForTime(start)}
              maxLength={80}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Elevation gain (${unit === 'kg' ? 'm' : 'ft'})`} htmlFor={ids.elev}>
              <TextInput
                id={ids.elev}
                inputMode="numeric"
                value={elevation}
                onChange={(e) => setElevation(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="optional"
              />
            </Field>
            <Field label="Avg heart rate" htmlFor={ids.hr}>
              <TextInput
                id={ids.hr}
                inputMode="numeric"
                value={hr}
                onChange={(e) => setHr(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="bpm"
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor={ids.notes}>
            <textarea
              id={ids.notes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Route, weather, how the legs felt…"
              className="field py-3 text-[16px]"
            />
          </Field>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 px-1 text-sm font-medium text-danger">
          <CircleAlert size={15} aria-hidden /> {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" block disabled={!valid} feedback={false}>
        {run ? 'Save run' : 'Log run'}
        {valid ? ` · ${formatDistance(data.distance, unit)}` : ''}
      </Button>
    </form>
  );
}

import { useId, useState, type FormEvent } from 'react';
import { ArrowLeft, ChevronDown, CircleAlert, Footprints } from 'lucide-react';
import { activityCalories, SPORT_INFO, type ActivityWorkout } from '../../lib/activities';
import { combineDateTime, toDateInput, toTimeInput } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { distanceUnit, fromDisplayDistance, toDisplayDistance } from '../../lib/running';
import { cn, parseNumber, round, uid } from '../../lib/utils';
import { useData } from '../../store/data';
import { useTargets } from '../../store/nutrition';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { SPORTS, type Sport } from '../../types';
import { RunForm } from '../running/RunSheet';
import { Button } from '../ui/Button';
import { Chip, Field, TextInput } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { SportIcon } from './SportIcon';

const DURATIONS = [30, 45, 60, 90, 120];
const EFFORTS = [
  { value: 3, label: 'Easy' },
  { value: 5, label: 'Steady' },
  { value: 7, label: 'Hard' },
  { value: 9, label: 'All-out' },
];

type Pick = Sport | 'running';

/**
 * Log any session afterwards: pick a sport (running opens the run form with
 * distance & pace), or edit an existing activity (`activity` set).
 */
export function ActivitySheet({
  open,
  onClose,
  activity,
}: {
  open: boolean;
  onClose: () => void;
  activity?: ActivityWorkout | null;
}) {
  const [picked, setPicked] = useState<Pick | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPicked(activity ? activity.activity.sport : null);
  }
  const editing = Boolean(activity);
  const title = editing
    ? 'Edit activity'
    : picked === null
      ? 'Log an activity'
      : picked === 'running'
        ? 'Log a run'
        : `Log ${SPORT_INFO[picked].label.toLowerCase()}`;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={picked === null ? 'Sports and sessions you did outside the gym.' : undefined}
      size="full"
      leading={
        picked !== null && !editing ? (
          <button
            type="button"
            onClick={() => setPicked(null)}
            aria-label="Back to activities"
            className="grid size-10 shrink-0 place-items-center rounded-full text-fg-2 transition-transform active:scale-90 hover:bg-fill"
          >
            <ArrowLeft size={20} strokeWidth={2.5} aria-hidden />
          </button>
        ) : undefined
      }
    >
      {open && picked === null && <SportPicker onPick={setPicked} />}
      {open && picked === 'running' && <RunForm onDone={onClose} />}
      {open && picked !== null && picked !== 'running' && (
        <ActivityForm
          key={activity?.id ?? picked}
          sport={picked}
          activity={activity ?? undefined}
          onSport={setPicked}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function SportPicker({ onPick }: { onPick: (p: Pick) => void }) {
  const tile =
    'flex size-full min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-fill px-1 text-center text-[13px] font-semibold leading-tight transition-transform active:scale-95';
  return (
    <ul className="grid grid-cols-3 gap-2 pb-4" aria-label="Activities">
      <li>
        <button
          type="button"
          className={cn(tile, 'bg-accent-soft text-accent-text')}
          onClick={() => {
            haptic('select');
            onPick('running');
          }}
        >
          <Footprints size={24} aria-hidden />
          Running
        </button>
      </li>
      {SPORTS.map((sport) => (
        <li key={sport}>
          <button
            type="button"
            className={tile}
            onClick={() => {
              haptic('select');
              onPick(sport);
            }}
          >
            <SportIcon sport={sport} size={24} className="text-accent-text" aria-hidden />
            {SPORT_INFO[sport].label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function ActivityForm({
  sport,
  activity,
  onSport,
  onDone,
}: {
  sport: Sport;
  activity?: ActivityWorkout;
  onSport: (s: Sport) => void;
  onDone: () => void;
}) {
  const unit = useSettings((s) => s.unit);
  const { weightKg } = useTargets();
  const ids = { date: useId(), time: useId(), name: useId(), dur: useId(), dist: useId(), hr: useId(), notes: useId() };
  const [now] = useState(() => Date.now());
  const a = activity?.activity;
  const initialStart = activity?.startedAt ?? now - 90 * 60_000;
  const initialDur = a?.duration ?? 3600;

  const [h, setH] = useState(String(Math.floor(initialDur / 3600)));
  const [m, setM] = useState(String(Math.round((initialDur % 3600) / 60)));
  const [date, setDate] = useState(() => toDateInput(initialStart));
  const [time, setTime] = useState(() => toTimeInput(initialStart));
  const [rpe, setRpe] = useState<number | undefined>(a?.rpe);
  const [distance, setDistance] = useState(a?.distance ? String(round(toDisplayDistance(a.distance, unit), 2)) : '');
  const [hr, setHr] = useState(a?.avgHr !== undefined ? String(a.avgHr) : '');
  const [name, setName] = useState(activity?.name ?? '');
  const [notes, setNotes] = useState(activity?.notes ?? '');
  const [more, setMore] = useState(Boolean(activity && (a?.avgHr || activity.notes)));

  const info = SPORT_INFO[sport];
  const duration = (parseNumber(h) ?? 0) * 3600 + (parseNumber(m) ?? 0) * 60;
  const start = combineDateTime(date, time);
  const dist = parseNumber(distance);
  const hrN = parseNumber(hr);
  const data = {
    sport,
    duration: Math.round(duration),
    distance: info.distance && dist && dist > 0 ? Math.round(fromDisplayDistance(dist, unit)) : undefined,
    avgHr: hrN !== null && hrN > 30 && hrN < 250 ? Math.round(hrN) : undefined,
    rpe,
  };
  const error =
    start > now + 60_000
      ? 'The start time is in the future.'
      : duration > 16 * 3600
        ? 'That is longer than 16 hours — check the time.'
        : null;
  const valid = duration > 0 && !error;
  const minutes = Math.round(duration / 60);

  const setMinutes = (total: number) => {
    haptic('select');
    setH(String(Math.floor(total / 60)));
    setM(String(total % 60));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) {
      haptic('warning');
      return;
    }
    const keepName = activity && activity.name !== SPORT_INFO[activity.activity.sport].label;
    const workout: ActivityWorkout = {
      id: activity?.id ?? uid(),
      name: name.trim() || (keepName ? activity!.name : info.label),
      startedAt: start,
      endedAt: start + data.duration * 1000,
      exercises: [],
      notes: notes.trim() || undefined,
      activity: data,
    };
    useData.getState().saveWorkout(workout);
    haptic('success');
    toast.success(
      activity ? 'Activity updated' : `${info.label} logged`,
      `${minutes} min · ≈ ${activityCalories(data, weightKg)} kcal`,
    );
    onDone();
  };

  const numberBox = (id: string, value: string, set: (v: string) => void, label: string, max: number) => (
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
      <span className="shrink-0 text-xs font-semibold text-muted">{label === 'hours' ? 'h' : 'min'}</span>
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-5 pb-4">
      <div className="flex items-center gap-3 rounded-2xl bg-accent-soft p-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-accent-text">
          <SportIcon sport={sport} size={24} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{info.label}</span>
          <span className="block text-xs text-fg-2">
            ≈ {activityCalories(data, weightKg)} kcal · counts toward your weekly goal
          </span>
        </span>
        {activity && (
          <select
            aria-label="Change activity"
            value={sport}
            onChange={(e) => onSport(e.target.value as Sport)}
            className="max-w-28 rounded-lg bg-surface px-2 py-1.5 text-sm font-semibold"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {SPORT_INFO[s].label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        <p className="px-1 text-[13px] font-semibold text-fg-2" id={ids.dur}>
          Duration
        </p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby={ids.dur}>
          {numberBox(`${ids.dur}-h`, h, setH, 'hours', 16)}
          {numberBox(`${ids.dur}-m`, m, setM, 'minutes', 59)}
        </div>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Common durations">
          {DURATIONS.map((d) => (
            <Chip key={d} selected={minutes === d} onClick={() => setMinutes(d)}>
              {d < 60 ? `${d} min` : `${d / 60} h`.replace('1.5 h', '1½ h')}
            </Chip>
          ))}
        </div>
      </div>

      {info.distance && (
        <Field label={`Distance (${distanceUnit(unit)}, optional)`} htmlFor={ids.dist}>
          <TextInput
            id={ids.dist}
            inputMode="decimal"
            value={distance}
            onChange={(e) => setDistance(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
            placeholder="0"
          />
        </Field>
      )}

      <div className="space-y-2">
        <p className="px-1 text-[13px] font-semibold text-fg-2">How hard was it?</p>
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
              placeholder={info.label}
              maxLength={80}
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
          <Field label="Notes" htmlFor={ids.notes}>
            <textarea
              id={ids.notes}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Opponent, score, how it felt…"
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
        {activity ? 'Save activity' : `Log ${info.label.toLowerCase()}`}
        {valid ? ` · ${minutes} min` : ''}
      </Button>
    </form>
  );
}

import { useId, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { combineDateTime, formatDuration, toDateInput, toTimeInput } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';
import { useData } from '../../store/data';
import { Button } from '../ui/Button';
import { Field, Select, TextInput } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';

export interface WorkoutTimeValues {
  start: number;
  end?: number;
  name?: string;
  routineId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  start: number;
  /** End time; omit for an in-progress workout (start only). */
  end?: number;
  /** Show a name field with this initial value. */
  name?: string;
  /** Offer starting from a routine (logging a past workout). */
  withRoutine?: boolean;
  submitLabel: string;
  onSubmit: (values: WorkoutTimeValues) => void;
}

const DURATIONS = [45, 60, 75, 90];

/** Date + start/end time form, shared by "log past workout" and "edit time". */
export function WorkoutTimeSheet(props: Props) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title} description={props.description}>
      {props.open && <TimeForm {...props} />}
    </Sheet>
  );
}

function TimeForm({ start, end, name, withRoutine, submitLabel, onSubmit, onClose }: Props) {
  const routines = useData((s) => s.routines);
  const ids = { date: useId(), start: useId(), end: useId(), name: useId(), routine: useId() };
  const [date, setDate] = useState(() => toDateInput(start));
  const [startTime, setStartTime] = useState(() => toTimeInput(start));
  const [endTime, setEndTime] = useState(() => (end !== undefined ? toTimeInput(end) : ''));
  const [title, setTitle] = useState(name ?? '');
  const [routineId, setRoutineId] = useState('');
  const [now] = useState(() => Date.now());

  const startTs = combineDateTime(date, startTime);
  let endTs = end !== undefined ? combineDateTime(date, endTime) : undefined;
  // An end before the start means the session ran past midnight.
  if (endTs !== undefined && endTs <= startTs) endTs += 86_400_000;

  const error =
    startTs > now + 60_000
      ? 'The start time is in the future.'
      : endTs !== undefined && endTs > now + 5 * 60_000
        ? 'The end time is in the future.'
        : endTs !== undefined && endTs - startTs > 6 * 3_600_000
          ? 'That is longer than 6 hours — check the times.'
          : null;

  const setDuration = (minutes: number) => {
    haptic('select');
    setEndTime(toTimeInput(startTs + minutes * 60_000));
  };

  return (
    <form
      className="space-y-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (error) {
          haptic('warning');
          return;
        }
        onSubmit({ start: startTs, end: endTs, name: title.trim() || undefined, routineId: routineId || undefined });
        onClose();
      }}
    >
      {name !== undefined && (
        <Field label="Name" htmlFor={ids.name}>
          <TextInput id={ids.name} value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
        </Field>
      )}
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
      <div className={cn('grid gap-3', end !== undefined ? 'grid-cols-2' : 'grid-cols-1')}>
        <Field label="Started" htmlFor={ids.start}>
          <input
            id={ids.start}
            type="time"
            value={startTime}
            onChange={(e) => e.target.value && setStartTime(e.target.value)}
            className="field"
          />
        </Field>
        {end !== undefined && (
          <Field label="Finished" htmlFor={ids.end}>
            <input
              id={ids.end}
              type="time"
              value={endTime}
              onChange={(e) => e.target.value && setEndTime(e.target.value)}
              className="field"
            />
          </Field>
        )}
      </div>
      {end !== undefined && (
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-semibold text-fg-2">
            Duration{endTs !== undefined && <span className="font-normal"> · {formatDuration(endTs - startTs)}</span>}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DURATIONS.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={endTs !== undefined && endTs - startTs === m * 60_000 ? 'soft' : 'secondary'}
                onClick={() => setDuration(m)}
                feedback={false}
              >
                {m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}` : ''}`}
              </Button>
            ))}
          </div>
        </div>
      )}
      {withRoutine && routines.length > 0 && (
        <Field label="Start from routine (optional)" htmlFor={ids.routine}>
          <Select id={ids.routine} value={routineId} onChange={(e) => setRoutineId(e.target.value)}>
            <option value="">Empty workout</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 px-1 text-sm font-medium text-danger">
          <CircleAlert size={15} aria-hidden /> {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" block disabled={Boolean(error)} feedback="success">
        {submitLabel}
      </Button>
    </form>
  );
}

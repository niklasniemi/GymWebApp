import { memo, useMemo, useState } from 'react';
import { frequencyGrid, type HeatCell } from '../../lib/analytics';
import { pluralize } from '../../lib/format';
import { formatVolume } from '../../lib/units';
import { cn } from '../../lib/utils';
import type { Unit, Workout } from '../../types';

const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
const WEEKS = 18;

/** Training-frequency calendar: one cell per day, shaded by session volume. */
export const Heatmap = memo(function Heatmap({ workouts, unit }: { workouts: Workout[]; unit: Unit }) {
  const grid = useMemo(() => frequencyGrid(workouts, WEEKS), [workouts]);
  const [active, setActive] = useState<HeatCell | null>(null);

  const total = grid.flat().reduce((n, c) => n + c.count, 0);
  const activeDays = grid.flat().filter((c) => c.count > 0).length;
  const perWeek = (total / WEEKS).toFixed(1);

  const months = grid.map((col, i) => {
    const first = col.find((c) => new Date(c.date).getDate() === 1);
    if (first || i === 0) {
      return new Date((first ?? col[0]).date).toLocaleDateString(undefined, { month: 'short' });
    }
    return '';
  });

  const detail = active
    ? `${new Date(active.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${
        active.count ? `${pluralize(active.count, 'workout')} · ${formatVolume(active.volume, unit)}` : 'Rest day'
      }`
    : `${pluralize(total, 'workout')} on ${pluralize(activeDays, 'day')} · ${perWeek} per week`;

  return (
    <div>
      <div
        role="img"
        aria-label={`Workout calendar for the last ${WEEKS} weeks: ${total} workouts, about ${perWeek} per week.`}
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `1.75rem repeat(${WEEKS}, minmax(0, 1fr))` }}
        onMouseLeave={() => setActive(null)}
      >
        <span />
        {months.map((m, i) => (
          <span key={i} className="overflow-visible text-[10px] whitespace-nowrap text-muted">
            {m}
          </span>
        ))}
        {DAYS.map((d, row) => (
          <Row key={row} label={d} cells={grid.map((col) => col[row])} onActive={setActive} active={active} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-h-5 text-xs text-fg-2 tabular" aria-live="polite">
          {detail}
        </p>
        <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted" aria-hidden>
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="size-2.5 rounded-[2px]" style={{ background: `var(--heat-${l})` }} />
          ))}
          More
        </div>
      </div>
    </div>
  );
});

function Row({
  label,
  cells,
  onActive,
  active,
}: {
  label: string;
  cells: HeatCell[];
  onActive: (c: HeatCell) => void;
  active: HeatCell | null;
}) {
  return (
    <>
      <span className="self-center text-[10px] leading-none text-muted">{label}</span>
      {cells.map((c) => (
        <span
          key={c.date}
          onMouseEnter={() => onActive(c)}
          onClick={() => onActive(c)}
          className={cn(
            'aspect-square rounded-[3px] transition-transform',
            c.future && 'opacity-0',
            active?.date === c.date && 'scale-125',
          )}
          style={{ background: `var(--heat-${c.level})` }}
        />
      ))}
    </>
  );
}

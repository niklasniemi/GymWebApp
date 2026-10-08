import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { formatActiveTime, isActivity, SPORT_INFO, sportSummary } from '../../lib/activities';
import { isRun } from '../../lib/running';
import { useHistoryIndex } from '../../store/data';
import { Card } from '../ui/primitives';
import { WidgetFrame } from '../widgets/WidgetBoard';
import { ActivitySheet } from './ActivitySheet';
import { SportIcon } from './SportIcon';

const DAYS = 30;

/** Time per sport over the last 30 days, plus the total active (non-gym) time. */
export function ActivitiesWidget() {
  const history = useHistoryIndex();
  const [logging, setLogging] = useState(false);
  const [now] = useState(() => Date.now());
  const { rows, total, runs } = useMemo(() => {
    const from = now - DAYS * 86_400_000;
    const recent = history.sorted.filter((w) => w.startedAt >= from);
    const acts = recent.filter(isActivity);
    const runTime = recent.filter(isRun).reduce((a, w) => a + w.run.duration, 0);
    const rows = sportSummary(acts);
    return { rows, total: rows.reduce((a, r) => a + r.seconds, 0) + runTime, runs: runTime };
  }, [history, now]);
  const max = Math.max(1, ...rows.map((r) => r.seconds));

  return (
    <WidgetFrame title="Activities" action="Log activity" onAction={() => setLogging(true)}>
      {rows.length === 0 ? (
        <button
          type="button"
          onClick={() => setLogging(true)}
          className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-[0.98]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <SportIcon sport="tennis" size={22} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Log tennis, padel & more</span>
            <span className="block text-sm text-fg-2">
              Sports outside the gym count toward your weekly goal and calorie budget.
            </span>
          </span>
          <Plus size={20} className="shrink-0 text-accent-text" aria-hidden />
        </button>
      ) : (
        <Card className="space-y-3">
          <p className="text-sm text-fg-2">
            <span className="text-xl font-bold text-fg tabular">{formatActiveTime(total)}</span> active outside the gym
            in {DAYS} days{runs > 0 ? ` (incl. ${formatActiveTime(runs)} running)` : ''}
          </p>
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.sport} className="flex items-center gap-3">
                <SportIcon sport={r.sport} size={20} className="shrink-0 text-accent-text" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">{SPORT_INFO[r.sport].label}</span>
                    <span className="shrink-0 text-fg-2 tabular">
                      {r.sessions}× · {formatActiveTime(r.seconds)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill">
                    <div
                      className="h-full w-full origin-left rounded-full bg-[var(--chart-1)] transition-transform duration-700"
                      style={{ transform: `scaleX(${r.seconds / max})` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <ActivitySheet open={logging} onClose={() => setLogging(false)} />
    </WidgetFrame>
  );
}

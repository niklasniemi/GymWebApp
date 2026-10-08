import { useMemo, useState } from 'react';
import { Footprints, Plus } from 'lucide-react';
import { formatShortDate } from '../../lib/format';
import {
  BEST_EFFORTS,
  formatDistance,
  formatPace,
  formatRunTime,
  isRun,
  paceSeconds,
  runRecords,
  weeklyDistance,
} from '../../lib/running';
import { useHistoryIndex } from '../../store/data';
import { useSettings } from '../../store/settings';
import { Card } from '../ui/primitives';
import { WidgetFrame } from '../widgets/WidgetBoard';
import { RunSheet } from './RunSheet';
import { RunDetailSheet } from './RunDetailSheet';

const WEEKS = 12;

/** Weekly distance, this week at a glance, and running records. CSS-only chart. */
export function RunningWidget() {
  const history = useHistoryIndex();
  const unit = useSettings((s) => s.unit);
  const [logging, setLogging] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const runs = useMemo(() => history.sorted.filter(isRun), [history]);
  const weeks = useMemo(() => weeklyDistance(runs, WEEKS, now), [runs, now]);
  const records = useMemo(() => runRecords(runs), [runs]);
  const thisWeek = weeks[weeks.length - 1];
  const runsThisWeek = runs.filter((w) => w.startedAt >= thisWeek.week).length;
  const recent = runs.filter((w) => w.startedAt >= now - 30 * 86_400_000);
  const recentDist = recent.reduce((a, w) => a + w.run.distance, 0);
  const recentTime = recent.reduce((a, w) => a + w.run.duration, 0);
  const peak = Math.max(...weeks.map((w) => w.distance));
  const max = Math.max(peak, 1);
  const opened = runs.find((w) => w.id === openId) ?? null;

  return (
    <WidgetFrame title="Running" action="Log run" onAction={() => setLogging(true)}>
      {runs.length === 0 ? (
        <button
          type="button"
          onClick={() => setLogging(true)}
          className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-[0.98]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <Footprints size={22} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Log your first run</span>
            <span className="block text-sm text-fg-2">
              Add runs from your watch or app afterwards — they count toward your weekly goal.
            </span>
          </span>
          <Plus size={20} className="shrink-0 text-accent-text" aria-hidden />
        </button>
      ) : (
        <Card className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="This week"
              value={formatDistance(thisWeek.distance, unit)}
              sub={`${runsThisWeek} run${runsThisWeek === 1 ? '' : 's'}`}
            />
            <Stat label="Last 30 days" value={formatDistance(recentDist, unit)} sub={`${recent.length} runs`} />
            <Stat
              label="Avg pace"
              value={
                recentDist > 0
                  ? formatPace(paceSeconds({ distance: recentDist, duration: recentTime }, unit), unit, false)
                  : '–'
              }
              sub={`/${unit === 'kg' ? 'km' : 'mi'} · 30 days`}
            />
          </div>

          <div>
            <div className="flex h-24 items-end gap-1" role="img" aria-label={`Weekly distance, last ${WEEKS} weeks`}>
              {weeks.map((w, i) => (
                <span
                  key={w.week}
                  title={`${formatShortDate(w.week)}: ${formatDistance(w.distance, unit)}`}
                  className="relative h-full flex-1"
                >
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-fill" />
                  <span
                    className="absolute inset-x-0 bottom-0 block h-full origin-bottom rounded-t-[4px] rounded-b-[2px] transition-transform duration-700"
                    style={{
                      transform: `scaleY(${Math.max(w.distance > 0 ? 0.03 : 0, w.distance / max)})`,
                      background: 'var(--chart-1)',
                      opacity: i === weeks.length - 1 ? 1 : 0.7,
                    }}
                  />
                </span>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>{formatShortDate(weeks[0].week)}</span>
              <span>Peak {formatDistance(peak, unit)} / week</span>
              <span>This week</span>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-2 text-sm">
            {records.longest && (
              <Record
                label="Longest"
                value={formatDistance(records.longest.run.distance, unit)}
                onClick={() => setOpenId(records.longest!.id)}
              />
            )}
            {records.fastest && (
              <Record
                label="Fastest pace"
                value={formatPace(paceSeconds(records.fastest.run, unit), unit)}
                onClick={() => setOpenId(records.fastest!.id)}
              />
            )}
            {BEST_EFFORTS.map((e) => {
              const best = records.efforts[e.key];
              return best ? (
                <Record
                  key={e.key}
                  label={`Best ${e.label}`}
                  value={formatRunTime(best.time)}
                  onClick={() => setOpenId(best.workoutId)}
                />
              ) : null;
            })}
          </ul>
          {Object.keys(records.efforts).length > 0 && (
            <p className="text-xs text-muted">
              Best efforts are estimated from whole runs of at least that distance (Riegel formula).
            </p>
          )}
        </Card>
      )}
      <RunSheet open={logging} onClose={() => setLogging(false)} />
      <RunDetailSheet workout={opened} onClose={() => setOpenId(null)} />
    </WidgetFrame>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-semibold text-fg-2">{label}</p>
      <p className="text-lg font-bold tracking-tight whitespace-nowrap tabular">{value}</p>
      <p className="truncate text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function Record({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl bg-fill px-3 py-2 text-left transition-transform active:scale-[0.97]"
      >
        <span className="block text-xs font-semibold text-fg-2">{label}</span>
        <span className="block font-bold tabular">{value}</span>
      </button>
    </li>
  );
}

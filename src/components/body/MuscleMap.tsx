import { lazy, memo, Suspense, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MUSCLE_NAMES, type Muscle } from '../../data/anatomy';
import { useIsDark } from '../../hooks/useIsDark';
import { haptic } from '../../lib/haptics';
import { BODY_NEUTRAL, HEAT_LEGEND, heatColor, rankMuscles, toHeat, type MuscleLoad } from '../../lib/muscles';
import { formatNumber } from '../../lib/units';
import { cn } from '../../lib/utils';

// three.js lives in its own chunk, fetched the first time a body map is shown.
const BodyHeatmap = lazy(() => import('./BodyHeatmap'));

interface Props {
  load: MuscleLoad;
  /** Minimum set count treated as "fully hot" (relative scale otherwise). */
  floor?: number;
  height?: number;
  /** Show the ranked muscle list under the figure. */
  showList?: boolean;
  /** e.g. "sets this week" */
  unitLabel?: string;
  emptyMessage?: string;
}

const fmtSets = (v: number) => formatNumber(v, 1);

/** 3D heat map + legend + ranked, tappable muscle list. */
export const MuscleMap = memo(function MuscleMap({
  load,
  floor = 0,
  height = 360,
  showList = true,
  unitLabel = 'sets',
  emptyMessage = 'No training in this period yet.',
}: Props) {
  const dark = useIsDark();
  const neutral = dark ? BODY_NEUTRAL.dark : BODY_NEUTRAL.light;
  const heat = useMemo(() => toHeat(load, floor), [load, floor]);
  const ranked = useMemo(() => rankMuscles(load), [load]);
  const [selected, setSelected] = useState<Muscle | null>(null);
  const [focus, setFocus] = useState<{ muscle: Muscle } | null>(null);

  const trained = ranked.filter((r) => r.sets > 0);
  const untrained = ranked.filter((r) => r.sets === 0);
  const max = trained[0]?.sets ?? 0;
  const label = trained.length
    ? `Body heat map. Most trained: ${trained
        .slice(0, 3)
        .map((r) => `${MUSCLE_NAMES[r.muscle]} ${fmtSets(r.sets)} ${unitLabel}`)
        .join(', ')}.`
    : `Body heat map. ${emptyMessage}`;

  const select = (m: Muscle | null) => setSelected(m);

  return (
    <div>
      <Suspense fallback={<div style={{ height }} className="animate-pulse rounded-2xl bg-fill" />}>
        <BodyHeatmap heat={heat} height={height} selected={selected} onSelect={select} focus={focus} label={label} />
      </Suspense>

      <div className="mt-2 flex min-h-6 items-center justify-between gap-3 px-1">
        <p aria-live="polite" className="min-w-0 truncate text-sm">
          {selected ? (
            <>
              <span className="font-semibold">{MUSCLE_NAMES[selected]}</span>
              <span className="text-fg-2 tabular">
                {' '}
                · {load[selected] ? `${fmtSets(load[selected])} ${unitLabel}` : 'not trained'}
              </span>
            </>
          ) : (
            <span className="text-fg-2">{trained.length ? 'Tap a muscle · drag to turn' : emptyMessage}</span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted" aria-hidden>
          <span className="size-2.5 rounded-full" style={{ background: neutral }} />
          <span
            className="h-2.5 w-16 rounded-full"
            style={{ background: `linear-gradient(90deg, ${HEAT_LEGEND.join(',')})` }}
          />
          Hot
        </div>
      </div>

      {showList && trained.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Muscles ranked by training volume">
          {trained.map((r, i) => (
            <li key={r.muscle}>
              <button
                type="button"
                aria-pressed={selected === r.muscle}
                onClick={() => {
                  haptic('select');
                  const next = selected === r.muscle ? null : r.muscle;
                  select(next);
                  if (next) setFocus({ muscle: next });
                }}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm transition-transform active:scale-[0.98]',
                  selected === r.muscle && 'bg-fill',
                )}
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: heatColor(heat[r.muscle], neutral) }}
                />
                <span className="w-32 shrink-0 truncate">{MUSCLE_NAMES[r.muscle]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-fill" aria-hidden>
                  <motion.span
                    className="block h-full origin-left rounded-full"
                    style={{ background: heatColor(heat[r.muscle], neutral) }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: max ? r.sets / max : 0 }}
                    transition={{ type: 'spring', stiffness: 170, damping: 26, delay: i * 0.02 }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right font-semibold tabular">{fmtSets(r.sets)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {showList && trained.length > 0 && untrained.length > 0 && (
        <p className="mt-3 px-1 text-xs text-fg-2">
          <span className="font-semibold text-fg">Not trained:</span>{' '}
          {untrained.map((r) => MUSCLE_NAMES[r.muscle]).join(', ')}
        </p>
      )}
      {showList && trained.length > 0 && (
        <p className="mt-1 px-1 text-[11px] text-muted">Working sets; muscles assisting a lift count as half a set.</p>
      )}
    </div>
  );
});

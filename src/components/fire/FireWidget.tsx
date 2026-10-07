import { useState } from 'react';
import { Flame as FlameIcon } from 'lucide-react';
import { useMomentum } from '../../hooks/useMomentum';
import { haptic } from '../../lib/haptics';
import { playChime } from '../../lib/sound';
import { cn } from '../../lib/utils';
import { navigate } from '../../store/ui';
import { WidgetFrame } from '../widgets/WidgetBoard';
import { Flame } from './Flame';

/**
 * "How on fire are you": momentum from recent training relative to the
 * weekly goal and session effort. Tap the flame for sparks.
 */
export function FireWidget() {
  const m = useMomentum();
  const [burst, setBurst] = useState(0);
  const { goal } = m;

  const ignite = () => {
    setBurst((b) => b + 1);
    haptic('spark');
    playChime('ignite');
  };

  const hint = goal.atRisk
    ? `Streak ends ${goal.daysLeft === 1 ? 'today' : `in ${goal.daysLeft} days`} — ${goal.remaining} more to go.`
    : !goal.currentMet
      ? `${goal.remaining} more workout${goal.remaining > 1 ? 's' : ''} this week hits your goal.`
      : m.level < 100
        ? `Goal met! Rest today → ${m.tomorrow}% tomorrow.`
        : 'Goal met and burning at full heat.';

  return (
    <WidgetFrame title="Momentum" action="History" onAction={() => navigate('analytics', 'overview', 'momentum')}>
      <div className="surface relative overflow-hidden rounded-3xl p-4">
        {/* Warm bloom that intensifies with the fire. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-10 size-64 rounded-full transition-opacity duration-700"
          style={{
            background: 'radial-gradient(closest-side, rgb(249 115 22 / 0.35), transparent)',
            opacity: 0.25 + (m.level / 100) * 0.75,
          }}
        />
        <div className="relative flex items-center gap-4">
          <button
            type="button"
            onClick={ignite}
            aria-label={`Momentum ${m.level}%, ${m.stage.label}. Tap for sparks.`}
            className="-my-2 shrink-0 rounded-3xl transition-transform active:scale-95"
          >
            <Flame level={m.level} size={132} burst={burst} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-2xl leading-tight font-bold tracking-tight">{m.stage.label}</p>
            <p className="text-sm text-fg-2 tabular">
              <span className="font-semibold text-fg">{m.level}%</span> momentum
              {m.liveGain > 0 && <span className="ml-1 font-semibold text-[#f97316]">+{m.liveGain} live</span>}
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-fill"
              role="progressbar"
              aria-label="Momentum"
              aria-valuenow={m.level}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full origin-left rounded-full transition-transform duration-700"
                style={{
                  transform: `scaleX(${m.level / 100})`,
                  background: 'linear-gradient(90deg, #f59e0b, #f97316 45%, #ef4444)',
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-fg-2">{m.stage.blurb}</p>
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('analytics', 'overview', 'goalWeeks')}
            className="rounded-2xl bg-fill p-3 text-left transition-transform active:scale-95"
          >
            <span className="block text-[11px] font-semibold tracking-wide text-fg-2 uppercase">This week</span>
            <span className="mt-0.5 flex items-baseline gap-1 text-xl font-bold tabular">
              {goal.thisWeek}
              <span className="text-sm font-semibold text-fg-2">/ {goal.goal}</span>
            </span>
            <span className="mt-1.5 flex gap-1" aria-hidden>
              {Array.from({ length: goal.goal }, (_, i) => (
                <span
                  key={i}
                  className={cn('h-1.5 flex-1 rounded-full', i < goal.thisWeek ? 'bg-[#f97316]' : 'bg-fill-strong')}
                />
              ))}
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('analytics', 'overview', 'goalWeeks')}
            className="rounded-2xl bg-fill p-3 text-left transition-transform active:scale-95"
          >
            <span className="block text-[11px] font-semibold tracking-wide text-fg-2 uppercase">Goal streak</span>
            <span className="mt-0.5 flex items-center gap-1 text-xl font-bold tabular">
              {goal.streak}
              <span className="text-sm font-semibold text-fg-2">{goal.streak === 1 ? 'week' : 'weeks'}</span>
              {goal.streak > 0 && <FlameIcon size={16} className="text-[#f97316]" aria-hidden />}
            </span>
            <span className={cn('mt-1 block text-[11px]', goal.atRisk ? 'font-semibold text-danger' : 'text-fg-2')}>
              {goal.atRisk ? 'At risk' : goal.currentMet ? 'This week secured' : `${goal.goal}× per week`}
            </span>
          </button>
        </div>
        <p className={cn('relative mt-2.5 text-xs', goal.atRisk ? 'font-semibold text-danger' : 'text-fg-2')}>{hint}</p>
      </div>
    </WidgetFrame>
  );
}

import { CalendarClock, Goal, PartyPopper, TrendingDown, TrendingUp } from 'lucide-react';
import { formatDate } from '../../lib/format';
import { formatNumber, toDisplayWeight } from '../../lib/units';
import { formatWeeks } from '../../lib/weightGoal';
import { useNutrition, useWeightGoal } from '../../store/nutrition';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { navigate } from '../../store/ui';
import { Button } from '../ui/Button';
import { Card } from '../ui/primitives';
import { WidgetFrame } from './WidgetBoard';

/**
 * Target weight: progress from where you started, what's left, and when
 * you'll get there — at your planned rate and at your actual weigh-in trend.
 */
export function WeightGoalWidget({ hideWhenUnset = false }: { hideWhenUnset?: boolean }) {
  const status = useWeightGoal();
  const goal = useNutrition((s) => s.weightGoal);
  const rate = useNutrition((s) => s.profile.rate);
  const unit = useSettings((s) => s.unit);
  const w = (kg: number, digits = 1) => `${formatNumber(toDisplayWeight(kg, unit), digits)} ${unit}`;
  const openGoals = () => navigate('food', 'goals');

  if (!status || !goal) {
    if (hideWhenUnset) return null;
    return (
      <WidgetFrame title="Weight goal">
        <button
          type="button"
          onClick={openGoals}
          className="surface flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-transform active:scale-[0.98]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
            <Goal size={22} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Set a target weight</span>
            <span className="block text-sm text-fg-2">See how far you have to go and when you'll get there.</span>
          </span>
        </button>
      </WidgetFrame>
    );
  }

  const lose = status.direction === 'lose';
  const TrendIcon = lose ? TrendingDown : TrendingUp;
  const pct = Math.round(status.progress * 100);

  return (
    <WidgetFrame title="Weight goal" action="Edit" onAction={openGoals}>
      <Card className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-fg-2">Now</p>
            <p className="text-2xl font-bold tracking-tight tabular">{w(status.currentKg)}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xs font-semibold text-fg-2">Target</p>
            <p className="text-2xl font-bold tracking-tight text-success-text tabular">{w(goal.targetKg)}</p>
          </div>
        </div>

        <div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-fill"
            role="progressbar"
            aria-label={`Weight goal progress: ${pct}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full w-full origin-left rounded-full bg-success transition-transform duration-700 ease-[var(--ease-out)]"
              style={{ transform: `scaleX(${Math.max(0.02, status.progress)})` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-fg-2 tabular">
            <span>Start {w(goal.startKg)}</span>
            <span className="font-semibold text-fg">{pct}%</span>
          </div>
        </div>

        {status.reached ? (
          <div className="flex items-center gap-3 rounded-2xl bg-success-soft p-3">
            <PartyPopper size={22} className="shrink-0 text-success-text" aria-hidden />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">Target reached!</span> Switch to maintenance to hold it.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const s = useNutrition.getState();
                s.update({ profile: { ...s.profile, goal: 'maintain' }, weightGoal: null });
                toast.success('Switched to maintenance');
              }}
            >
              Maintain
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-bold tabular">{w(status.remainingKg)}</span>
              <span className="text-fg-2"> to {lose ? 'lose' : 'gain'}</span>
            </p>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2.5">
                <CalendarClock size={17} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
                <dt className="min-w-0 flex-1 text-fg-2">
                  At your plan
                  <span className="block text-xs text-muted">
                    {formatNumber(toDisplayWeight(rate, unit), 2)} {unit}/week
                  </span>
                </dt>
                <dd className="text-right">
                  {status.plannedWeeks !== null && status.plannedDate !== null ? (
                    <>
                      <span className="block font-semibold">{formatDate(status.plannedDate)}</span>
                      <span className="block text-xs text-fg-2">{formatWeeks(status.plannedWeeks)}</span>
                    </>
                  ) : (
                    <span className="text-fg-2">Set a rate</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start gap-2.5">
                <TrendIcon size={17} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
                <dt className="min-w-0 flex-1 text-fg-2">
                  At your trend
                  <span className="block text-xs text-muted">
                    {status.trendPerWeek === null
                      ? 'last 4 weeks of weigh-ins'
                      : `${status.trendPerWeek > 0 ? '+' : '−'}${formatNumber(toDisplayWeight(Math.abs(status.trendPerWeek), unit), 2)} ${unit}/week`}
                  </span>
                </dt>
                <dd className="max-w-[48%] text-right">
                  {status.trendDate !== null && status.trendWeeks !== null ? (
                    <>
                      <span className="block font-semibold">{formatDate(status.trendDate)}</span>
                      <span className="block text-xs text-fg-2">{formatWeeks(status.trendWeeks)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-fg-2">
                      {status.trendPerWeek === null
                        ? 'Weigh in 3+ times over a week'
                        : `Not ${lose ? 'dropping' : 'rising'} yet`}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </>
        )}
      </Card>
    </WidgetFrame>
  );
}

import type { Workout } from '../types';
import { addDays, startOfDay, startOfWeek } from './format';

export interface GoalStatus {
  goal: number;
  /** Workouts in the current (Monday-based) week. */
  thisWeek: number;
  remaining: number;
  /** Days left in the week including today (Sunday = 1). */
  daysLeft: number;
  /** Consecutive weeks that met the goal (the current week counts once met). */
  streak: number;
  currentMet: boolean;
  /** Streak exists, current week not yet met, and the week ends within 2 days. */
  atRisk: boolean;
}

/**
 * Weekly-goal streaks: a week only counts if it reached the goal. The
 * current week can't break the streak until it's over, so an unfinished
 * week keeps the previous run alive (and adds to it once the goal is hit).
 */
export function goalStatus(workouts: Workout[], goal: number, now = Date.now()): GoalStatus {
  const weekStart = startOfWeek(now);
  const counts = new Map<number, number>();
  for (const w of workouts) {
    if (!w.endedAt) continue;
    const k = startOfWeek(w.startedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const thisWeek = counts.get(weekStart) ?? 0;
  const currentMet = thisWeek >= goal;

  let streak = 0;
  for (let k = addDays(weekStart, -7); (counts.get(k) ?? 0) >= goal; k = addDays(k, -7)) streak++;
  if (currentMet) streak++;

  const dayIndex = Math.round((startOfDay(now) - weekStart) / 86_400_000); // Mon = 0
  const daysLeft = 7 - Math.min(6, Math.max(0, dayIndex));
  const remaining = Math.max(0, goal - thisWeek);

  return {
    goal,
    thisWeek,
    remaining,
    daysLeft,
    streak,
    currentMet,
    atRisk: streak > 0 && !currentMet && daysLeft <= 2,
  };
}

/** Top-notification copy for an at-risk streak (null when nothing to say). */
export function streakReminder(status: GoalStatus): { title: string; description: string } | null {
  if (!status.atRisk) return null;
  const weeks = `${status.streak}-week streak`;
  const when = status.daysLeft === 1 ? 'ends today' : `ends in ${status.daysLeft} days`;
  const need = status.remaining === 1 ? '1 more workout' : `${status.remaining} more workouts`;
  return {
    title: `Your ${weeks} ${when}`,
    description:
      status.remaining > status.daysLeft
        ? `You'd need ${need} this week — double up to save it.`
        : `${need[0].toUpperCase()}${need.slice(1)} this week keeps it alive.`,
  };
}

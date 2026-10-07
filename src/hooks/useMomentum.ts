import { useMemo } from 'react';
import { goalStatus } from '../lib/goals';
import { clampLevel, fireStage, fuelEvents, liveFuel, momentumAt } from '../lib/momentum';
import { useData } from '../store/data';
import { useSettings } from '../store/settings';
import { useActiveWorkout } from '../store/workout';
import { useNow } from './useNow';

const DAY = 86_400_000;

/** Current fire level (incl. the session in progress) + weekly goal status. */
export function useMomentum() {
  const workouts = useData((s) => s.workouts);
  const goal = useSettings((s) => s.weeklyGoal);
  const active = useActiveWorkout((s) => s.workout);
  const now = useNow(60_000);

  return useMemo(() => {
    const events = fuelEvents(workouts, goal);
    const live = liveFuel(active, workouts, goal, now);
    const all = live ? [...events, live] : events;
    const level = Math.round(clampLevel(momentumAt(all, now)));
    const withoutLive = Math.round(clampLevel(momentumAt(events, now)));
    return {
      level,
      /** Added by the in-progress workout so far. */
      liveGain: level - withoutLive,
      /** Level this time tomorrow if you rest. */
      tomorrow: Math.round(clampLevel(momentumAt(all, now + DAY))),
      stage: fireStage(level),
      goal: goalStatus(workouts, goal, now),
      events: all,
    };
  }, [workouts, goal, active, now]);
}

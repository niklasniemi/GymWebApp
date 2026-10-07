import { useEffect } from 'react';
import { toDateInput } from '../lib/format';
import { goalStatus, streakReminder } from '../lib/goals';
import { haptic } from '../lib/haptics';
import { useData } from '../store/data';
import { useSettings } from '../store/settings';
import { safeLocalStorage } from '../store/storage';
import { toast } from '../store/toast';
import { navigate } from '../store/ui';
import { useActiveWorkout } from '../store/workout';

const KEY = 'forge:streak-reminder';

/**
 * Once a day, when the weekly-goal streak would end within two days, show a
 * top notification. (Web apps can't schedule notifications while closed, so
 * the nudge appears when the app is opened.)
 */
export function useStreakReminder(ready: boolean) {
  useEffect(() => {
    if (!ready || useActiveWorkout.getState().workout) return;
    const status = goalStatus(useData.getState().workouts, useSettings.getState().weeklyGoal);
    const message = streakReminder(status);
    const today = toDateInput(Date.now());
    if (!message || safeLocalStorage.getItem(KEY) === today) return;
    const timer = setTimeout(() => {
      safeLocalStorage.setItem(KEY, today);
      haptic('warning');
      toast.fire(message.title, message.description, { label: 'Start workout', onClick: () => navigate('workout') });
    }, 1200);
    return () => clearTimeout(timer);
  }, [ready]);
}

import type { ActivityData, Sport, Workout } from '../types';

/*
 * Sports and activities logged after the fact. Stored as workouts with
 * `activity` data and no exercises, so they count toward the weekly goal,
 * streaks and the fire. Energy uses MET values from the Compendium of
 * Physical Activities ("general" intensity), nudged by perceived effort.
 */

export interface SportInfo {
  label: string;
  met: number;
  /** Offer a distance field. */
  distance?: boolean;
}

export const SPORT_INFO: Record<Sport, SportInfo> = {
  tennis: { label: 'Tennis', met: 7.3 },
  padel: { label: 'Padel', met: 6 },
  badminton: { label: 'Badminton', met: 5.5 },
  squash: { label: 'Squash', met: 7.3 },
  tableTennis: { label: 'Table tennis', met: 4 },
  football: { label: 'Football', met: 7 },
  basketball: { label: 'Basketball', met: 6.5 },
  floorball: { label: 'Floorball', met: 7 },
  iceHockey: { label: 'Ice hockey', met: 8 },
  volleyball: { label: 'Volleyball', met: 4 },
  golf: { label: 'Golf', met: 4.8 },
  cycling: { label: 'Cycling', met: 7.5, distance: true },
  swimming: { label: 'Swimming', met: 6, distance: true },
  walking: { label: 'Walking', met: 3.5, distance: true },
  hiking: { label: 'Hiking', met: 6, distance: true },
  skiing: { label: 'Cross-country skiing', met: 9, distance: true },
  rowing: { label: 'Rowing', met: 7, distance: true },
  climbing: { label: 'Climbing', met: 6.5 },
  martialArts: { label: 'Martial arts', met: 7.5 },
  yoga: { label: 'Yoga', met: 2.5 },
  dance: { label: 'Dance', met: 5 },
  other: { label: 'Other activity', met: 5 },
};

export type ActivityWorkout = Workout & { activity: ActivityData };

export const isActivity = (w: Workout): w is ActivityWorkout => w.activity !== undefined;

/** Effort 3 (easy) → ×0.85 … 9 (all-out) → ×1.15. */
const effortScale = (rpe?: number) => (rpe ? 0.7 + rpe * 0.05 : 1);

/** Net energy: (MET − 1) × kg × hours, scaled by perceived effort. */
export function activityCalories(a: ActivityData, weightKg: number): number {
  const met = SPORT_INFO[a.sport]?.met ?? 5;
  return Math.round((met - 1) * weightKg * (a.duration / 3600) * effortScale(a.rpe));
}

export interface SportSummary {
  sport: Sport;
  sessions: number;
  seconds: number;
}

/** Sessions and time per sport, most time first. */
export function sportSummary(activities: ActivityWorkout[]): SportSummary[] {
  const map = new Map<Sport, SportSummary>();
  for (const w of activities) {
    const s = map.get(w.activity.sport) ?? { sport: w.activity.sport, sessions: 0, seconds: 0 };
    s.sessions++;
    s.seconds += w.activity.duration;
    map.set(w.activity.sport, s);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds);
}

/** "1 h 30 min", "45 min". */
export function formatActiveTime(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

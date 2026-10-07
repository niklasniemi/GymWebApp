import { useEffect, useState } from 'react';

/**
 * Re-renders the calling component on an interval, aligned to wall-clock
 * seconds. Keep it in small leaf components (clocks) so ticking never
 * re-renders the workout list.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      timer = setTimeout(tick, intervalMs - (t % intervalMs) + 5);
    };
    tick();
    return () => clearTimeout(timer);
  }, [intervalMs, enabled]);
  return now;
}

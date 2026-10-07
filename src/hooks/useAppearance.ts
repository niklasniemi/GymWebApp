import { useEffect, useState } from 'react';
import { useSettings } from '../store/settings';
import { useMediaQuery } from './useMediaQuery';

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

/** True on low battery (not charging), Save-Data, or reduced-transparency preference. */
export function usePowerSaver(): boolean {
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const [lowBattery, setLowBattery] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    if (!nav.getBattery) return;
    let battery: BatteryManagerLike | null = null;
    const update = () => battery && setLowBattery(!battery.charging && battery.level <= 0.2);
    nav
      .getBattery()
      .then((b) => {
        battery = b;
        update();
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
      })
      .catch(() => {});
    return () => {
      battery?.removeEventListener('levelchange', update);
      battery?.removeEventListener('chargingchange', update);
    };
  }, []);

  const saveData =
    typeof navigator !== 'undefined' &&
    Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

  return reducedTransparency || lowBattery || saveData;
}

/**
 * Applies theme + Liquid Glass to <html>. Everything visual flows from CSS
 * variables, so switching themes is a class flip with no React re-render.
 */
export function useAppearance() {
  const theme = useSettings((s) => s.theme);
  const glass = useSettings((s) => s.glass);
  const autoPowerSaver = useSettings((s) => s.autoPowerSaver);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const powerSaver = usePowerSaver();

  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  const glassOn = glass && !(autoPowerSaver && powerSaver);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.dataset.glass = glassOn ? 'on' : 'off';
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || (dark ? '#0d0d0d' : '#f2f2ef'));
  }, [dark, glassOn]);

  return { dark, glassOn, powerSaverActive: glass && autoPowerSaver && powerSaver };
}

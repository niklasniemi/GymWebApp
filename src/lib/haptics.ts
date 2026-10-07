import { useSettings } from '../store/settings';
import { isIOS } from './utils';

export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'pr' | 'timer';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 12,
  success: [14, 40, 22],
  warning: [30, 60, 30],
  pr: [20, 50, 20, 50, 60],
  timer: [180, 90, 180, 90, 260],
};

let iosSwitch: HTMLLabelElement | null = null;

/**
 * iOS Safari has no Vibration API, but toggling an `<input type="checkbox"
 * switch>` (iOS 18+) produces a system haptic tick. Only works inside a user
 * gesture, which is exactly when we need it.
 */
function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(kind: HapticKind = 'tap') {
  if (!useSettings.getState().haptics) return;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind]);
    } else if (isIOS) {
      iosTick();
    }
  } catch {
    // Haptics are best-effort.
  }
}

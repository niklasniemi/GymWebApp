import { useSettings } from '../store/settings';
import { playHapticSound } from './sound';
import { isIOS } from './utils';

export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'pr' | 'timer' | 'spark';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 12,
  success: [14, 40, 22],
  warning: [30, 60, 30],
  pr: [20, 50, 20, 50, 60],
  timer: [180, 90, 180, 90, 260],
  spark: [10, 30, 10, 30, 10, 30, 40],
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

/**
 * Tactile feedback. Vibrates where supported (Android) or ticks the iOS 18
 * system switch; optionally also plays a quiet click so iPhone users get
 * feedback they can actually perceive. Both are independent settings.
 */
export function haptic(kind: HapticKind = 'tap') {
  const { haptics, hapticSound } = useSettings.getState();
  if (haptics) {
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(PATTERNS[kind]);
      else if (isIOS) iosTick();
    } catch {
      // Haptics are best-effort.
    }
  }
  if (hapticSound) {
    try {
      playHapticSound(kind);
    } catch {
      // Audio is best-effort too.
    }
  }
}

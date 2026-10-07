import { useSettings } from '../store/settings';

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/**
 * Browsers (iOS especially) only allow audio after a user gesture. Resume the
 * context on the first interaction so the rest-timer chime can play later.
 */
export function installAudioUnlock() {
  const unlock = () => {
    const c = getContext();
    if (c && c.state === 'suspended') void c.resume();
    // Prime with a silent buffer — required on older iOS.
    if (c) {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: false, passive: true });
  window.addEventListener('keydown', unlock);
}

function tone(c: AudioContext, freq: number, start: number, duration: number, gain = 0.18) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export type Chime = 'timer' | 'pr' | 'tick';

export function playChime(kind: Chime = 'timer', force = false) {
  if (!force && !useSettings.getState().sound) return;
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime + 0.01;
  switch (kind) {
    case 'timer':
      // Bright three-note rising chime — audible over gym music.
      tone(c, 880, t, 0.22);
      tone(c, 1174.66, t + 0.16, 0.22);
      tone(c, 1760, t + 0.32, 0.45);
      break;
    case 'pr':
      tone(c, 523.25, t, 0.18, 0.14);
      tone(c, 659.25, t + 0.1, 0.18, 0.14);
      tone(c, 783.99, t + 0.2, 0.18, 0.14);
      tone(c, 1046.5, t + 0.3, 0.5, 0.16);
      break;
    case 'tick':
      tone(c, 1320, t, 0.06, 0.08);
      break;
  }
}

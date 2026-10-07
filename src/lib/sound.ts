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

export type Chime = 'timer' | 'pr' | 'tick' | 'ignite';

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
    case 'ignite': {
      // A soft "whoomph": filtered noise swelling up through a low-pass sweep.
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 0.6);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(220, t);
      lp.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.55);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);
      src.connect(lp).connect(g).connect(c.destination);
      src.start(t);
      src.stop(t + 0.6);
      tone(c, 196, t, 0.35, 0.08);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Haptic sounds — tiny, quiet clicks that stand in for vibration on iPhone
// (Safari has no Vibration API). Synthesised, so there are no audio files.
// ---------------------------------------------------------------------------

export type HapticSound = 'tap' | 'select' | 'success' | 'warning' | 'pr' | 'timer' | 'spark';

const noiseCache = new Map<string, AudioBuffer>();

function noiseBuffer(c: AudioContext, seconds = 0.05): AudioBuffer {
  const key = `${c.sampleRate}:${seconds}`;
  const hit = noiseCache.get(key);
  if (hit) return hit;
  const length = Math.floor(c.sampleRate * seconds);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(key, buffer);
  return buffer;
}

/** A crisp, very short filtered-noise click (like a mechanical detent). */
function click(c: AudioContext, start: number, freq: number, gain: number, length = 0.012) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = 3.5;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(band).connect(g).connect(c.destination);
  src.start(start);
  src.stop(start + length + 0.01);
}

/** A soft low "thud" — the body of a heavier haptic. */
function thud(c: AudioContext, start: number, freq: number, gain: number, length = 0.05) {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.6, start);
  osc.frequency.exponentialRampToValueAtTime(freq, start + length * 0.6);
  const g = c.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + length + 0.01);
}

export function playHapticSound(kind: HapticSound) {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const t = c.currentTime + 0.005;
  switch (kind) {
    case 'tap':
      click(c, t, 3200, 0.22);
      break;
    case 'select':
      click(c, t, 4200, 0.14, 0.008);
      break;
    case 'success':
      thud(c, t, 160, 0.16);
      click(c, t, 2600, 0.18);
      click(c, t + 0.07, 3600, 0.16);
      break;
    case 'warning':
      thud(c, t, 110, 0.22, 0.07);
      thud(c, t + 0.1, 110, 0.18, 0.07);
      break;
    case 'pr':
      [0, 0.06, 0.12].forEach((d, i) => click(c, t + d, 2800 + i * 900, 0.16));
      thud(c, t, 140, 0.18, 0.09);
      break;
    case 'timer':
      thud(c, t, 120, 0.22, 0.09);
      thud(c, t + 0.14, 120, 0.22, 0.09);
      break;
    case 'spark':
      for (let i = 0; i < 6; i++)
        click(c, t + i * 0.035 + Math.random() * 0.02, 3000 + Math.random() * 3000, 0.1, 0.01);
      thud(c, t, 90, 0.2, 0.18);
      break;
  }
}

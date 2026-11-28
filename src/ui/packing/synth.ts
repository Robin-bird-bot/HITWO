/**
 * The packing machines' sounds, made in code like the prototypes (Web Audio:
 * tones, noise bursts and chiptune runs). Silent when the screen's sound is
 * off, or where there's no audio. Each look has its own set (`sounds.ts`).
 */
import { PACKING_SOUND_SETTING } from './packingSettings';

let context: AudioContext | null = null;

/** The shared audio context, made on first use (after a click or key, so browsers allow it). */
export function audio(): AudioContext | null {
  if (PACKING_SOUND_SETTING.get() === 'off') return null;
  if (!context) {
    try {
      context = new AudioContext();
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** A MIDI note number in hertz (69 is A 440). */
export const note = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

/** One tone that fades out, optionally sliding to another pitch. */
export function tone(
  freq: number,
  seconds: number,
  type: OscillatorType = 'sine',
  volume = 0.1,
  when = 0,
  slide = 0,
): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + when;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + seconds);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + seconds + 0.02);
}

/** A burst of fading white noise through a high-pass filter. */
export function noise(seconds: number, volume = 0.08, when = 0, highPass = 800): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + when;
  const n = Math.max(1, Math.floor(a.sampleRate * seconds));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const gain = a.createGain();
  filter.type = 'highpass';
  filter.frequency.value = highPass;
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);
}

/** A chiptune run: one note per step (0 is a rest). */
export function chip(
  notes: readonly number[],
  step = 0.07,
  type: OscillatorType = 'square',
  volume = 0.06,
  when = 0,
): void {
  notes.forEach((n, i) => {
    if (n) tone(note(n), step * 0.9, type, volume, when + i * step);
  });
}

/** Every look plays these; each makes them its own way. */
export type SoundName =
  | 'tick'
  | 'stop'
  | 'ratchet'
  | 'clink'
  | 'pop'
  | 'clack'
  | 'chime'
  | 'win'
  | 'fanfare'
  | 'drum'
  | 'whoosh'
  | 'sad';

/** A look's sounds. `stop` gets the reel's order, for TrailMate's rising chord. */
export type Sounds = Readonly<Record<SoundName, (order?: number) => void>>;

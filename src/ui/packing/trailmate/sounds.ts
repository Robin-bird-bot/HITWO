/**
 * TrailMate's chiptune and gadget sounds (28-packing-screen-trailmate.md,
 * section 3), made in code like the prototype.
 */
import { chip, noise, note, tone, type Sounds } from '../synth';

const CHORD = [0, 4, 7, 11, 14];

/** Square beeps rising up a chord, reel by reel. */
const lock = (i = 0) => {
  const step = CHORD[i % CHORD.length] ?? 0;
  tone(note(76 + step), 0.09, 'square', 0.07);
  tone(note(88 + step), 0.05, 'square', 0.03, 0.05);
};

export const TRAILMATE_SOUNDS: Sounds = {
  tick: () => tone(1700 + Math.random() * 500, 0.012, 'square', 0.02),
  stop: (order) => lock(order),
  ratchet: () => {
    tone(220, 0.05, 'square', 0.07);
    noise(0.04, 0.06, 0, 2000);
  },
  clink: () => chip([84, 88, 91, 96], 0.045, 'square', 0.05),
  pop: () => tone(1200, 0.06, 'square', 0.06, 0, 2400),
  clack: () => {
    tone(1400, 0.28, 'sine', 0.08, 0, 60);
    noise(0.06, 0.05, 0, 3000);
  },
  chime: () => {
    chip([84, 88, 91, 96, 100, 103], 0.04, 'square', 0.05);
    chip([96, 100, 103, 108], 0.05, 'triangle', 0.05, 0.12);
  },
  win: () => {
    chip([72, 76, 79, 84, 79, 84, 88, 91], 0.06);
    chip([48, 0, 55, 0, 48, 0, 55, 0], 0.06, 'triangle', 0.09);
    for (let k = 0; k < 4; k++) noise(0.04, 0.05, k * 0.12 + 0.06, 1500);
  },
  fanfare: () => {
    chip([72, 76, 79, 84, 0, 84, 88, 91, 96, 0, 91, 96, 100, 103, 108, 108], 0.075);
    chip([48, 48, 55, 55, 52, 52, 55, 55, 57, 57, 59, 59, 60, 60, 60, 60], 0.075, 'triangle', 0.1);
    for (let k = 0; k < 8; k++) noise(0.05, 0.06, k * 0.15, 1200);
    for (let k = 0; k < 16; k++) {
      tone(2000 + Math.random() * 2000, 0.05, 'square', 0.015, 1.2 + k * 0.04);
    }
  },
  /** The tease: ticks that speed up like a Geiger counter. */
  drum: () => {
    let t = 0;
    for (let k = 0; k < 18; k++) {
      tone(1300 + k * 40, 0.012, 'square', 0.04, t);
      t += Math.max(0.025, 0.14 - k * 0.008);
    }
  },
  whoosh: () => tone(180, 0.35, 'sine', 0.07, 0, 1600),
  /** No scans left: an error buzz. */
  sad: () => {
    tone(110, 0.12, 'square', 0.08);
    tone(104, 0.16, 'square', 0.08, 0.15);
  },
};

/** TrailMate's own extras. */
export const TM = {
  /** A screen turns on: a rising hum and static. */
  crtOn: () => {
    tone(60, 0.2, 'sine', 0.08, 0, 900);
    noise(0.08, 0.04, 0.05, 4000);
  },
  /** A scan used: a noise burst and a falling saw. */
  zap: () => {
    noise(0.12, 0.09, 0, 600);
    tone(900, 0.18, 'sawtooth', 0.04, 0, 120);
  },
  /** Packing: modem chirps. */
  modem: () => {
    for (let k = 0; k < 8; k++) tone(900 + Math.random() * 1800, 0.03, 'square', 0.025, k * 0.035);
  },
  /** Booting: a rising square-wave arpeggio over a bass swell. */
  boot: () => {
    chip([60, 64, 67, 72, 76, 79, 84], 0.06, 'square', 0.05);
    tone(55, 0.5, 'triangle', 0.08, 0.1, 110);
  },
  /** Scanning: a rising sine sweep. */
  sweep: () => tone(300, 0.5, 'sine', 0.05, 0, 2400),
};

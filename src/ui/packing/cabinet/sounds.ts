/**
 * The cabinet's sounds (27-packing-screen.md, section 5), made in code like
 * the prototype: a wooden thunk, a ratchet, the acorn's clink and so on.
 */
import { noise, tone, type Sounds } from '../synth';

export const CABINET_SOUNDS: Sounds = {
  tick: () => noise(0.02, 0.05, 0, 2500),
  /** A reel stops: a thunk. */
  stop: () => {
    tone(140, 0.18, 'sine', 0.22, 0, 60);
    noise(0.05, 0.08, 0, 300);
  },
  ratchet: () => {
    for (let k = 0; k < 6; k++) noise(0.015, 0.08, k * 0.04, 1800);
  },
  clink: () => {
    for (const [f, d] of [
      [1900, 0.18],
      [2850, 0.12],
      [1250, 0.25],
    ] as const) {
      tone(f, d, 'sine', 0.09);
    }
  },
  pop: () => tone(520, 0.12, 'triangle', 0.14, 0, 900),
  clack: () => {
    noise(0.06, 0.12, 0, 400);
    tone(90, 0.12, 'square', 0.05, 0, 50);
  },
  chime: () => [880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.35, 'triangle', 0.08, i * 0.07)),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'square', 0.06, i * 0.09)),
  fanfare: () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
      tone(f, 0.3, 'square', 0.07, i * 0.11),
    );
    for (let k = 0; k < 14; k++)
      tone(1500 + Math.random() * 1500, 0.15, 'sine', 0.04, 0.8 + k * 0.06);
  },
  /** The tease: a drumroll. */
  drum: () => {
    for (let k = 0; k < 10; k++) noise(0.03, 0.05 + k * 0.006, k * 0.08, 600);
  },
  whoosh: () => noise(0.3, 0.05, 0, 1200),
  sad: () => [392, 330].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, i * 0.14)),
};

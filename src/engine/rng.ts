/**
 * Seeded randomness (CLAUDE.md rule 2). The generator's state lives in
 * GameState.rng, so the same seed and the same actions always give the same
 * game. These helpers advance that state in place; the engine only calls them
 * on the draft copy inside applyAction.
 *
 * Generator: sfc32, seeded through splitmix32.
 */
import type { RngState } from './types';

function splitmix32(seed: number): () => number {
  let x = seed | 0;
  return () => {
    x = (x + 0x9e3779b9) | 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    z ^= z >>> 16;
    return z >>> 0;
  };
}

/** A fresh generator state for a seed. */
export function seedRng(seed: number): RngState {
  const next = splitmix32(seed);
  const state: RngState = [next(), next(), next(), next()];
  // Warm up so nearby seeds diverge quickly.
  for (let i = 0; i < 12; i++) nextUint32(state);
  return state;
}

/** The next unsigned 32-bit integer. Advances the state. */
export function nextUint32(state: RngState): number {
  let [a, b, c, d] = state;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  state[0] = a >>> 0;
  state[1] = b >>> 0;
  state[2] = c >>> 0;
  state[3] = d >>> 0;
  return t >>> 0;
}

/** A number in [0, 1). */
export function nextFloat(state: RngState): number {
  return nextUint32(state) / 4294967296;
}

/** An integer from min to max, both included. */
export function int(state: RngState, min: number, max: number): number {
  if (max < min) throw new Error(`int(): max ${max} is below min ${min}`);
  return min + Math.floor(nextFloat(state) * (max - min + 1));
}

/** True with the given chance (0–1). Always uses one number, so results stay in step. */
export function roll(state: RngState, chance: number): boolean {
  return nextFloat(state) < chance;
}

export function pick<T>(state: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick(): no items');
  return items[int(state, 0, items.length - 1)] as T;
}

export interface Weighted<T> {
  item: T;
  weight: number;
}

/** Picks an item with probability proportional to its weight. */
export function weightedPick<T>(state: RngState, entries: readonly Weighted<T>[]): T {
  let total = 0;
  for (const entry of entries) {
    if (entry.weight < 0) throw new Error('weightedPick(): negative weight');
    total += entry.weight;
  }
  if (total <= 0) throw new Error('weightedPick(): weights add up to 0');
  let target = nextFloat(state) * total;
  for (const entry of entries) {
    if (target < entry.weight) return entry.item;
    target -= entry.weight;
  }
  // Floating-point leftovers land on the last weighted entry.
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i] as Weighted<T>;
    if (entry.weight > 0) return entry.item;
  }
  throw new Error('weightedPick(): unreachable');
}

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(state: RngState, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(state, 0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Thin Ice (docs/design/13-minigames-puzzles-2.md, section 4): Minesweeper
 * on a frozen lake, where the "mines" are holes in the ice. Pure and seeded.
 *
 * - **Holes:** a base by tier, plus 2 for each hiker (Wyatt's rule). They're
 *   placed on the first check, never on that cell or around it, so the
 *   first check is always safe and opens a patch.
 * - **Checking** safe ice shows how many holes touch it (diagonals too); a
 *   0 opens its neighbors, and so on. Flagged cells can't be checked.
 * - **Falling in:** checking a hole takes out the hiker at the front of the
 *   line. The hole stays open and play goes on with the next hiker.
 * - **The end:** every safe cell checked, and everyone still in passes.
 *   Everyone fell in, or (Tiers II and III) the time ran out: those still
 *   in fail too.
 */
import { BALANCE } from '../../config/balance';
import { seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Tier } from '../types';

const I = BALANCE.minigames.thinIce;

export type { Tier };

export interface ThinIceState {
  tier: Tier;
  cols: number;
  rows: number;
  /** How many holes there are (placed on the first check). */
  holeCount: number;
  /** Where the holes are, cell by cell (row by row), once placed. */
  holes: boolean[] | null;
  open: boolean[];
  flags: boolean[];
  order: string[];
  /** Hikers who fell in, in the order they did. */
  fell: string[];
  timeSec: number | null;
  /** Every safe cell checked. */
  won: boolean;
  over: boolean;
  rng: RngState;
}

export interface ThinIceOptions {
  tier: Tier;
  /** The grid (Auto: the tier's), holes per hiker, and the timer (Auto, off, seconds). */
  size?: 'auto' | readonly [number, number];
  holesPerHiker?: number;
  timer?: 'auto' | 'off' | number;
}

/** The cells around one (up to 8), not counting itself. */
export function around(s: Pick<ThinIceState, 'cols' | 'rows'>, cell: number): number[] {
  const c = cell % s.cols;
  const r = Math.floor(cell / s.cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nc = c + dc;
      const nr = r + dr;
      if (nc >= 0 && nc < s.cols && nr >= 0 && nr < s.rows) out.push(nr * s.cols + nc);
    }
  }
  return out;
}

/** How many holes touch a cell. */
export const count = (s: ThinIceState, cell: number): number =>
  s.holes ? around(s, cell).filter((n) => s.holes![n]).length : 0;

export function newThinIce(
  options: ThinIceOptions,
  order: readonly string[],
  seed: number,
): ThinIceState {
  const t = I.tiers[options.tier];
  const [cols, rows] = options.size && options.size !== 'auto' ? options.size : [t.cols, t.rows];
  const perHiker = options.holesPerHiker ?? I.holesPerHiker;
  // Never so many that the first check's patch can't fit.
  const holeCount = Math.max(0, Math.min(cols * rows - 9, t.holes + perHiker * order.length));
  const timeSec =
    options.timer === 'off' ? null : typeof options.timer === 'number' ? options.timer : t.timerSec;
  const cells = cols * rows;
  return {
    tier: options.tier,
    cols,
    rows,
    holeCount,
    holes: null,
    open: Array.from({ length: cells }, () => false),
    flags: Array.from({ length: cells }, () => false),
    order: [...order],
    fell: [],
    timeSec,
    won: false,
    over: order.length === 0,
    rng: seedRng(seed),
  };
}

/** The hiker at the front of the line (the next to fall in), if anyone is still in. */
export const front = (s: ThinIceState): string | undefined =>
  s.order.find((id) => !s.fell.includes(id));

/** Holes left to find: all of them, less the flags and the ones fallen into. */
export const holesLeft = (s: ThinIceState): number =>
  s.holeCount - s.flags.filter(Boolean).length - s.fell.length;

function placeHoles(s: ThinIceState, safe: number): ThinIceState {
  const rng = [...s.rng] as RngState;
  const keepClear = new Set([safe, ...around(s, safe)]);
  const spots = shuffle(
    rng,
    s.open.map((_, i) => i).filter((i) => !keepClear.has(i)),
  ).slice(0, s.holeCount);
  const holes = s.open.map((_, i) => spots.includes(i));
  return { ...s, rng, holes };
}

/** Opens a safe cell, and keeps opening around every 0 (flags stay closed). */
function reveal(s: ThinIceState, cell: number): boolean[] {
  const open = [...s.open];
  const queue = [cell];
  while (queue.length) {
    const c = queue.shift()!;
    if (open[c] || s.flags[c] || s.holes![c]) continue;
    open[c] = true;
    if (count(s, c) === 0) queue.push(...around(s, c).filter((n) => !open[n]));
  }
  return open;
}

/** Whether every safe cell has been checked. */
const cleared = (s: ThinIceState): boolean => !!s.holes && s.open.every((o, i) => o || s.holes![i]);

/**
 * Checks a cell. The first check places the holes around it (so it's safe).
 * Safe ice opens (a 0 opens its neighbors). A hole: the front hiker falls
 * in, the hole stays open, and play goes on. Flagged or open cells: nothing.
 */
export function check(s0: ThinIceState, cell: number): { state: ThinIceState; fell?: string } {
  if (s0.over || s0.open[cell] || s0.flags[cell] || cell < 0 || cell >= s0.open.length)
    return { state: s0 };
  const s = s0.holes ? s0 : placeHoles(s0, cell);
  if (s.holes![cell]) {
    const who = front(s);
    const open = s.open.map((o, i) => o || i === cell);
    const fell = who ? [...s.fell, who] : s.fell;
    const over = fell.length >= s.order.length;
    return { state: { ...s, open, fell, over }, ...(who ? { fell: who } : {}) };
  }
  const next = { ...s, open: reveal(s, cell) };
  const won = cleared(next);
  return { state: { ...next, won, over: won } };
}

/** Puts a flag on unchecked ice, or takes it off. */
export function toggleFlag(s: ThinIceState, cell: number): ThinIceState {
  if (s.over || s.open[cell] || cell < 0 || cell >= s.flags.length) return s;
  return { ...s, flags: s.flags.map((f, i) => (i === cell ? !f : f)) };
}

/** Time's up: those still in fail. */
export const timeUp = (s: ThinIceState): ThinIceState => (s.over ? s : { ...s, over: true });

/** Everyone still in passes if the ice was mapped; anyone who fell in fails. */
export function result(s: ThinIceState): MinigameResult {
  return passFailResult(s.order, (id) => s.won && !s.fell.includes(id));
}

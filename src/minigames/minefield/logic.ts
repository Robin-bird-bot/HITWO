/**
 * Minefield, the Dog Waste Zone (docs/design/23-minigames-final.md, section
 * 6; until Nov 26 this was Thin Ice, 13-minigames-puzzles-2.md section 4):
 * Minesweeper in a fenced dog park, where the "mines" are piles of dog
 * poop, and flags are doggy bags. The rules are Thin Ice's, unchanged; the
 * code still calls the piles holes. Pure and seeded.
 *
 * - **Prepare** (section 10): POO BAGS and SCANNER bag piles before you
 *   start. Then the piles are laid at the start, and the first check still
 *   can't land on one: an unbagged pile on or around it moves elsewhere.
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

const I = BALANCE.minigames.minefield;

export type { Tier };

export interface MinefieldState {
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

export interface MinefieldOptions {
  tier: Tier;
  /** The grid (Auto: the tier's), holes per hiker, and the timer (Auto, off, seconds). */
  size?: 'auto' | readonly [number, number];
  holesPerHiker?: number;
  timer?: 'auto' | 'off' | number;
  /** Prepare: piles bagged before the start. */
  preBags?: number;
}

/** The cells around one (up to 8), not counting itself. */
export function around(s: Pick<MinefieldState, 'cols' | 'rows'>, cell: number): number[] {
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
export const count = (s: MinefieldState, cell: number): number =>
  s.holes ? around(s, cell).filter((n) => s.holes![n]).length : 0;

export function newMinefield(
  options: MinefieldOptions,
  order: readonly string[],
  seed: number,
): MinefieldState {
  const t = I.tiers[options.tier];
  const [cols, rows] = options.size && options.size !== 'auto' ? options.size : [t.cols, t.rows];
  const perHiker = options.holesPerHiker ?? I.holesPerHiker;
  // Never so many that the first check's patch can't fit.
  const holeCount = Math.max(0, Math.min(cols * rows - 9, t.holes + perHiker * order.length));
  const timeSec =
    options.timer === 'off' ? null : typeof options.timer === 'number' ? options.timer : t.timerSec;
  const cells = cols * rows;
  const s: MinefieldState = {
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
  const bags = Math.min(options.preBags ?? 0, holeCount);
  if (bags <= 0) return s;
  // Pre-bagged piles: lay them all now, and bag some at random.
  const laid = placeHoles(s, -1);
  const rng = [...laid.rng] as RngState;
  const bagged = shuffle(
    rng,
    laid.holes!.flatMap((h, i) => (h ? [i] : [])),
  ).slice(0, bags);
  return { ...laid, rng, flags: laid.flags.map((_, i) => bagged.includes(i)) };
}

/** The hiker at the front of the line (the next to fall in), if anyone is still in. */
export const front = (s: MinefieldState): string | undefined =>
  s.order.find((id) => !s.fell.includes(id));

/** Holes left to find: all of them, less the flags and the ones fallen into. */
export const holesLeft = (s: MinefieldState): number =>
  s.holeCount - s.flags.filter(Boolean).length - s.fell.length;

function placeHoles(s: MinefieldState, safe: number): MinefieldState {
  const rng = [...s.rng] as RngState;
  const keepClear = new Set(safe < 0 ? [] : [safe, ...around(s, safe)]);
  const spots = shuffle(
    rng,
    s.open.map((_, i) => i).filter((i) => !keepClear.has(i)),
  ).slice(0, s.holeCount);
  const holes = s.open.map((_, i) => spots.includes(i));
  return { ...s, rng, holes };
}

/**
 * The first check when the piles were laid at the start (pre-bagged): any
 * unbagged pile on or around it moves to a free spot elsewhere, so the
 * first check is still safe.
 */
function clearAround(s: MinefieldState, safe: number): MinefieldState {
  const rng = [...s.rng] as RngState;
  const keepClear = new Set([safe, ...around(s, safe)]);
  const holes = [...s.holes!];
  const moving = [...keepClear].filter((i) => holes[i] && !s.flags[i]);
  const free = shuffle(
    rng,
    holes.map((_, i) => i).filter((i) => !holes[i] && !keepClear.has(i)),
  );
  for (const i of moving) {
    const to = free.shift();
    if (to === undefined) break;
    holes[i] = false;
    holes[to] = true;
  }
  return { ...s, rng, holes };
}

/** Opens a safe cell, and keeps opening around every 0 (flags stay closed). */
function reveal(s: MinefieldState, cell: number): boolean[] {
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
const cleared = (s: MinefieldState): boolean =>
  !!s.holes && s.open.every((o, i) => o || s.holes![i]);

/**
 * Checks a cell. The first check places the holes around it (so it's safe).
 * Safe ice opens (a 0 opens its neighbors). A hole: the front hiker falls
 * in, the hole stays open, and play goes on. Flagged or open cells: nothing.
 */
export function check(s0: MinefieldState, cell: number): { state: MinefieldState; fell?: string } {
  if (s0.over || s0.open[cell] || s0.flags[cell] || cell < 0 || cell >= s0.open.length)
    return { state: s0 };
  const first = !s0.open.some(Boolean);
  const s = !s0.holes ? placeHoles(s0, cell) : first ? clearAround(s0, cell) : s0;
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
export function toggleFlag(s: MinefieldState, cell: number): MinefieldState {
  if (s.over || s.open[cell] || cell < 0 || cell >= s.flags.length) return s;
  return { ...s, flags: s.flags.map((f, i) => (i === cell ? !f : f)) };
}

/** Time's up: those still in fail. */
export const timeUp = (s: MinefieldState): MinefieldState => (s.over ? s : { ...s, over: true });

/** Everyone still in passes if the ice was mapped; anyone who fell in fails. */
export function result(s: MinefieldState): MinigameResult {
  return passFailResult(s.order, (id) => s.won && !s.fell.includes(id));
}

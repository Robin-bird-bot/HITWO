/**
 * Remember the Path (docs/design/11-minigames-puzzles.md, section 4): a ranger
 * walks a trail across a grid, then each hiker walks it from memory. Pure
 * and seeded.
 *
 * A path starts on the bottom row and ends on the top row (its last tile is
 * its only one there), moving up, down, left or right and never back onto a
 * tile it used. Each hiker, in line-up order, gets a new path: the ranger
 * walks it, then they repeat it. A wrong step costs a strike; the last
 * strike fails the hiker. Reaching the end passes.
 */
import { BALANCE } from '../../config/balance';
import { int, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Tier } from '../types';

const R = BALANCE.minigames.rememberPath;

export type { Tier };

/** A tile: column, and row (0 is the top row). */
export interface Tile {
  c: number;
  r: number;
}

export const sameTile = (a: Tile, b: Tile): boolean => a.c === b.c && a.r === b.r;
export const nextTo = (a: Tile, b: Tile): boolean =>
  Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1;

/**
 * A path: a random walk from a random bottom-row tile, thrown away and tried
 * again if it reaches the top row too early, runs too long, or gets stuck.
 */
export function makePath(
  rng: RngState,
  cols: number,
  rows: number,
  length: readonly [number, number],
): Tile[] {
  const [min, max] = length;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const path: Tile[] = [{ c: int(rng, 0, cols - 1), r: rows - 1 }];
    while (path.length < max) {
      const at = path.at(-1)!;
      const steps = shuffle(rng, [
        { c: at.c, r: at.r - 1 },
        { c: at.c - 1, r: at.r },
        { c: at.c + 1, r: at.r },
        { c: at.c, r: at.r + 1 },
      ]).filter(
        (t) =>
          t.c >= 0 &&
          t.c < cols &&
          t.r >= 0 &&
          t.r < rows &&
          !path.some((p) => sameTile(p, t)) &&
          // The top row only as the last tile, and only when the path is long enough.
          (t.r > 0 || path.length + 1 >= min),
      );
      const step = steps[0];
      if (!step) break;
      path.push(step);
      if (step.r === 0) break;
    }
    const end = path.at(-1)!;
    if (end.r === 0 && path.length >= min && path.length <= max) return path;
  }
  // Never expected: a straight walk up.
  const c = int(rng, 0, cols - 1);
  return Array.from({ length: rows }, (_, i) => ({ c, r: rows - 1 - i }));
}

/** Each hiker starts below the grid, in the middle. */
export const BELOW = -1;

/**
 * Whether a tile is next to where the hiker is. Below the grid, every
 * bottom-row tile counts as next to them.
 */
export function isNext(s: RememberPathState, tile: Tile): boolean {
  if (s.pos === BELOW) return tile.r === s.rows - 1 && tile.c >= 0 && tile.c < s.cols;
  const at = s.path[s.pos];
  return !!at && nextTo(at, tile);
}

export interface RememberPathState {
  tier: Tier;
  cols: number;
  rows: number;
  order: string[];
  /** Whose turn it is (index in the order). */
  current: number;
  path: Tile[];
  /** How far along the path the current hiker is: −1 below the grid (where they start), 0 the start tile. */
  pos: number;
  strikesLeft: number;
  /** The ranger walks the path; the hiker repeats it; everyone is done. */
  phase: 'watch' | 'repeat' | 'over';
  results: Record<string, 'passed' | 'failed'>;
  rng: RngState;
}

function forHiker(s: RememberPathState, index: number): RememberPathState {
  if (index >= s.order.length) return { ...s, current: index, phase: 'over' };
  const rng = [...s.rng] as RngState;
  const tier = R.tiers[s.tier];
  return {
    ...s,
    rng,
    current: index,
    path: makePath(rng, s.cols, s.rows, tier.length),
    pos: BELOW,
    strikesLeft: tier.strikes,
    phase: 'watch',
  };
}

export function newRememberPath(
  tier: Tier,
  order: readonly string[],
  seed: number,
): RememberPathState {
  const t = R.tiers[tier];
  return forHiker(
    {
      tier,
      cols: t.cols,
      rows: t.rows,
      order: [...order],
      current: 0,
      path: [],
      pos: BELOW,
      strikesLeft: t.strikes,
      phase: 'watch',
      results: {},
      rng: seedRng(seed),
    },
    0,
  );
}

/** The ranger is done walking: the hiker's turn. */
export const watched = (s: RememberPathState): RememberPathState =>
  s.phase === 'watch' ? { ...s, phase: 'repeat' } : s;

export const currentHiker = (s: RememberPathState): string | undefined => s.order[s.current];

/**
 * The hiker steps onto a tile. Next on the path: they move there (and pass
 * at the end). Another tile next to them: a strike, and they stay put (the
 * last strike fails them). A tile that isn't next to them: ignored. From
 * below the grid, the first step is into the bottom row: the start tile is
 * right, any other bottom-row tile is a strike.
 */
export function step(
  s: RememberPathState,
  tile: Tile,
): {
  state: RememberPathState;
  outcome: 'right' | 'wrong' | 'ignored';
  passed?: boolean;
  failed?: boolean;
} {
  if (s.phase !== 'repeat' || !isNext(s, tile)) return { state: s, outcome: 'ignored' };
  const who = currentHiker(s)!;
  const next = s.path[s.pos + 1];
  if (next && sameTile(next, tile)) {
    const pos = s.pos + 1;
    if (pos === s.path.length - 1) {
      const done = { ...s, pos, results: { ...s.results, [who]: 'passed' as const } };
      return { state: done, outcome: 'right', passed: true };
    }
    return { state: { ...s, pos }, outcome: 'right' };
  }
  const strikesLeft = s.strikesLeft - 1;
  if (strikesLeft <= 0) {
    const done = { ...s, strikesLeft: 0, results: { ...s.results, [who]: 'failed' as const } };
    return { state: done, outcome: 'wrong', failed: true };
  }
  return { state: { ...s, strikesLeft }, outcome: 'wrong' };
}

/** The current hiker is done (passed or failed): the next one gets a new path, or it's over. */
export function nextHiker(s: RememberPathState): RememberPathState {
  return forHiker(s, s.current + 1);
}

export function result(s: RememberPathState): MinigameResult {
  return passFailResult(s.order, (id) => s.results[id] === 'passed');
}

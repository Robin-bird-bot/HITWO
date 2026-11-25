/**
 * Find the Path (docs/design/11-minigames-puzzles.md, section 5): a hidden
 * trail runs through a forest from a trailhead on the bottom row to the top
 * row. Hikers take turns guessing it one step at a time. Pure and seeded.
 *
 * - The trail goes up, left or right only, never down, never back onto a tile.
 * - On a turn, the hiker at the front of the line picks a tile up, left or
 *   right of them. The right one becomes trail and they move on; a wrong one
 *   becomes thick trees and costs a try (and may reveal another tile).
 * - Out of tries: back to the trailhead and the back of the line, and the
 *   group loses an attempt. With no attempts left, running out means out.
 * - Without fog, what's uncovered stays and later hikers walk the known
 *   trail on their own. With fog, only the last 2 picks stay visible; the
 *   game still knows the rest (a faded trail tile is free, a faded tree
 *   costs a try again).
 * - Reaching the top row passes. The first hiker through earns +1 Energy.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult } from '../types';

const P = BALANCE.minigames.findPath;

export type Tier = 1 | 2 | 3;

/** A tile: column, and row (0 is the top row). */
export interface Tile {
  c: number;
  r: number;
}

export const key = (t: Tile): string => `${t.c},${t.r}`;
const same = (a: Tile, b: Tile) => a.c === b.c && a.r === b.r;

/**
 * A trail: from a random trailhead on the bottom row, each step goes up about
 * 45% of the time, otherwise left or right, never straight back, never down,
 * never onto a tile it used, until it reaches the top row.
 */
export function makeTrail(rng: RngState, cols: number, rows: number): Tile[] {
  const trail: Tile[] = [{ c: int(rng, 0, cols - 1), r: rows - 1 }];
  let side: -1 | 1 = nextFloat(rng) < 0.5 ? -1 : 1;
  while (trail.at(-1)!.r > 0) {
    const at = trail.at(-1)!;
    const prev = trail.at(-2);
    const free = (t: Tile) =>
      t.c >= 0 && t.c < cols && !trail.some((p) => same(p, t)) && !(prev && same(prev, t));
    const up = { c: at.c, r: at.r - 1 };
    // Keep going the same way along a row (it can't turn straight back), or pick a side.
    if (!prev || prev.r !== at.r) side = nextFloat(rng) < 0.5 ? -1 : 1;
    const across = { c: at.c + side, r: at.r };
    const step = nextFloat(rng) < P.upChance || !free(across) ? up : across;
    trail.push(free(step) ? step : up);
  }
  return trail;
}

export interface FindPathOptions {
  tier: Tier;
  /** The testing tab's override: Auto (the tier's), On or Off. */
  fog: 'auto' | 'on' | 'off';
}

export type Known = 'trail' | 'trees';

export interface FindPathState {
  tier: Tier;
  cols: number;
  rows: number;
  fog: boolean;
  trail: Tile[];
  /** Every tile uncovered so far, and the pick number it was last uncovered at (for fog). */
  known: Record<string, Known>;
  uncoveredAt: Record<string, number>;
  picks: number;
  /** The line, front first. The front hiker is taking their turn. */
  line: string[];
  order: string[];
  /** How far along the trail the current hiker stands (0 is the trailhead). */
  pos: number;
  tries: number;
  attempts: number;
  results: Record<string, 'passed' | 'failed'>;
  /** The first hiker through. */
  energy?: string;
  /** The last thing that happened, for the panel ("FINN RAN OUT: BACK OF THE LINE"). */
  note: string;
  /** The tile a wrong pick just revealed, and the pick it happened at. */
  revealed?: { tile: Tile; pick: number };
  over: boolean;
  rng: RngState;
}

export const fogFor = (o: FindPathOptions): boolean =>
  o.fog === 'auto' ? P.tiers[o.tier].fog : o.fog === 'on';

/** How far the known trail runs unbroken from the trailhead (its last index). */
export function knownTrailEnd(s: FindPathState): number {
  let i = 0;
  while (i + 1 < s.trail.length && s.known[key(s.trail[i + 1]!)] === 'trail') i++;
  return i;
}

/** Whether a tile shows as uncovered: always without fog; with fog, only if uncovered in the last 2 picks. */
export function isVisible(s: FindPathState, t: Tile): boolean {
  const k = key(t);
  if (same(t, s.trail[0]!)) return true;
  if (!s.known[k]) return false;
  if (!s.fog) return true;
  return (s.uncoveredAt[k] ?? -Infinity) > s.picks - P.fogPicks;
}

function startTurn(s: FindPathState): FindPathState {
  if (!s.line.length) return { ...s, over: true };
  // Without fog the hiker walks the known trail on their own; in fog they start at the trailhead.
  const pos = s.fog ? 0 : knownTrailEnd(s);
  const next = { ...s, pos, tries: P.triesPerTurn };
  return pos === s.trail.length - 1 ? through(next) : next;
}

/** The current hiker reaches the top row: they pass (the first one through earns Energy). */
function through(s: FindPathState): FindPathState {
  const who = s.line[0]!;
  return startTurn({
    ...s,
    results: { ...s.results, [who]: 'passed' },
    energy: s.energy ?? who,
    line: s.line.slice(1),
    note: `${who} is through`,
  });
}

export function newFindPath(
  options: FindPathOptions,
  order: readonly string[],
  seed: number,
): FindPathState {
  const rng = seedRng(seed);
  const t = P.tiers[options.tier];
  const trail = makeTrail(rng, t.cols, t.rows);
  const n = Math.max(1, order.length);
  return startTurn({
    tier: options.tier,
    cols: t.cols,
    rows: t.rows,
    fog: fogFor(options),
    trail,
    known: { [key(trail[0]!)]: 'trail' },
    uncoveredAt: { [key(trail[0]!)]: 0 },
    picks: 0,
    line: [...order],
    order: [...order],
    pos: 0,
    tries: P.triesPerTurn,
    attempts: P.attempts + P.attemptsPerExtraHiker * (n - 1),
    results: {},
    note: '',
    over: false,
    rng,
  });
}

export const currentHiker = (s: FindPathState): string | undefined => s.line[0];

/**
 * The tiles the current hiker can pick: up, left and right of them (never
 * down), inside the grid, not trees they can see, and not on the trail
 * behind them.
 */
export function choices(s: FindPathState): Tile[] {
  if (s.over) return [];
  const at = s.trail[s.pos]!;
  const walked = s.trail.slice(0, s.pos + 1);
  return [
    { c: at.c, r: at.r - 1 },
    { c: at.c - 1, r: at.r },
    { c: at.c + 1, r: at.r },
  ].filter(
    (t) =>
      t.c >= 0 &&
      t.c < s.cols &&
      t.r >= 0 &&
      t.r < s.rows &&
      !walked.some((w) => same(w, t)) &&
      !(s.known[key(t)] === 'trees' && isVisible(s, t)),
  );
}

/** Out of tries: back of the line and one attempt fewer, or, with none left, out. */
function outOfTries(s: FindPathState): FindPathState {
  const who = s.line[0]!;
  if (s.attempts > 0) {
    return startTurn({
      ...s,
      attempts: s.attempts - 1,
      line: [...s.line.slice(1), who],
      note: `${who} ran out: back of the line`,
    });
  }
  return startTurn({
    ...s,
    results: { ...s.results, [who]: 'failed' },
    line: s.line.slice(1),
    note: `${who} ran out of tries and is out`,
  });
}

/**
 * The current hiker picks a tile. Not one of the choices: ignored. The
 * trail's next tile: it becomes trail and they move on (free if it was
 * already uncovered). Anything else: trees, and a try lost; with a 35%
 * chance another tile nobody has picked is revealed too.
 */
export function pick(
  s: FindPathState,
  tile: Tile,
): { state: FindPathState; outcome: 'trail' | 'trees' | 'ignored' } {
  if (!choices(s).some((t) => same(t, tile))) return { state: s, outcome: 'ignored' };
  const picks = s.picks + 1;
  const k = key(tile);
  const base = { ...s, picks, uncoveredAt: { ...s.uncoveredAt, [k]: picks } };
  delete base.revealed;
  const next = s.trail[s.pos + 1];
  if (next && same(next, tile)) {
    const moved = { ...base, known: { ...s.known, [k]: 'trail' as const }, pos: s.pos + 1 };
    return {
      state: moved.pos === s.trail.length - 1 ? through(moved) : moved,
      outcome: 'trail',
    };
  }
  const rng = [...s.rng] as RngState;
  const known: Record<string, Known> = { ...s.known, [k]: 'trees' };
  const uncoveredAt = { ...base.uncoveredAt };
  let revealed: FindPathState['revealed'];
  if (nextFloat(rng) < P.revealChance) {
    const hidden: Tile[] = [];
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) if (!known[`${c},${r}`]) hidden.push({ c, r });
    }
    const t = hidden[int(rng, 0, Math.max(0, hidden.length - 1))];
    if (t) {
      known[key(t)] = s.trail.some((p) => same(p, t)) ? 'trail' : 'trees';
      uncoveredAt[key(t)] = picks;
      revealed = { tile: t, pick: picks };
    }
  }
  const hit: FindPathState = {
    ...base,
    rng,
    known,
    uncoveredAt,
    tries: s.tries - 1,
    ...(revealed ? { revealed } : {}),
  };
  return { state: hit.tries <= 0 ? outOfTries(hit) : hit, outcome: 'trees' };
}

export function result(s: FindPathState): MinigameResult {
  return passFailResult(s.order, (id) => s.results[id] === 'passed', s.energy);
}

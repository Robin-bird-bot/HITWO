/**
 * Find the Path (docs/design/11-minigames-puzzles.md, section 5): a hidden
 * trail runs through a forest from a trailhead on the bottom row to the top
 * row. Hikers take turns guessing it one step at a time. Pure and seeded.
 *
 * - The trail goes up, left or right only, never down, never back onto a tile.
 * - On a turn, the hiker at the front of the line picks a tile up, left or
 *   right of them. **Right** is only the trail tile after the one they stand
 *   on, looked up from the trail itself (never a step counter): they move
 *   onto it, and it costs nothing. Anything else costs a try. A wrong tile
 *   off the trail becomes thick trees; a trail tile is never shown as trees.
 * - Out of tries: the trail hides again (the trees stay, unless the setting
 *   says hide everything), the hiker goes to the back of the line, and the
 *   group loses an attempt. With no attempts left, running out means out.
 *   The next hiker starts at the trailhead.
 * - Fog: only the last 2 picks stay visible; the game still knows the rest.
 * - Reaching the top row passes. The first hiker through earns +1 Energy;
 *   the trail then stays, and the rest walk it through (without fog).
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Tier } from '../types';

const P = BALANCE.minigames.findPath;

export type { Tier };

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

/** Each trail tile's next trail tile (the last, on the top row, has none). */
export function nextLookup(trail: readonly Tile[]): Record<string, Tile> {
  const out: Record<string, Tile> = {};
  trail.forEach((t, i) => {
    const next = trail[i + 1];
    if (next) out[key(t)] = next;
  });
  return out;
}

export interface FindPathOptions {
  tier: Tier;
  /** The testing tab's override: Auto (the tier's), On or Off. */
  fog: 'auto' | 'on' | 'off';
  /** What a run-out hides again: the trail only (trees stay), or everything. */
  hide?: 'trail' | 'everything';
}

export type Known = 'trail' | 'trees';

export interface FindPathState {
  tier: Tier;
  cols: number;
  rows: number;
  fog: boolean;
  hide: 'trail' | 'everything';
  trail: Tile[];
  /** The trail tile after each trail tile: the only way "right" is decided. */
  nextOf: Record<string, Tile>;
  /** Every tile showing as uncovered, and the pick number it was last uncovered at (for fog). */
  known: Record<string, Known>;
  uncoveredAt: Record<string, number>;
  picks: number;
  /** The line, front first. The front hiker is taking their turn. */
  line: string[];
  order: string[];
  /** The tile the current hiker stands on. */
  at: Tile;
  tries: number;
  attempts: number;
  results: Record<string, 'passed' | 'failed'>;
  /** The first hiker through; once someone is, the trail stays for the rest. */
  energy?: string;
  /** The last thing that happened, for the panel ("FINN RAN OUT: BACK OF THE LINE"). */
  note: string;
  /** The tile a wrong pick just revealed, and the pick it happened at. */
  revealed?: { tile: Tile; pick: number };
  /** A run-out just hid the trail (until the next pick). */
  justHidden?: true;
  over: boolean;
  rng: RngState;
}

export const fogFor = (o: FindPathOptions): boolean =>
  o.fog === 'auto' ? P.tiers[o.tier].fog : o.fog === 'on';

export const trailhead = (s: FindPathState): Tile => s.trail[0]!;

/** Whether a tile is on the trail. */
export const isTrail = (s: FindPathState, t: Tile): boolean =>
  !!s.nextOf[key(t)] || same(t, s.trail.at(-1)!);

/** The trail from the trailhead up to a trail tile (both ends included). */
export function trailTo(s: FindPathState, to: Tile): Tile[] {
  const out: Tile[] = [trailhead(s)];
  while (!same(out.at(-1)!, to)) {
    const next = s.nextOf[key(out.at(-1)!)];
    if (!next) break;
    out.push(next);
  }
  return out;
}

/** How far the uncovered trail runs unbroken from the trailhead (its last tile). */
export function knownTrailEnd(s: FindPathState): Tile {
  let at = trailhead(s);
  for (;;) {
    const next = s.nextOf[key(at)];
    if (!next || s.known[key(next)] !== 'trail') return at;
    at = next;
  }
}

/** Whether a tile shows as uncovered: always without fog; with fog, only if uncovered in the last 2 picks. */
export function isVisible(s: FindPathState, t: Tile): boolean {
  const k = key(t);
  if (same(t, trailhead(s))) return true;
  if (!s.known[k]) return false;
  if (!s.fog) return true;
  return (s.uncoveredAt[k] ?? -Infinity) > s.picks - P.fogPicks;
}

function startTurn(s: FindPathState): FindPathState {
  if (!s.line.length) return { ...s, over: true };
  // Once someone is through (and without fog), the rest walk the trail; otherwise from the trailhead.
  const at = s.energy && !s.fog ? knownTrailEnd(s) : trailhead(s);
  const next = { ...s, at, tries: P.triesPerTurn };
  return at.r === 0 ? through(next) : next;
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
    hide: options.hide ?? 'trail',
    trail,
    nextOf: nextLookup(trail),
    known: { [key(trail[0]!)]: 'trail' },
    uncoveredAt: { [key(trail[0]!)]: 0 },
    picks: 0,
    line: [...order],
    order: [...order],
    at: trail[0]!,
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
  const walked = trailTo(s, s.at);
  return [
    { c: s.at.c, r: s.at.r - 1 },
    { c: s.at.c - 1, r: s.at.r },
    { c: s.at.c + 1, r: s.at.r },
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

/**
 * Out of tries: the trail hides again (and the trees too, with "everything"),
 * then the hiker goes to the back of the line and the group loses an
 * attempt, or, with none left, the hiker is out. The next hiker starts at
 * the trailhead.
 */
function outOfTries(s: FindPathState): FindPathState {
  const who = s.line[0]!;
  const head = key(trailhead(s));
  const known: Record<string, Known> = {};
  for (const [k, v] of Object.entries(s.known)) {
    if (k === head || (v === 'trees' && s.hide === 'trail')) known[k] = v;
  }
  const hidden: FindPathState = { ...s, known, justHidden: true };
  delete hidden.revealed;
  if (s.attempts > 0) {
    return startTurn({
      ...hidden,
      attempts: s.attempts - 1,
      line: [...s.line.slice(1), who],
      note: `${who} ran out: back of the line`,
    });
  }
  return startTurn({
    ...hidden,
    results: { ...s.results, [who]: 'failed' },
    line: s.line.slice(1),
    note: `${who} ran out of tries and is out`,
  });
}

/**
 * The current hiker picks a tile. Not one of the choices: ignored. The
 * trail tile after the hiker's: they move onto it, free (uncovered or not).
 * Anything else costs a try: an off-trail tile becomes trees, a trail tile
 * further along shows as trail; and with a 35% chance another tile nobody
 * has picked is revealed too.
 *
 * `fixed` is set if the self-check had to correct a trail tile marked as
 * trees (it never should).
 */
export function pick(
  s: FindPathState,
  tile: Tile,
): { state: FindPathState; outcome: 'right' | 'wrong' | 'ignored'; fixed?: true } {
  if (!choices(s).some((t) => same(t, tile))) return { state: s, outcome: 'ignored' };
  const picks = s.picks + 1;
  const k = key(tile);
  const base = { ...s, picks, uncoveredAt: { ...s.uncoveredAt, [k]: picks } };
  delete base.revealed;
  delete base.justHidden;
  const next = s.nextOf[key(s.at)];
  if (next && same(next, tile)) {
    const moved = { ...base, known: { ...s.known, [k]: 'trail' as const }, at: tile };
    return { state: tile.r === 0 ? through(moved) : moved, outcome: 'right' };
  }
  const rng = [...s.rng] as RngState;
  const onTrail = isTrail(s, tile);
  const known: Record<string, Known> = { ...s.known, [k]: onTrail ? 'trail' : 'trees' };
  const uncoveredAt = { ...base.uncoveredAt };
  let revealed: FindPathState['revealed'];
  if (nextFloat(rng) < P.tiers[s.tier].revealChance) {
    const hidden: Tile[] = [];
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) if (!known[`${c},${r}`]) hidden.push({ c, r });
    }
    const t = hidden[int(rng, 0, Math.max(0, hidden.length - 1))];
    if (t) {
      known[key(t)] = isTrail(s, t) ? 'trail' : 'trees';
      uncoveredAt[key(t)] = picks;
      revealed = { tile: t, pick: picks };
    }
  }
  // Self-check: the way forward must never show as trees.
  let fixed: true | undefined;
  if (next && known[key(next)] === 'trees') {
    delete known[key(next)];
    fixed = true;
  }
  const hit: FindPathState = {
    ...base,
    rng,
    known,
    uncoveredAt,
    tries: s.tries - 1,
    ...(revealed ? { revealed } : {}),
  };
  return {
    state: hit.tries <= 0 ? outOfTries(hit) : hit,
    outcome: 'wrong',
    ...(fixed ? { fixed } : {}),
  };
}

export function result(s: FindPathState): MinigameResult {
  return passFailResult(s.order, (id) => s.results[id] === 'passed', s.energy);
}

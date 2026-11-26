/**
 * Thin Ice, the crossing (docs/design/23-minigames-final.md, section 7), a
 * passing challenge: Minesweeper across a frozen lake, one hiker at a time,
 * from the near shore (below) to the far shore (above). Pure and seeded.
 *
 * - **The board:** cols × rows of ice by tier. Holes are laid after the
 *   routes: first as many separate safe routes as hikers (shore to shore,
 *   8-way steps, sharing no squares), then holes on [12–22]% of the ice,
 *   never on a route.
 * - **Shore numbers:** each near-shore square shows how many holes touch it
 *   in the first ice row, so the first step can be worked out.
 * - **A turn:** stand on a near-shore square; step to a square next to you
 *   (8 ways), which shows its number (a 0 opens the squares around it as
 *   checked, not walked on); test a square exactly [2] away with the ice
 *   pick (a few per hiker), safely; flag squares for free. From the first
 *   ice row, the far shore is a step away: that hiker passes.
 * - **The ice cracks behind each hiker:** every square a hiker walked on is
 *   cracked once their turn ends. Later hikers can't step on it, but its
 *   number stays. Checked squares stay usable.
 * - **Falling in:** that hiker fails with the challenge's stake (Soaked);
 *   the hole stays open and the next hiker starts from the near shore. The
 *   Hiking Stick (Prepare): each hiker's first hole only cracks, and they
 *   stay put.
 * - **No clock** by default; the testing tab can give each hiker one.
 *
 * Squares are numbered row by row, row 0 at the far shore. A position is
 * on the ice (`row` 0 to rows − 1) or on the near shore (`row` = rows).
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import {
  allDone,
  current,
  endTurn,
  newTurns,
  playing,
  tickTurns,
  type Turns,
} from '../quick/turns';
import type { MinigameResult, Pay, Tier } from '../types';

const T = BALANCE.minigames.thinIce;

export interface Pos {
  col: number;
  row: number;
}

export interface ThinIceOptions {
  tier: Tier;
  /** Picks each hiker has ("auto": the tier's). */
  picks?: number | 'auto';
  /** Seconds each hiker has ("auto" or "off": no clock). */
  timeSec?: number | 'auto' | 'off';
  /** Prepare: +1 pick for some hikers, holes marked before the start, the Hiking Stick. */
  extraPicks?: Readonly<Record<string, number>>;
  marked?: number;
  stick?: boolean;
}

export interface ThinIceState {
  tier: Tier;
  cols: number;
  rows: number;
  holes: boolean[];
  /** The safe routes the board was made around, near shore to far (for checking it). */
  routes: number[][];
  /** Squares whose number (or open water) shows. */
  seen: boolean[];
  /** Walked by an earlier hiker: no stepping here again. */
  cracked: boolean[];
  /** Walked by the hiker crossing now, and the squares in the order they walked them. */
  walked: boolean[];
  path: number[];
  /** Each finished hiker's path (drawn in their color). */
  paths: Readonly<Record<string, readonly number[]>>;
  flags: boolean[];
  turns: Turns;
  /** The crossing hiker's place: null until they stand on the shore. */
  at: Pos | null;
  picksLeft: number;
  picksEach: number;
  extraPicks: Readonly<Record<string, number>>;
  /** The Hiking Stick: each hiker's first hole only cracks. Who's used theirs. */
  stick: boolean;
  stickUsed: string[];
  /** Hikers who fell in, and who ran out of time (testing clock). */
  fell: string[];
  timedOut: string[];
  timeSec: number | null;
  timeLeft: number | null;
  /** The last thing that happened, for the screen ("FELL IN", "CRACK!"). */
  last?: {
    kind: 'fell' | 'stick' | 'across' | 'pick' | 'time';
    cell?: number;
    who: string;
    at: number;
  };
  time: number;
  over: boolean;
  rng: RngState;
}

const idx = (s: Pick<ThinIceState, 'cols'>, p: Pos) => p.row * s.cols + p.col;
export const posOf = (s: Pick<ThinIceState, 'cols'>, cell: number): Pos => ({
  col: cell % s.cols,
  row: Math.floor(cell / s.cols),
});

/** The squares around one (up to 8), on the ice. */
export function around(s: Pick<ThinIceState, 'cols' | 'rows'>, cell: number): number[] {
  const { col, row } = posOf(s, cell);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const c = col + dc;
      const r = row + dr;
      if (c >= 0 && c < s.cols && r >= 0 && r < s.rows) out.push(r * s.cols + c);
    }
  return out;
}

/** How many holes touch a square. */
export const count = (s: Pick<ThinIceState, 'cols' | 'rows' | 'holes'>, cell: number): number =>
  around(s, cell).filter((n) => s.holes[n]).length;

/** A near-shore square's number: the holes touching it in the first ice row (the row next to the shore). */
export function shoreCount(s: Pick<ThinIceState, 'cols' | 'rows' | 'holes'>, col: number): number {
  let n = 0;
  for (let dc = -1; dc <= 1; dc++) {
    const c = col + dc;
    if (c >= 0 && c < s.cols && s.holes[(s.rows - 1) * s.cols + c]) n++;
  }
  return n;
}

/** Steps apart (8 ways): 1 is next to, 2 is a pick's reach. */
export const apart = (a: Pos, b: Pos): number =>
  Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));

/**
 * `n` separate routes from the near shore to the far one: one square a row,
 * each a step (8 ways) from the last, kept in left-to-right order so they
 * never share a square or cross.
 */
export function makeRoutes(rng: RngState, cols: number, rows: number, n: number): number[][] {
  const k = Math.max(1, Math.min(n, cols));
  // Starting columns spread across the shore.
  let at = Array.from({ length: k }, (_, i) => Math.floor(((i + 0.5) * cols) / k));
  const routes: number[][] = at.map((c) => [(rows - 1) * cols + c]);
  for (let row = rows - 2; row >= 0; row--) {
    const next: number[] = [];
    for (let i = 0; i < k; i++) {
      const lo = Math.max(0, at[i]! - 1, i === 0 ? 0 : next[i - 1]! + 1);
      const hi = Math.min(cols - 1, at[i]! + 1, cols - (k - i));
      const options = [];
      for (let c = lo; c <= hi; c++) options.push(c);
      const c = options.length ? options[Math.floor(nextFloat(rng) * options.length)]! : lo;
      next.push(c);
      routes[i]!.push(row * cols + c);
    }
    at = next;
  }
  return routes;
}

export function newThinIce(
  options: ThinIceOptions,
  order: readonly string[],
  seed: number,
): ThinIceState {
  const t = T.tiers[options.tier];
  const rng = seedRng(seed);
  const { cols, rows } = t;
  const cells = cols * rows;
  const routes = makeRoutes(rng, cols, rows, order.length);
  const onRoute = new Set(routes.flat());
  const free = shuffle(
    rng,
    Array.from({ length: cells }, (_, i) => i).filter((i) => !onRoute.has(i)),
  );
  const holeSet = new Set(free.slice(0, Math.round(cells * t.holes)));
  const holes = Array.from({ length: cells }, (_, i) => holeSet.has(i));
  // TEST THE ICE (Prepare): some holes are marked as open water before the start.
  const marked = new Set(shuffle(rng, [...holeSet]).slice(0, options.marked ?? 0));
  const picksEach = typeof options.picks === 'number' ? options.picks : t.picks;
  const timeSec = typeof options.timeSec === 'number' ? options.timeSec : null;
  const extraPicks = options.extraPicks ?? {};
  const first = order[0];
  return {
    tier: options.tier,
    cols,
    rows,
    holes,
    routes,
    seen: holes.map((_, i) => marked.has(i)),
    cracked: holes.map(() => false),
    walked: holes.map(() => false),
    path: [],
    paths: {},
    flags: holes.map(() => false),
    turns: newTurns(order),
    at: null,
    picksLeft: picksEach + (first ? (extraPicks[first] ?? 0) : 0),
    picksEach,
    extraPicks,
    stick: options.stick ?? false,
    stickUsed: [],
    fell: [],
    timedOut: [],
    timeSec,
    timeLeft: timeSec,
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The hiker crossing now (or about to, during a hand-off). */
export const crossing = (s: ThinIceState): string | undefined => current(s.turns);

/** The crossing hiker's turn is over: their path cracks, and the next hiker gets their picks. */
function finishTurn(s: ThinIceState, passed: boolean): ThinIceState {
  const who = current(s.turns);
  const turns = endTurn(s.turns, passed);
  const cracked = s.cracked.map((c, i) => c || s.walked[i]!);
  const next = current(turns);
  return {
    ...s,
    turns,
    cracked,
    walked: s.walked.map(() => false),
    path: [],
    paths: who ? { ...s.paths, [who]: s.path } : s.paths,
    at: null,
    picksLeft: s.picksEach + (next ? (s.extraPicks[next] ?? 0) : 0),
    timeLeft: s.timeSec,
    over: allDone(turns),
  };
}

/** Whether the crossing hiker can act now. */
const live = (s: ThinIceState) => !s.over && playing(s.turns);

/** Shows a square's number, and keeps opening around every 0 (checked, not walked on). */
function reveal(s: ThinIceState, cell: number): boolean[] {
  const seen = [...s.seen];
  const queue = [cell];
  while (queue.length) {
    const c = queue.shift()!;
    if (seen[c] && c !== cell) continue;
    if (s.holes[c]) continue;
    seen[c] = true;
    if (count(s, c) === 0) queue.push(...around(s, c).filter((n) => !seen[n] && !s.flags[n]));
  }
  return seen;
}

/** Start a turn: stand on a near-shore square. */
export function stand(s: ThinIceState, col: number): ThinIceState {
  if (!live(s) || s.at || col < 0 || col >= s.cols) return s;
  return { ...s, at: { col, row: s.rows } };
}

/** Whether the crossing hiker could step onto a square now (next to them, not cracked or flagged). */
export function canStep(s: ThinIceState, cell: number): boolean {
  if (!live(s) || !s.at || cell < 0 || cell >= s.holes.length) return false;
  if (s.cracked[cell] || s.flags[cell]) return false;
  if (s.seen[cell] && s.holes[cell]) return false;
  return apart(s.at, posOf(s, cell)) === 1;
}

/**
 * Step onto a square next to you. Safe ice shows its number (a 0 opens the
 * squares around it). A hole: you fall in and your turn ends, unless the
 * Hiking Stick saves you (the first time): the hole shows and you stay put.
 */
export function step(s: ThinIceState, cell: number): ThinIceState {
  if (!canStep(s, cell)) return s;
  const who = crossing(s)!;
  if (s.holes[cell]) {
    const seen = s.seen.map((v, i) => v || i === cell);
    if (s.stick && !s.stickUsed.includes(who)) {
      return {
        ...s,
        seen,
        stickUsed: [...s.stickUsed, who],
        last: { kind: 'stick', cell, who, at: s.time },
      };
    }
    return finishTurn(
      { ...s, seen, fell: [...s.fell, who], last: { kind: 'fell', cell, who, at: s.time } },
      false,
    );
  }
  return {
    ...s,
    at: posOf(s, cell),
    seen: reveal(s, cell),
    walked: s.walked.map((w, i) => w || i === cell),
    path: [...s.path, cell],
  };
}

/** Whether the ice pick can test a square: exactly [2] away, not yet known. */
export function canPick(s: ThinIceState, cell: number): boolean {
  if (!live(s) || !s.at || s.picksLeft <= 0 || cell < 0 || cell >= s.holes.length) return false;
  if (s.seen[cell] || s.cracked[cell]) return false;
  return apart(s.at, posOf(s, cell)) === T.pickReach;
}

/** Test a square with the ice pick, safely: its number shows, or the hole shows as open water. */
export function pick(s: ThinIceState, cell: number): ThinIceState {
  if (!canPick(s, cell)) return s;
  const seen = s.holes[cell] ? s.seen.map((v, i) => v || i === cell) : reveal(s, cell);
  return {
    ...s,
    seen,
    picksLeft: s.picksLeft - 1,
    last: { kind: 'pick', cell, who: crossing(s)!, at: s.time },
  };
}

/** From the first ice row, step onto the far shore: that hiker is across. */
export function cross(s: ThinIceState): ThinIceState {
  if (!live(s) || !s.at || s.at.row !== 0) return s;
  const who = crossing(s)!;
  return finishTurn({ ...s, last: { kind: 'across', who, at: s.time } }, true);
}

/** Flag (or unflag) a square you think is a hole. Free. */
export function toggleFlag(s: ThinIceState, cell: number): ThinIceState {
  if (s.over || cell < 0 || cell >= s.flags.length || s.seen[cell] || s.cracked[cell]) return s;
  return { ...s, flags: s.flags.map((f, i) => (i === cell ? !f : f)) };
}

export function tick(s0: ThinIceState, dt: number): ThinIceState {
  if (s0.over) return s0;
  const s: ThinIceState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns) || s.timeLeft === null) return s;
  const timeLeft = s.timeLeft - dt;
  if (timeLeft > 0) return { ...s, timeLeft };
  // The testing clock ran out: that hiker fails.
  const who = crossing(s)!;
  return finishTurn(
    { ...s, timedOut: [...s.timedOut, who], last: { kind: 'time', who, at: s.time } },
    false,
  );
}

/** Hikers who made it across pass. Falling in brings the stake (Soaked); running out of time costs [1] energy. */
export function result(s: ThinIceState): MinigameResult {
  const passed = s.turns.order.filter((id) => s.turns.done[id] === true);
  const costs: Record<string, Pay> = {};
  for (const id of s.fell) costs[id] = { conditions: [T.fallCondition] };
  for (const id of s.timedOut) costs[id] = { energy: BALANCE.minigames.quick.failEnergy };
  return passingResult(s.turns.order, s.tier, passed, costs);
}

/** The squares in a route are a real crossing: shore to shore, a step apart, no holes. */
export function isRoute(
  s: Pick<ThinIceState, 'cols' | 'rows' | 'holes'>,
  route: readonly number[],
): boolean {
  if (!route.length) return false;
  const first = posOf(s, route[0]!);
  const last = posOf(s, route.at(-1)!);
  if (first.row !== s.rows - 1 || last.row !== 0) return false;
  return route.every(
    (c, k) => !s.holes[c] && (k === 0 || apart(posOf(s, route[k - 1]!), posOf(s, c)) === 1),
  );
}

export { idx as cellAt };

/**
 * Trail Map (docs/design/13-minigames-puzzles-2.md, section 1): turn trail
 * tiles to connect each hiker's trailhead to the exit. Pure and seeded.
 *
 * - **Pieces:** dead end, straight, corner, tee and cross. Each tile has a
 *   turn (0 to 3, clockwise); its openings follow from its piece and turn.
 * - **Making a board:** pick the exit and the trailheads (one per hiker, on
 *   other sides when that can be done), and from Tier II the trail signs
 *   (never on a trailhead's or the exit's tile). Walk the first hiker's
 *   solution trail from their trailhead through every sign to the exit,
 *   never repeating a tile; then each other hiker's (a later trail may end
 *   where it meets an earlier one). Give each trail tile the piece its
 *   openings need; fill the rest at random; turn everything at random until
 *   no trailhead starts connected. From Tier II a few solution tiles are
 *   locked, turned right.
 * - **Lighting:** from each trailhead, through tiles whose openings face
 *   each other on both sides. A trail reaching the exit tile, open toward
 *   the exit, is connected. A sign is reached when its tile is lit.
 * - **Passing (Nov 25):** everyone passes when every trailhead is connected
 *   and every sign is reached, at the same moment. When time runs out
 *   first, everyone fails.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng, shuffle, weightedPick } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Tier } from '../types';

const T = BALANCE.minigames.trailMap;

export type { Tier };
export type Piece = 'end' | 'straight' | 'corner' | 'tee' | 'cross';

/** The four directions as bits: north (up), east, south, west. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const DIRS: readonly number[] = [N, E, S, W];
const STEP: Readonly<Record<number, { dc: number; dr: number }>> = {
  [N]: { dc: 0, dr: -1 },
  [E]: { dc: 1, dr: 0 },
  [S]: { dc: 0, dr: 1 },
  [W]: { dc: -1, dr: 0 },
};
const OPPOSITE: Readonly<Record<number, number>> = { [N]: S, [E]: W, [S]: N, [W]: E };

/** Each piece's openings at turn 0, as drawn in art/trail-map (dead end opens north). */
export const BASE: Readonly<Record<Piece, number>> = {
  end: N,
  straight: N | S,
  corner: N | E,
  tee: N | E | S,
  cross: N | E | S | W,
};

/** Openings turned clockwise a number of quarter turns. */
export function turnMask(mask: number, turns: number): number {
  let m = mask;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

const bits = (m: number) => DIRS.filter((d) => m & d).length;

/** The piece whose openings can be turned to exactly `mask`, and that turn. */
export function pieceFor(mask: number): { piece: Piece; turn: number } {
  const count = bits(mask);
  const piece: Piece =
    count === 1
      ? 'end'
      : count === 3
        ? 'tee'
        : count === 4
          ? 'cross'
          : mask === (N | S) || mask === (E | W)
            ? 'straight'
            : 'corner';
  const turn = [0, 1, 2, 3].find((t) => turnMask(BASE[piece], t) === mask) ?? 0;
  return { piece, turn };
}

export interface Tile {
  piece: Piece;
  turn: number;
  /** Can't be turned (shown with a stake); always in its solved turn. */
  locked?: true;
  /** On a solution trail: the openings it needs. */
  needs?: number;
}

/** Where a tile's openings face now. */
export const openings = (t: Tile): number => turnMask(BASE[t.piece], t.turn);

/** Whether a tile is turned the way its trail needs (any turn works for tiles off the trails). */
export const solved = (t: Tile): boolean => t.needs === undefined || openings(t) === t.needs;

export type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];
const SIDE_DIR: Readonly<Record<Side, number>> = { top: N, right: E, bottom: S, left: W };

/** A gap in the board's edge: a trailhead or the exit. `index` runs along the side. */
export interface Gate {
  side: Side;
  index: number;
}

/** The tile next to a gate. */
export function gateCell(g: Gate, size: number): { c: number; r: number } {
  switch (g.side) {
    case 'top':
      return { c: g.index, r: 0 };
    case 'bottom':
      return { c: g.index, r: size - 1 };
    case 'left':
      return { c: 0, r: g.index };
    case 'right':
      return { c: size - 1, r: g.index };
  }
}

/** The direction from a gate's tile out through the gate. */
export const gateDir = (g: Gate): number => SIDE_DIR[g.side];

export interface TrailMapState {
  tier: Tier;
  size: number;
  /** Row by row, from the top-left. */
  tiles: Tile[];
  exit: Gate;
  /** Each hiker's trailhead. */
  heads: Record<string, Gate>;
  /** The trail signs' tiles: every one must be reached, along with the exit. */
  signs: number[];
  order: string[];
  /** Hikers who are through (passed): everyone at once, or nobody. */
  through: Record<string, true>;
  /** Seconds to play, or none (Off). */
  timeSec: number | null;
  over: boolean;
}

const at = (size: number, c: number, r: number) => r * size + c;

/**
 * A solution trail: a walk from one tile to another that never repeats a
 * tile or steps on a `blocked` one, leaning toward the target, backtracking
 * when stuck. It may stop early on a tile of an earlier trail (`joinable`).
 */
function walkTrail(
  rng: RngState,
  size: number,
  from: number,
  to: number,
  joinable: ReadonlySet<number>,
  blocked: ReadonlySet<number> = new Set(),
): number[] {
  const target = { c: to % size, r: Math.floor(to / size) };
  const path: number[] = [from];
  const used = new Set([from]);
  const tried = new Map<number, number[]>();
  for (let guard = 0; guard < 20000 && path.length; guard++) {
    const here = path.at(-1)!;
    if (here === to || (here !== from && joinable.has(here))) return path;
    if (!tried.has(here)) {
      const c = here % size;
      const r = Math.floor(here / size);
      const next = DIRS.map((d) => ({ c: c + STEP[d]!.dc, r: r + STEP[d]!.dr }))
        .filter((p) => p.c >= 0 && p.c < size && p.r >= 0 && p.r < size)
        .filter((p) => !blocked.has(at(size, p.c, p.r)))
        .map((p) => ({
          cell: at(size, p.c, p.r),
          // Toward the exit, mostly, with enough wander to bend.
          key: Math.abs(p.c - target.c) + Math.abs(p.r - target.r) + nextFloat(rng) * 2.5,
        }))
        .sort((a, b) => a.key - b.key)
        .map((n) => n.cell);
      tried.set(here, next);
    }
    const options = tried.get(here)!;
    const step = options.find((cell) => !used.has(cell));
    if (step === undefined) {
      used.delete(path.pop()!);
      tried.delete(here);
      // Keep it marked as visited for this branch so we don't loop.
      used.add(here);
      continue;
    }
    options.splice(options.indexOf(step), 1);
    path.push(step);
    used.add(step);
  }
  return [];
}

/** Which trailheads are connected to the exit now, and every tile lit from any trailhead. */
export function lighting(s: Pick<TrailMapState, 'size' | 'tiles' | 'exit' | 'heads'>): {
  lit: Set<number>;
  connected: Set<string>;
  litBy: Record<string, Set<number>>;
} {
  const lit = new Set<number>();
  const connected = new Set<string>();
  const litBy: Record<string, Set<number>> = {};
  const exitCell = gateCell(s.exit, s.size);
  const exitAt = at(s.size, exitCell.c, exitCell.r);
  for (const [id, head] of Object.entries(s.heads)) {
    const seen = new Set<number>();
    const start = gateCell(head, s.size);
    const first = at(s.size, start.c, start.r);
    if (openings(s.tiles[first]!) & gateDir(head)) {
      const queue = [first];
      seen.add(first);
      while (queue.length) {
        const cell = queue.shift()!;
        const open = openings(s.tiles[cell]!);
        const c = cell % s.size;
        const r = Math.floor(cell / s.size);
        for (const d of DIRS) {
          if (!(open & d)) continue;
          const nc = c + STEP[d]!.dc;
          const nr = r + STEP[d]!.dr;
          if (nc < 0 || nc >= s.size || nr < 0 || nr >= s.size) continue;
          const next = at(s.size, nc, nr);
          if (seen.has(next) || !(openings(s.tiles[next]!) & OPPOSITE[d]!)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
    }
    litBy[id] = seen;
    for (const cell of seen) lit.add(cell);
    if (seen.has(exitAt) && openings(s.tiles[exitAt]!) & gateDir(s.exit)) connected.add(id);
  }
  return { lit, connected, litBy };
}

export interface TrailMapOptions {
  tier: Tier;
  /** Grid size and signs (Auto: the tier's), and time (Auto, off, or seconds). */
  size?: 'auto' | number;
  time?: 'auto' | 'off' | number;
  signs?: 'auto' | number;
}

export function newTrailMap(
  options: TrailMapOptions,
  order: readonly string[],
  seed: number,
): TrailMapState {
  const rng = seedRng(seed);
  const tier = T.tiers[options.tier];
  const size = typeof options.size === 'number' ? options.size : tier.size;
  const timeSec =
    options.time === 'off'
      ? null
      : typeof options.time === 'number'
        ? options.time
        : tier.timeSec + T.extraSecPerHiker * Math.max(0, order.length - 1);
  const wanted = Math.max(
    0,
    Math.round(typeof options.signs === 'number' ? options.signs : tier.signs),
  );

  // If the signs can't all fit on one trail, try again with one fewer.
  for (let signs = wanted; signs >= 0; signs--) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const board = makeBoard(rng, size, order, tier.locked, signs);
      if (board) {
        return {
          tier: options.tier,
          size,
          ...board,
          order: [...order],
          through: {},
          timeSec,
          over: order.length === 0,
        };
      }
    }
  }
  throw new Error('Trail Map: no board could be made');
}

function makeBoard(
  rng: RngState,
  size: number,
  order: readonly string[],
  lockedCount: number,
  signCount: number,
): Pick<TrailMapState, 'tiles' | 'exit' | 'heads' | 'signs'> | null {
  // The exit, then the trailheads on the other sides (all on different tiles).
  const exit: Gate = { side: SIDES[int(rng, 0, 3)]!, index: int(rng, 0, size - 1) };
  const exitCell = gateCell(exit, size);
  const taken = new Set([at(size, exitCell.c, exitCell.r)]);
  const heads: Record<string, Gate> = {};
  const spots = shuffle(
    rng,
    SIDES.flatMap((side) => Array.from({ length: size }, (_, index) => ({ side, index }))),
  );
  const pick = (sameSideOk: boolean) =>
    spots.find((g) => {
      const cell = gateCell(g, size);
      return (sameSideOk || g.side !== exit.side) && !taken.has(at(size, cell.c, cell.r));
    });
  for (const id of order) {
    const g = pick(false) ?? pick(true);
    if (!g) return null;
    const cell = gateCell(g, size);
    taken.add(at(size, cell.c, cell.r));
    heads[id] = g;
  }

  // The trail signs: never on a trailhead's tile or the exit's.
  const signs = shuffle(
    rng,
    Array.from({ length: size * size }, (_, cell) => cell).filter((cell) => !taken.has(cell)),
  ).slice(0, signCount);
  if (signs.length < signCount) return null;

  // The solution trails, and the openings each of their tiles needs.
  const needs = new Map<number, number>();
  const add = (cell: number, d: number) => needs.set(cell, (needs.get(cell) ?? 0) | d);
  const exitAt = at(size, exitCell.c, exitCell.r);
  add(exitAt, gateDir(exit));
  const onTrail = new Set<number>();
  const trails: number[][] = [];
  for (const [k, id] of order.entries()) {
    const head = heads[id]!;
    const start = gateCell(head, size);
    const from = at(size, start.c, start.r);
    // The first hiker's trail goes through every sign on its way: one leg at a time, never
    // stepping on a tile it already used, a sign it hasn't reached yet, or the exit too early.
    let path: number[];
    if (k === 0) {
      const stops = [...signs, exitAt];
      path = [from];
      for (const [s, stop] of stops.entries()) {
        const blocked = new Set([...path.slice(0, -1), ...stops.filter((_, j) => j !== s)]);
        const leg = walkTrail(rng, size, path.at(-1)!, stop, new Set(), blocked);
        if (leg.length < 2) return null;
        path.push(...leg.slice(1));
      }
    } else {
      path = walkTrail(rng, size, from, exitAt, onTrail);
    }
    if (path.length < 2) return null;
    add(from, gateDir(head));
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      const d = DIRS.find(
        (dir) =>
          (a % size) + STEP[dir]!.dc === b % size &&
          Math.floor(a / size) + STEP[dir]!.dr === Math.floor(b / size),
      )!;
      add(a, d);
      add(b, OPPOSITE[d]!);
    }
    for (const cell of path) onTrail.add(cell);
    trails.push(path);
  }

  // Trail tiles get the piece their openings need; the rest are random.
  const fill = Object.entries(T.fill).map(([item, weight]) => ({ item: item as Piece, weight }));
  const tiles: Tile[] = Array.from({ length: size * size }, (_, cell) => {
    const need = needs.get(cell);
    if (need !== undefined) {
      const { piece } = pieceFor(need);
      return { piece, turn: 0, needs: need };
    }
    return { piece: weightedPick(rng, fill), turn: 0 };
  });

  // A few solution tiles locked in their right turn, never leaving a trail without one to turn.
  const turnable = (cell: number) => tiles[cell]!.piece !== 'cross';
  const candidates = shuffle(rng, [...onTrail]);
  let locked = new Set<number>();
  for (let tries = 0; tries < 30; tries++) {
    locked = new Set(candidates.slice(0, Math.min(lockedCount, candidates.length)));
    const ok = trails.every((path) => path.some((cell) => !locked.has(cell) && turnable(cell)));
    if (ok) break;
    candidates.push(candidates.shift()!);
  }
  for (const cell of locked) {
    const t = tiles[cell]!;
    tiles[cell] = { ...t, turn: pieceFor(t.needs!).turn, locked: true };
  }

  // Scramble every other tile; again while any trailhead starts connected.
  const scramble = () => {
    for (let cell = 0; cell < tiles.length; cell++) {
      if (!locked.has(cell)) tiles[cell] = { ...tiles[cell]!, turn: int(rng, 0, 3) };
    }
  };
  scramble();
  for (let tries = 0; tries < 100; tries++) {
    if (lighting({ size, tiles, exit, heads }).connected.size === 0) break;
    scramble();
  }
  // Still connected (very rare): turn one tile of each connected trail the wrong way.
  for (const id of lighting({ size, tiles, exit, heads }).connected) {
    const path = trails[order.indexOf(id)]!;
    const cell = path.find((c) => !locked.has(c) && turnable(c));
    if (cell === undefined) return null;
    const t = tiles[cell]!;
    const wrong = [1, 2, 3].map((k) => (t.turn + k) % 4).find((turn) => !solved({ ...t, turn }));
    if (wrong === undefined) return null;
    tiles[cell] = { ...t, turn: wrong };
  }
  if (lighting({ size, tiles, exit, heads }).connected.size > 0) return null;
  return { tiles, exit, heads, signs };
}

/** Which signs are reached now (their tiles lit from a trailhead). */
export function signsReached(
  s: Pick<TrailMapState, 'size' | 'tiles' | 'exit' | 'heads' | 'signs'>,
): number[] {
  const { lit } = lighting(s);
  return s.signs.filter((cell) => lit.has(cell));
}

/** Whether every trailhead is connected and every sign reached, right now. */
export function allConnected(s: TrailMapState): boolean {
  const { lit, connected } = lighting(s);
  return s.order.every((id) => connected.has(id)) && s.signs.every((cell) => lit.has(cell));
}

/**
 * Turns a tile a quarter turn (1 clockwise, −1 the other way), unless it's
 * locked or the game is over. When every trailhead is connected and every
 * sign reached, everyone is through and it's over.
 */
export function turn(s: TrailMapState, cell: number, dir: 1 | -1 = 1): TrailMapState {
  const t = s.tiles[cell];
  if (!t || t.locked || s.over) return s;
  const tiles = s.tiles.map((x, i) => (i === cell ? { ...x, turn: (x.turn + dir + 4) % 4 } : x));
  const next = { ...s, tiles };
  if (!allConnected(next)) return next;
  const through = Object.fromEntries(s.order.map((id) => [id, true as const]));
  return { ...next, through, over: true };
}

/** Time's up: it's over, and whoever isn't through fails. */
export const timeUp = (s: TrailMapState): TrailMapState => (s.over ? s : { ...s, over: true });

export function result(s: TrailMapState): MinigameResult {
  return passFailResult(s.order, (id) => !!s.through[id]);
}

/** The tiles of a hiker's lit trail, in walking order from the trailhead (for the token's walk). */
export function trailOrder(s: TrailMapState, id: string): number[] {
  const head = s.heads[id];
  if (!head) return [];
  const { litBy } = lighting(s);
  const lit = litBy[id] ?? new Set<number>();
  const start = gateCell(head, s.size);
  const first = at(s.size, start.c, start.r);
  const exitCell = gateCell(s.exit, s.size);
  const exitAt = at(s.size, exitCell.c, exitCell.r);
  // A breadth-first route through the lit tiles to the exit.
  const prev = new Map<number, number>([[first, -1]]);
  const queue = [first];
  while (queue.length) {
    const cell = queue.shift()!;
    if (cell === exitAt) break;
    const open = openings(s.tiles[cell]!);
    for (const d of DIRS) {
      if (!(open & d)) continue;
      const nc = (cell % s.size) + STEP[d]!.dc;
      const nr = Math.floor(cell / s.size) + STEP[d]!.dr;
      if (nc < 0 || nc >= s.size || nr < 0 || nr >= s.size) continue;
      const next = at(s.size, nc, nr);
      if (!lit.has(next) || prev.has(next) || !(openings(s.tiles[next]!) & OPPOSITE[d]!)) continue;
      prev.set(next, cell);
      queue.push(next);
    }
  }
  if (!prev.has(exitAt)) return [];
  const route: number[] = [];
  for (let c = exitAt; c !== -1; c = prev.get(c)!) route.unshift(c);
  return route;
}

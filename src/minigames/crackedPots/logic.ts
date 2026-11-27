/**
 * Cracked Pots (docs/design/24-challenges-reset.md, section 7; mockup
 * 55-cracked-pots.png): Picture Puzzle with shards of pot instead of squares.
 *
 * - **Pairs:** hikers play in pairs in line order, as in Picture Puzzle.
 *   Each hiker has their own pot; a pair shares one blanket of shards.
 * - **The pot** is broken like a real break: seeded points in the pot, and
 *   each pixel goes to the nearest one, so every shard has its own shape
 *   ([6–14] by tier). A shard that came out in two bits is joined to its
 *   neighbor, so every shard is one piece.
 * - **Placing:** drag a shard to its spot; dropped within [6] of it, it
 *   snaps in and locks. Anywhere else, it goes back to the blanket. No
 *   turning: the shapes are the puzzle.
 * - **The clock:** seconds per shard × the round's shards, plus a little
 *   each time a shard snaps in. A whole pot in time passes its hiker;
 *   unfinished pots fail when the clock runs out.
 *
 * Pure and seeded. Positions are scene units (320 × 240): a pot pixel is one unit.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Tier } from '../types';
import { POT_MASKS, type PotMask } from './masks';

const C = BALANCE.minigames.crackedPots;

export interface Point {
  x: number;
  y: number;
}

export interface Shard {
  id: number;
  /** Which of the round's pots (0 or 1) it's from, and that pot's hiker. */
  pot: number;
  owner: string;
  /** Its box in the pot's pixels. */
  x0: number;
  y0: number;
  w: number;
  h: number;
  cells: number;
  /** Where its top-left goes (on the screen), where it lies on the blanket, and where it is now. */
  home: Point;
  spot: Point;
  at: Point;
  placed: boolean;
  /** The shards it shares an edge with, and whether it touches the pot's rim. */
  touches: number[];
  rim: boolean;
}

export interface Pot {
  owner: string;
  /** Which picture (pot-1 to pot-3), and its top-left on the screen. */
  image: number;
  origin: Point;
  /** Each pixel's shard id (−1 outside the pot), row by row. */
  map: number[];
  width: number;
  height: number;
  done: boolean;
}

export interface CrackedPotsOptions {
  tier: Tier;
  /** Testing: shards per pot ("auto": the tier's); crack lines (auto: up to Tier I). */
  shards?: number | 'auto';
  cracks?: 'auto' | 'on' | 'off';
  /** Prepare: more time each round; shards of each pot glued in place before the start. */
  extraSec?: number;
  glued?: number;
}

export type CrackedPhase = 'play' | 'between' | 'over';

export interface CrackedPotsState {
  tier: Tier;
  order: readonly string[];
  rounds: string[][];
  round: number;
  shardsPerPot: number;
  cracks: boolean;
  extraSec: number;
  glued: number;
  pots: Pot[];
  shards: Shard[];
  timeSec: number;
  timeLeft: number;
  phase: CrackedPhase;
  breakLeft: number;
  results: Record<string, 'passed' | 'failed'>;
  /** The last drop, for the screen: snapped in, or back to the blanket. */
  lastDrop: { id: number; snapped: boolean; at: number } | null;
  time: number;
  over: boolean;
  rng: RngState;
}

const num = (v: number | 'auto' | undefined, auto: number) => (typeof v === 'number' ? v : auto);

/** Pairs in line order (1 and 2, then 3 and 4; an odd one out plays alone). */
export const pairsOf = (order: readonly string[]): string[][] =>
  Array.from({ length: Math.ceil(order.length / 2) }, (_, i) => order.slice(i * 2, i * 2 + 2));

/** The pot pixels of a mask, as [x, y]. */
function potPixels(mask: PotMask): [number, number][] {
  const out: [number, number][] = [];
  mask.rows.forEach((spans, y) => {
    for (const [a, b] of spans) for (let x = a; x < b; x++) out.push([x, y]);
  });
  return out;
}

/**
 * Breaks a pot: `n` seeded points spread through it, and each pixel goes to
 * the nearest. Bits of a shard cut off from the rest join the neighbor
 * they touch most, so every shard is one piece. Returns each pixel's shard
 * (−1 outside), shards numbered 0 to n − 1.
 */
export function cutPot(mask: PotMask, n: number, rng: RngState): number[] {
  const { width: w, height: h } = mask;
  const pixels = potPixels(mask);
  const area = pixels.length;
  let apart = C.apart * Math.sqrt(area / n);
  const points: [number, number][] = [];
  for (let tries = 0; points.length < n && tries < 4000; tries++) {
    const [x, y] = pixels[Math.floor(nextFloat(rng) * pixels.length)]!;
    if (points.every(([px, py]) => Math.hypot(px - x, py - y) >= apart)) points.push([x, y]);
    if (tries % 400 === 399) apart *= 0.85;
  }
  const map = new Array<number>(w * h).fill(-1);
  for (const [x, y] of pixels) {
    let best = 0;
    let bestD = Infinity;
    points.forEach(([px, py], k) => {
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    map[y * w + x] = best;
  }
  joinStrays(map, w, h);
  return map;
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Joins each shard's smaller bits to the neighbor they touch most. */
function joinStrays(map: number[], w: number, h: number): void {
  const seen = new Uint8Array(w * h);
  const parts = new Map<number, number[][]>();
  for (let i = 0; i < map.length; i++) {
    if (map[i]! < 0 || seen[i]) continue;
    const id = map[i]!;
    const part: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      part.push(c);
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (const [dx, dy] of NEIGHBORS) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x;
        if (!seen[j] && map[j] === id) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    parts.set(id, [...(parts.get(id) ?? []), part]);
  }
  for (const list of parts.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => b.length - a.length);
    for (const bit of list.slice(1)) {
      const votes = new Map<number, number>();
      for (const c of bit) {
        const cx = c % w;
        const cy = Math.floor(c / w);
        for (const [dx, dy] of NEIGHBORS) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const other = map[y * w + x]!;
          if (other >= 0 && other !== map[c]) votes.set(other, (votes.get(other) ?? 0) + 1);
        }
      }
      const to = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (to !== undefined) for (const c of bit) map[c] = to;
    }
  }
}

/** The shards of a cut pot: boxes, sizes, neighbors and the rim. */
function shardsOf(map: number[], w: number, h: number) {
  const out = new Map<
    number,
    {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      cells: number;
      touches: Set<number>;
      rim: boolean;
    }
  >();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = map[y * w + x]!;
      if (id < 0) continue;
      const s = out.get(id) ?? {
        x0: x,
        y0: y,
        x1: x + 1,
        y1: y + 1,
        cells: 0,
        touches: new Set<number>(),
        rim: false,
      };
      s.x0 = Math.min(s.x0, x);
      s.y0 = Math.min(s.y0, y);
      s.x1 = Math.max(s.x1, x + 1);
      s.y1 = Math.max(s.y1, y + 1);
      s.cells++;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        const other = nx < 0 || ny < 0 || nx >= w || ny >= h ? -1 : map[ny * w + nx]!;
        if (other < 0) s.rim = true;
        else if (other !== id) s.touches.add(other);
      }
      out.set(id, s);
    }
  }
  return out;
}

/** Lays the round's shards out on the blanket: a loose grid, shuffled, each a little off center. */
function scatter(shards: Shard[], rng: RngState): void {
  const b = C.blanket;
  const order = shuffle(rng, shards);
  const cols = 3;
  const rows = Math.max(1, Math.ceil(order.length / cols));
  const cw = (b.right - b.left) / cols;
  const ch = (b.bottom - b.top) / rows;
  order.forEach((s, k) => {
    const cx = b.left + cw * ((k % cols) + 0.5) + (nextFloat(rng) - 0.5) * 6;
    const cy = b.top + ch * (Math.floor(k / cols) + 0.5) + (nextFloat(rng) - 0.5) * 6;
    const x = Math.max(b.left, Math.min(b.right - s.w, cx - s.w / 2));
    const y = Math.max(b.top, Math.min(b.bottom - s.h, cy - s.h / 2));
    s.spot = { x, y };
    s.at = { x, y };
  });
}

/** The round's two (or one) pots and their shards, cut and scattered. */
function startRound(s0: CrackedPotsState, round: number): CrackedPotsState {
  const who = s0.rounds[round];
  if (!who) return { ...s0, phase: 'over', over: true };
  const rng: RngState = [...s0.rng];
  const images = shuffle(
    rng,
    POT_MASKS.map((_, k) => k),
  );
  const pots: Pot[] = [];
  const shards: Shard[] = [];
  who.forEach((owner, k) => {
    const image = images[k % images.length]!;
    const mask = POT_MASKS[image]!;
    const origin = C.pots[k]!;
    const local = cutPot(mask, s0.shardsPerPot, rng);
    const found = shardsOf(local, mask.width, mask.height);
    // Shard ids: unique across the round.
    const base = shards.length;
    const ids = [...found.keys()].sort((a, b) => a - b);
    const idOf = new Map(ids.map((id, j) => [id, base + j]));
    const map = local.map((v) => (v < 0 ? -1 : idOf.get(v)!));
    for (const id of ids) {
      const f = found.get(id)!;
      const home = { x: origin.x + f.x0, y: origin.y + f.y0 };
      shards.push({
        id: idOf.get(id)!,
        pot: k,
        owner,
        x0: f.x0,
        y0: f.y0,
        w: f.x1 - f.x0,
        h: f.y1 - f.y0,
        cells: f.cells,
        home,
        spot: home,
        at: home,
        placed: false,
        touches: [...f.touches].map((t) => idOf.get(t)!).sort((a, b) => a - b),
        rim: f.rim,
      });
    }
    pots.push({
      owner,
      image,
      origin: { ...origin },
      map,
      width: mask.width,
      height: mask.height,
      done: false,
    });
  });
  scatter(shards, rng);
  // GLUE: shards of each pot in place before the start.
  for (let g = 0; g < s0.glued; g++) {
    for (let k = 0; k < pots.length; k++) {
      const loose = shards.filter((x) => x.pot === k && !x.placed);
      if (loose.length <= 1) continue;
      const pickOne = loose[Math.floor(nextFloat(rng) * loose.length)]!;
      pickOne.placed = true;
      pickOne.at = pickOne.home;
    }
  }
  const t = C.tiers[s0.tier];
  const timeSec = t.secPerShard * shards.length + s0.extraSec;
  return {
    ...s0,
    round,
    pots,
    shards,
    timeSec,
    timeLeft: timeSec,
    phase: 'play',
    breakLeft: 0,
    lastDrop: null,
    rng,
  };
}

export function newCrackedPots(
  options: CrackedPotsOptions,
  order: readonly string[],
  seed: number,
): CrackedPotsState {
  const t = C.tiers[options.tier];
  const s: CrackedPotsState = {
    tier: options.tier,
    order,
    rounds: pairsOf(order),
    round: 0,
    shardsPerPot: Math.max(2, num(options.shards, t.shards)),
    cracks:
      options.cracks === 'on'
        ? true
        : options.cracks === 'off'
          ? false
          : options.tier <= C.cracksUpTo,
    extraSec: options.extraSec ?? 0,
    glued: options.glued ?? 0,
    pots: [],
    shards: [],
    timeSec: 0,
    timeLeft: 0,
    phase: 'play',
    breakLeft: 0,
    results: {},
    lastDrop: null,
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
  return s.over ? { ...s, phase: 'over' } : startRound(s, 0);
}

/** The hikers playing this round. */
export const playing = (s: CrackedPotsState): string[] => s.rounds[s.round] ?? [];

/** Ends the round: whole pots pass, the rest fail; then a short break. */
function endRound(s: CrackedPotsState): CrackedPotsState {
  const results = { ...s.results };
  for (const p of s.pots) results[p.owner] = p.done ? 'passed' : 'failed';
  return { ...s, results, phase: 'between', breakLeft: C.breakSec };
}

/**
 * A shard dropped with its top-left at `at`: within [6] of its spot it snaps
 * in and locks (the clock gains a little); anywhere else it goes back to its
 * place on the blanket. A whole pot passes its hiker; both done ends the round.
 */
export function drop(s0: CrackedPotsState, id: number, at: Point): CrackedPotsState {
  if (s0.phase !== 'play' || s0.over) return s0;
  const shard = s0.shards.find((x) => x.id === id);
  if (!shard || shard.placed) return s0;
  const snapped = Math.hypot(at.x - shard.home.x, at.y - shard.home.y) <= C.snap;
  const shards = s0.shards.map((x) =>
    x.id !== id ? x : snapped ? { ...x, placed: true, at: x.home } : { ...x, at: x.spot },
  );
  let s: CrackedPotsState = {
    ...s0,
    shards,
    lastDrop: { id, snapped, at: s0.time },
    timeLeft: s0.timeLeft + (snapped ? C.tiers[s0.tier].snapSec : 0),
  };
  if (!snapped) return s;
  const pots = s.pots.map((p, k) =>
    p.done ? p : { ...p, done: shards.every((x) => x.pot !== k || x.placed) },
  );
  const results = { ...s.results };
  for (const p of pots) if (p.done) results[p.owner] = 'passed';
  s = { ...s, pots, results };
  return pots.every((p) => p.done) ? endRound(s) : s;
}

export function tick(s: CrackedPotsState, dt: number): CrackedPotsState {
  if (s.over) return s;
  const time = s.time + dt;
  if (s.phase === 'between') {
    const breakLeft = s.breakLeft - dt;
    if (breakLeft > 0) return { ...s, time, breakLeft };
    return startRound({ ...s, time }, s.round + 1);
  }
  const timeLeft = s.timeLeft - dt;
  if (timeLeft > 0) return { ...s, time, timeLeft };
  return endRound({ ...s, time, timeLeft: 0 });
}

export const placedOf = (s: Pick<CrackedPotsState, 'shards'>, owner: string): number =>
  s.shards.filter((x) => x.owner === owner && x.placed).length;

export function result(s: CrackedPotsState): MinigameResult {
  return passFailResult(s.order, (id) => s.results[id] === 'passed');
}

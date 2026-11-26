/**
 * Crossing (docs/design/17-minigames-lanes.md, section 1): Frogger, top-down,
 * one game for Road, River and Critter Crossing, and Mixed (road at the
 * bottom, a safe bank, river at the top). Pure and seeded, in small steps.
 *
 * - **The board:** 16-unit rows across the whole width: the start (grass)
 *   at the bottom, the lanes, and the goal (grass, with a TRAIL sign) at the
 *   top. Each lane moves one way at one speed, the directions alternating,
 *   and always has gaps a hiker can use.
 * - **One hiker at a time,** in line order. Each press hops one tile.
 * - **Hits:** a vehicle or a critter, landing in the water, riding a log or
 *   a turtle off the screen's edge, or standing on a turtle as it dives; and
 *   running out of the attempt's time. A hit costs a life and sends the
 *   hiker back to the start and to the back of the line (Wyatt's rule); the
 *   next hiker goes. A hiker with no lives left is out.
 * - **The end:** when everyone is across or out. A passing challenge: hikers
 *   across move on; hikers out stay back and lose energy.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import type { MinigameResult, Pay, Tier } from '../types';

const C = BALANCE.minigames.crossing;

export type { Tier };
export type CrossingVersion = 'road' | 'river' | 'critter' | 'mixed';
export type LaneKind = 'road' | 'river' | 'critter' | 'bank';
export type ThingKind =
  'car' | 'truck' | 'rv' | 'logger' | 'log' | 'turtles' | 'deer' | 'turkey' | 'raccoon' | 'rabbit';
export type Dir = 'up' | 'down' | 'left' | 'right';

export const VERSIONS: readonly { id: CrossingVersion; name: string; hud: string }[] = [
  { id: 'road', name: 'Road Crossing', hud: 'Road crossing' },
  { id: 'river', name: 'River Crossing', hud: 'River crossing' },
  { id: 'critter', name: 'Critter Crossing', hud: 'Critter crossing' },
  { id: 'mixed', name: 'Mixed', hud: 'River crossing' },
];

/** How wide each thing is (the art's): vehicles, critters; logs and turtles go by pieces. */
export const WIDTH: Readonly<Record<Exclude<ThingKind, 'log' | 'turtles'>, number>> = {
  car: 30,
  truck: 40,
  rv: 52,
  logger: 68,
  deer: 30,
  turkey: 20,
  raccoon: 22,
  rabbit: 14,
};

/** Something in a lane: its left edge, width, pieces (logs and turtles), and a diving turtle group's or a stopping critter's timing. */
export interface Thing {
  kind: ThingKind;
  x: number;
  w: number;
  pieces?: number;
  /** A diving turtle group: where it starts in the dive cycle (seconds). */
  dive?: number;
  /** A critter that stops now and then: stopped until, and the next stop. */
  stopUntil?: number;
  nextStop?: number;
}

export interface Lane {
  kind: LaneKind;
  dir: 1 | -1;
  speed: number;
  /** How long the lane's loop is: things leave one side and come back on the other. */
  span: number;
  things: Thing[];
}

export type HikerStatus = 'waiting' | 'crossing' | 'across' | 'out';

export interface Hop {
  fromX: number;
  fromRow: number;
  toX: number;
  toRow: number;
  at: number;
}

export interface CrossingState {
  /** The version played (Mixed below its tier plays Road). */
  version: CrossingVersion;
  tier: Tier;
  order: string[];
  /** Who goes next: the one crossing first, then the rest in order. */
  line: string[];
  lives: Record<string, number>;
  maxLives: number;
  /** Each hiker's lives at the start (Prepare's +1 LIFE adds to one hiker's). */
  startLives: Record<string, number>;
  status: Record<string, HikerStatus>;
  /** The lanes, bottom to top (lane k is row k + 1); row 0 is the start, the last row the goal. */
  lanes: Lane[];
  rows: number;
  /** The hiker crossing: their middle (x) and row, and a hop on its way. */
  x: number;
  row: number;
  hop?: Hop;
  attemptSec: number;
  attemptLeft: number;
  /** After a hit, the next hiker waits until this time. */
  pauseUntil: number;
  lastHit?: { id: string; at: number; why: 'hit' | 'water' | 'edge' | 'time' };
  time: number;
  over: boolean;
  rng: RngState;
}

export interface CrossingOptions {
  version: CrossingVersion;
  tier: Tier;
  /** The testing tab's overrides: "auto" uses the tier's. */
  lives?: 'auto' | number;
  attemptSec?: 'auto' | number;
  /** Prepare (20-challenge-popup.md, section 7): extra lives by hiker, and the share slower the lanes go. */
  extraLives?: Readonly<Record<string, number>>;
  slower?: number;
}

const between = (rng: RngState, [a, b]: readonly [number, number]) => a + nextFloat(rng) * (b - a);

/** The kinds of lane, bottom to top, for a version (Mixed: road, a bank, river). */
function laneKinds(version: CrossingVersion, n: number): LaneKind[] {
  if (version === 'road') return Array.from({ length: n }, () => 'road');
  if (version === 'river') return Array.from({ length: n }, () => 'river');
  if (version === 'critter') return Array.from({ length: n }, () => 'critter');
  const road = Math.ceil(n / 2);
  return [
    ...Array.from({ length: road }, () => 'road' as const),
    'bank',
    ...Array.from({ length: n - road }, () => 'river' as const),
  ];
}

/** One thing for a lane, of its kind. */
function makeThing(rng: RngState, kind: LaneKind, tier: Tier): Thing {
  if (kind === 'road') {
    const kinds: ThingKind[] = ['car', 'car', 'truck', 'rv'];
    if (tier >= C.loggerFrom) kinds.push('logger');
    const k = kinds[int(rng, 0, kinds.length - 1)] as Exclude<ThingKind, 'log' | 'turtles'>;
    return { kind: k, x: 0, w: WIDTH[k] };
  }
  if (kind === 'critter') {
    const kinds = ['deer', 'turkey', 'raccoon', 'rabbit'] as const;
    const k = kinds[int(rng, 0, kinds.length - 1)]!;
    return { kind: k, x: 0, w: WIDTH[k] };
  }
  // River: logs, or a group of turtles.
  if (nextFloat(rng) < 0.6) {
    const pieces = int(rng, C.logPieces[0], C.logPieces[1]);
    return { kind: 'log', x: 0, w: pieces * 16, pieces };
  }
  const pieces = int(rng, C.turtles[0], C.turtles[1]);
  return { kind: 'turtles', x: 0, w: pieces * 16, pieces };
}

/** A lane: things with gaps between them around a loop at least a screen and a bit long. */
function makeLane(
  rng: RngState,
  kind: LaneKind,
  k: number,
  tier: Tier,
  critter: boolean,
  pace = 1,
): Lane {
  const t = C.tiers[tier];
  const dir: 1 | -1 = k % 2 === 0 ? 1 : -1;
  if (kind === 'bank') return { kind, dir, speed: 0, span: 320, things: [] };
  const speed = between(rng, t.speed) * (critter ? C.critter.speed : 1) * pace;
  const things: Thing[] = [];
  let pos = 0;
  while (pos < 320 + 96) {
    const thing = makeThing(rng, kind, tier);
    things.push({ ...thing, x: pos });
    pos += thing.w + between(rng, t.gap) * (critter ? C.critter.gap : 1);
  }
  const shift = nextFloat(rng) * pos;
  return {
    kind,
    dir,
    speed,
    span: pos,
    things: things.map((th) => ({ ...th, x: wrap(th.x + shift, th.w, pos) })),
  };
}

/** Keeps a thing on its lane's loop: from just off the left edge to the far end. */
const wrap = (x: number, w: number, span: number) => ((((x + w) % span) + span) % span) - w;

const startX = 160;

export function newCrossing(
  options: CrossingOptions,
  order: readonly string[],
  seed: number,
): CrossingState {
  const rng = seedRng(seed);
  const tier = options.tier;
  const t = C.tiers[tier];
  const version: CrossingVersion =
    options.version === 'mixed' && tier < C.mixedFrom ? 'road' : options.version;
  const critter = version === 'critter';
  const kinds = laneKinds(version, t.lanes);
  const pace = 1 - Math.max(0, Math.min(0.8, options.slower ?? 0));
  const lanes = kinds.map((kind, k) => makeLane(rng, kind, k, tier, critter, pace));
  // Some turtle groups dive.
  let divers = t.divers;
  for (const lane of lanes) {
    for (const th of lane.things) {
      if (divers > 0 && th.kind === 'turtles') {
        th.dive = nextFloat(rng) * diveCycle();
        divers--;
      }
    }
  }
  // From Tier II, some critters stop now and then.
  if (critter && tier >= C.critter.stopFrom) {
    for (const lane of lanes) {
      for (const th of lane.things) {
        if (nextFloat(rng) < C.critter.stopChance)
          th.nextStop = between(rng, C.critter.stopEverySec);
      }
    }
  }
  const lives =
    typeof options.lives === 'number'
      ? options.lives
      : t.lives + (critter ? C.critter.extraLives : 0);
  const attemptSec = typeof options.attemptSec === 'number' ? options.attemptSec : t.attemptSec;
  return {
    version,
    tier,
    order: [...order],
    line: [...order],
    lives: Object.fromEntries(order.map((id) => [id, lives + (options.extraLives?.[id] ?? 0)])),
    maxLives: lives,
    startLives: Object.fromEntries(
      order.map((id) => [id, lives + (options.extraLives?.[id] ?? 0)]),
    ),
    status: Object.fromEntries(order.map((id, i) => [id, i === 0 ? 'crossing' : 'waiting'])),
    lanes,
    rows: lanes.length + 2,
    x: startX,
    row: 0,
    attemptSec,
    attemptLeft: attemptSec,
    pauseUntil: 0,
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The dive cycle's length (up, half, under). */
const diveCycle = () => C.dive.upSec + C.dive.halfSec + C.dive.underSec;

/** A turtle group now: up, half (the warning) or under. */
export function turtleState(th: Thing, time: number): 'up' | 'half' | 'under' {
  if (th.dive === undefined) return 'up';
  const u = (((time + th.dive) % diveCycle()) + diveCycle()) % diveCycle();
  return u < C.dive.upSec ? 'up' : u < C.dive.upSec + C.dive.halfSec ? 'half' : 'under';
}

/** The hiker crossing now. */
export const crossingHiker = (s: CrossingState): string | undefined =>
  s.line.find((id) => s.status[id] === 'crossing');

/** Where the hiker is drawn now: their middle, and their row (part way during a hop). */
export function hikerAt(s: CrossingState): { x: number; row: number } {
  if (!s.hop) return { x: s.x, row: s.row };
  const u = Math.min(1, (s.time - s.hop.at) / C.hopSec);
  return {
    x: s.hop.fromX + (s.hop.toX - s.hop.fromX) * u,
    row: s.hop.fromRow + (s.hop.toRow - s.hop.fromRow) * u,
  };
}

/** The lane a row is (or none: the start and the goal). */
const laneOf = (s: CrossingState, row: number): Lane | undefined => s.lanes[row - 1];

/** A hop, if the hiker crossing can make one now. */
export function hop(s: CrossingState, dir: Dir): CrossingState {
  if (s.over || s.hop || s.time < s.pauseUntil || !crossingHiker(s)) return s;
  const toRow = dir === 'up' ? s.row + 1 : dir === 'down' ? Math.max(0, s.row - 1) : s.row;
  const step = dir === 'left' ? -C.row : dir === 'right' ? C.row : 0;
  const toX = Math.max(8, Math.min(312, s.x + step));
  if (toRow === s.row && toX === s.x) return s;
  return { ...s, hop: { fromX: s.x, fromRow: s.row, toX, toRow, at: s.time } };
}

/** The hiker is hit (or out of time): a life gone, back to the start and the back of the line. */
function hit(s: CrossingState, why: NonNullable<CrossingState['lastHit']>['why']): CrossingState {
  const id = crossingHiker(s)!;
  const lives = { ...s.lives, [id]: Math.max(0, (s.lives[id] ?? 0) - 1) };
  const status: Record<string, HikerStatus> = {
    ...s.status,
    [id]: lives[id]! > 0 ? 'waiting' : 'out',
  };
  const line = [...s.line.filter((x) => x !== id), ...(lives[id]! > 0 ? [id] : [])];
  return nextUp({
    ...s,
    lives,
    status,
    line,
    lastHit: { id, at: s.time, why },
    pauseUntil: s.time + C.hitPauseSec,
  });
}

/** The next hiker in line steps up at the start (or it's over). */
function nextUp(s: CrossingState): CrossingState {
  const next = s.line.find((id) => s.status[id] === 'waiting');
  const base: CrossingState = { ...s, x: startX, row: 0, attemptLeft: s.attemptSec };
  delete base.hop;
  if (!next) return { ...base, over: true };
  return { ...base, status: { ...s.status, [next]: 'crossing' } };
}

/** The thing under the hiker's middle in a river lane that holds them up (a log, or turtles that are up or half). */
function platformUnder(lane: Lane, x: number, time: number): Thing | undefined {
  return lane.things.find(
    (th) =>
      (th.kind === 'log' || (th.kind === 'turtles' && turtleState(th, time) !== 'under')) &&
      x >= th.x + 2 &&
      x <= th.x + th.w - 2,
  );
}

/** Whether a vehicle or critter in this lane touches the hiker (a little forgiving). */
const struck = (lane: Lane, x: number) =>
  lane.things.some((th) => x + 4 > th.x + 2 && x - 4 < th.x + th.w - 2);

/** Time passes: lanes move, the hop lands, rides carry, hits happen, and the clock runs. */
export function tick(s0: CrossingState, dt: number): CrossingState {
  if (s0.over) return s0;
  const rng = [...s0.rng] as RngState;
  const time = s0.time + dt;

  // The lanes move (stopping critters stay put for a moment).
  const lanes = s0.lanes.map((lane) => ({
    ...lane,
    things: lane.things.map((th) => {
      let next = { ...th };
      if (next.nextStop !== undefined && next.stopUntil === undefined) {
        next.nextStop -= dt;
        if (next.nextStop <= 0) {
          next = { ...next, stopUntil: time + between(rng, C.critter.stopSec) };
          delete next.nextStop;
        }
      }
      if (next.stopUntil !== undefined) {
        if (time < next.stopUntil) return next;
        delete next.stopUntil;
        next.nextStop = between(rng, C.critter.stopEverySec);
      }
      return { ...next, x: wrap(next.x + lane.dir * lane.speed * dt, next.w, lane.span) };
    }),
  }));
  let s: CrossingState = { ...s0, rng, time, lanes };
  if (time < s.pauseUntil || !crossingHiker(s)) return s;

  // The hop lands.
  if (s.hop && time - s.hop.at >= C.hopSec) {
    s = { ...s, x: s.hop.toX, row: s.hop.toRow };
    delete s.hop;
    // Across: on to the next hiker.
    if (s.row >= s.rows - 1) {
      const id = crossingHiker(s)!;
      return nextUp({
        ...s,
        status: { ...s.status, [id]: 'across' },
        line: s.line.filter((x) => x !== id),
      });
    }
  }

  // The clock for this attempt.
  const attemptLeft = s.attemptLeft - dt;
  s = { ...s, attemptLeft };
  if (attemptLeft <= 0) return hit(s, 'time');

  const at = hikerAt(s);
  const row = Math.round(at.row);
  const lane = laneOf(s, row);
  if (!lane) return s;
  if (lane.kind === 'road' || lane.kind === 'critter') {
    return struck(lane, at.x) ? hit(s, 'hit') : s;
  }
  if (lane.kind === 'river' && !s.hop) {
    // Standing in a river lane: on a platform it carries you; otherwise it's the water.
    const p = platformUnder(lane, s.x, time);
    if (!p) return hit(s, 'water');
    const x = s.x + lane.dir * lane.speed * dt;
    if (x < 4 || x > 316) return hit(s, 'edge');
    return { ...s, x };
  }
  return s;
}

/** A passing challenge: hikers across move on; hikers out stay back and lose energy. */
export function result(s: CrossingState): MinigameResult {
  const costs: Record<string, Pay> = {};
  for (const id of s.order) if (s.status[id] === 'out') costs[id] = { energy: C.failEnergy };
  const across = s.order.filter((id) => s.status[id] === 'across');
  return passingResult(s.order, s.tier, across, costs);
}

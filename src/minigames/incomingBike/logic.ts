/**
 * Incoming Bike! (docs/design/30-quick-minigames.md, section 1): bikes fly
 * down the trail at the hiker. Each shows a key in a ring that closes in;
 * press that key before the ring closes, and the hiker hops aside.
 *
 * - One hiker at a time, in line order, each with their own hearts. A hiker
 *   passes when every bike has gone by and they still have a heart.
 * - The wrong key, or too late: the bike clips the hiker. They lose a heart
 *   and stumble for a moment (keys do nothing then).
 * - The keys by tier: the arrows; plus A, S, D and F (Tier II); plus J, K
 *   and L (Tier III). From Tier III two bikes can come at once; from IV some
 *   show two keys, pressed in order; at V some show a crossed-out key: don't
 *   press it, and the hiker ducks as it passes.
 * - On a phone a bike shows a shape to draw instead (`shapes.ts`); the game
 *   is the same with shapes for keys.
 * - Prepare: FOOD slows the rings, BANDAGES give a hiker a heart, the BIKE
 *   BELL makes each hiker's first mistake free (the biker rings and
 *   swerves), and BINOCULARS show each key a moment before its ring starts.
 *
 * Pure and seeded; times are seconds into the hiker's turn.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import {
  allDone,
  current,
  endTurn,
  newTurns,
  playing,
  quickResult,
  tickTurns,
  type Turns,
} from '../quick/turns';
import type { MinigameResult, Tier } from '../types';
import { SHAPE_SETS } from './shapes';

const B = BALANCE.minigames.incomingBike;

export type BikeInput = 'keys' | 'swipe';

/** The keys, in the order they come in: the arrows at Tier I, A S D F at II, J K L at III. */
export const KEY_SETS: readonly (readonly string[])[] = [
  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
  ['a', 's', 'd', 'f'],
  ['j', 'k', 'l'],
];

/** What a bike can show at this tier: keys, or shapes on a phone. */
export const signsFor = (tier: Tier, input: BikeInput): string[] =>
  (input === 'swipe' ? SHAPE_SETS : KEY_SETS).slice(0, Math.min(3, tier)).flat();

export interface BikeOptions {
  tier: Tier;
  input?: BikeInput;
  /** The Hearts setting ("auto": [3]). */
  hearts?: number | 'auto';
  /** Prepare: FOOD cards (each slows the rings), extra hearts by hiker, the bell, binoculars' seconds. */
  food?: number;
  extraHearts?: Readonly<Record<string, number>>;
  bell?: number;
  warnSec?: number;
}

export interface Bike {
  id: number;
  /** What to press (keys, or shapes), in order. */
  signs: readonly string[];
  /** How many of them are pressed. */
  done: number;
  /** Crossed out: don't press it (Tier V). */
  crossed: boolean;
  /** When it shows, when its ring starts closing, and when the ring has closed. */
  showAt: number;
  ringAt: number;
  closeAt: number;
  /** Its side of the trail (two at once ride either side). */
  lane: -1 | 0 | 1;
  /** Dodged (a hop, a duck, or the bell) or hit, and when. */
  outcome?: 'dodged' | 'hit';
  how?: 'hop' | 'duck' | 'bell';
  endAt?: number;
}

export interface BikeState {
  tier: Tier;
  input: BikeInput;
  signs: readonly string[];
  bikesPer: number;
  ringSec: number;
  warnSec: number;
  hearts: number;
  extraHearts: Readonly<Record<string, number>>;
  bell: number;
  turns: Turns;
  /** This hiker's turn. */
  heartsLeft: number;
  bellLeft: number;
  bikes: readonly Bike[];
  spawned: number;
  dodged: number;
  /** When the next bike shows (turn time; Infinity while one is on the trail). */
  nextAt: number;
  /** A second bike coming with the one on the trail. */
  pairAt: number | null;
  stumbleUntil: number;
  turnTime: number;
  nextId: number;
  /** The last hop (for the screen). */
  lastHop?: { at: number; lane: -1 | 0 | 1 };
  lastHit?: { at: number };
  /** Each hiker's bikes dodged, once done. */
  record: Readonly<Record<string, number>>;
  time: number;
  over: boolean;
  rng: RngState;
}

const span = (rng: RngState, [a, b]: readonly [number, number]) => a + nextFloat(rng) * (b - a);
const pickOf = <T>(rng: RngState, xs: readonly T[]): T =>
  xs[Math.min(xs.length - 1, Math.floor(nextFloat(rng) * xs.length))]!;

/** Bikes still coming at the hiker (shown, not yet past). */
export const onTrail = (s: BikeState): Bike[] => s.bikes.filter((b) => !b.outcome);

/** The ring's share left (1 at its start, 0 closed); 1 while the key shows before it. */
export const ringLeft = (s: BikeState, b: Bike): number =>
  Math.max(0, Math.min(1, (b.closeAt - s.turnTime) / Math.max(1e-6, b.closeAt - b.ringAt)));

/** How far down the trail a bike is (0 at the top, 1 at the hiker; more as it rides past). */
export function bikeAt(s: BikeState, b: Bike): number {
  const start = b.showAt;
  const t = b.endAt ?? b.closeAt;
  const along = (Math.min(s.turnTime, t) - start) / Math.max(1e-6, b.closeAt - start);
  const past = b.endAt !== undefined ? (s.turnTime - b.endAt) / B.pastSec : 0;
  // Once past (or dodged), it whooshes on down the trail.
  return Math.max(0, along) + Math.max(0, past) * 1.2;
}

/** Whether the hiker is stumbling (keys do nothing). */
export const stumbling = (s: BikeState): boolean => s.turnTime < s.stumbleUntil;

function startTurn(s: BikeState): BikeState {
  const id = current(s.turns) ?? '';
  return {
    ...s,
    heartsLeft: s.hearts + (s.extraHearts[id] ?? 0),
    bellLeft: s.bell,
    bikes: [],
    spawned: 0,
    dodged: 0,
    nextAt: B.firstSec,
    pairAt: null,
    stumbleUntil: 0,
    turnTime: 0,
    lastHop: undefined,
    lastHit: undefined,
  };
}

export function newIncomingBike(
  options: BikeOptions,
  order: readonly string[],
  seed: number,
): BikeState {
  const t = B.tiers[options.tier];
  const input = options.input ?? 'keys';
  const s: BikeState = {
    tier: options.tier,
    input,
    signs: signsFor(options.tier, input),
    bikesPer: t.bikes,
    ringSec: t.ringSec * (1 + B.foodSlower * Math.max(0, options.food ?? 0)),
    warnSec: Math.max(0, options.warnSec ?? 0),
    hearts: typeof options.hearts === 'number' ? options.hearts : B.hearts,
    extraHearts: options.extraHearts ?? {},
    bell: Math.max(0, options.bell ?? 0),
    turns: newTurns(order),
    heartsLeft: 0,
    bellLeft: 0,
    bikes: [],
    spawned: 0,
    dodged: 0,
    nextAt: 0,
    pairAt: null,
    stumbleUntil: 0,
    turnTime: 0,
    nextId: 1,
    record: {},
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
  return startTurn(s);
}

/** A new bike: one key (two from Tier IV now and then, crossed out at V now and then), not one already on the trail. */
function spawn(s: BikeState, rng: RngState, lane: -1 | 0 | 1): BikeState {
  const t = B.tiers[s.tier];
  const taken = new Set(onTrail(s).flatMap((b) => b.signs));
  const free = s.signs.filter((k) => !taken.has(k));
  const pool = free.length ? free : s.signs;
  const first = pickOf(rng, pool);
  let signs: string[] = [first];
  let crossed = false;
  if (nextFloat(rng) < t.twoKeys) {
    const rest = pool.filter((k) => k !== first);
    if (rest.length) signs = [first, pickOf(rng, rest)];
  } else if (nextFloat(rng) < t.dontPress) crossed = true;
  const bike: Bike = {
    id: s.nextId,
    signs,
    done: 0,
    crossed,
    showAt: s.turnTime,
    ringAt: s.turnTime + s.warnSec,
    closeAt: s.turnTime + s.warnSec + s.ringSec,
    lane,
  };
  return { ...s, bikes: [...s.bikes, bike], spawned: s.spawned + 1, nextId: s.nextId + 1 };
}

function finish(s: BikeState, passed: boolean): BikeState {
  const id = current(s.turns);
  const record = id ? { ...s.record, [id]: s.dodged } : s.record;
  const turns = endTurn(s.turns, passed);
  const next = { ...s, record, turns };
  if (allDone(turns)) return { ...next, over: true };
  return startTurn(next);
}

/** A bike is past: when nothing else is coming, the next one shows after a gap. */
function settle(s: BikeState, bike: Bike, rng: RngState): BikeState {
  const bikes = s.bikes.map((b) => (b.id === bike.id ? bike : b));
  let out: BikeState = { ...s, bikes };
  if (bike.outcome === 'dodged') out = { ...out, dodged: out.dodged + 1 };
  if (onTrail(out).length === 0 && out.pairAt === null)
    out = { ...out, nextAt: out.turnTime + span(rng, B.tiers[s.tier].gapSec) };
  if (out.spawned >= out.bikesPer && onTrail(out).length === 0 && out.pairAt === null)
    return finish(out, true);
  return out;
}

/** The bike clips the hiker (the bell rings first, once, with the BIKE BELL). */
function hit(s: BikeState, bike: Bike, rng: RngState): BikeState {
  const at = s.turnTime;
  if (s.bellLeft > 0) {
    const rung: Bike = { ...bike, outcome: 'dodged', how: 'bell', endAt: at };
    return settle({ ...s, bellLeft: s.bellLeft - 1 }, rung, rng);
  }
  const heartsLeft = s.heartsLeft - 1;
  const out: BikeState = {
    ...s,
    heartsLeft,
    stumbleUntil: at + B.stumbleSec,
    lastHit: { at },
    bikes: s.bikes.map((b) => (b.id === bike.id ? { ...b, outcome: 'hit', endAt: at } : b)),
  };
  if (heartsLeft <= 0) return finish(out, false);
  return settle(out, { ...bike, outcome: 'hit', endAt: at }, rng);
}

/**
 * A key (or a drawn shape). The bike waiting for it goes on (dodged once its
 * keys are all pressed). A crossed-out bike's key, or a key no bike wants,
 * is a hit from the bike closest to the hiker. Nothing happens with no bike
 * on the trail, or while the hiker stumbles.
 */
export function press(s: BikeState, sign: string): BikeState {
  if (s.over || !playing(s.turns) || stumbling(s)) return s;
  const coming = onTrail(s).sort((a, b) => a.closeAt - b.closeAt);
  if (coming.length === 0) return s;
  const rng: RngState = [...s.rng];
  const wanted = coming.find((b) => !b.crossed && b.signs[b.done] === sign);
  if (wanted) {
    const done = wanted.done + 1;
    if (done < wanted.signs.length) {
      return { ...s, bikes: s.bikes.map((b) => (b.id === wanted.id ? { ...b, done } : b)) };
    }
    const dodged: Bike = { ...wanted, done, outcome: 'dodged', how: 'hop', endAt: s.turnTime };
    return {
      ...settle({ ...s, lastHop: { at: s.turnTime, lane: wanted.lane } }, dodged, rng),
      rng,
    };
  }
  const crossed = coming.find((b) => b.crossed && b.signs[0] === sign);
  return { ...hit(s, crossed ?? coming[0]!, rng), rng };
}

export function tick(s0: BikeState, dt: number): BikeState {
  if (s0.over) return s0;
  let s: BikeState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  const rng: RngState = [...s.rng];
  const turnTime = s.turnTime + dt;
  s = {
    ...s,
    turnTime,
    // Bikes long past leave the screen.
    bikes: s.bikes.filter((b) => b.endAt === undefined || turnTime - b.endAt < B.pastSec),
  };

  // Rings that close: a crossed-out bike passes (the hiker ducks); any other clips the hiker.
  for (const b of onTrail(s).sort((x, y) => x.closeAt - y.closeAt)) {
    if (turnTime < b.closeAt) break;
    const before = s.turns.at;
    s = b.crossed
      ? settle(s, { ...b, outcome: 'dodged', how: 'duck', endAt: turnTime }, rng)
      : hit(s, b, rng);
    if (s.turns.at !== before || s.over) return { ...s, rng };
  }

  // The next bike (and its partner).
  if (s.spawned < s.bikesPer) {
    if (s.pairAt !== null && turnTime >= s.pairAt) {
      s = { ...spawn(s, rng, 1), pairAt: null };
    } else if (s.pairAt === null && onTrail(s).length === 0 && turnTime >= s.nextAt) {
      const pair = s.spawned + 1 < s.bikesPer && nextFloat(rng) < B.tiers[s.tier].two;
      s = spawn(s, rng, pair ? -1 : 0);
      s = { ...s, nextAt: Infinity, pairAt: pair ? turnTime + B.pairSec : null };
    }
  }
  return { ...s, rng };
}

/** Who passed (every bike past with a heart left); those who failed lose [1] energy. */
export const result = (s: BikeState): MinigameResult =>
  quickResult(s.turns.order, (id) => s.turns.done[id] === true);

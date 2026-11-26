/**
 * Fly Block (docs/design/23-minigames-final.md, section 3), Tempest-style:
 * a pie sits in the middle of a ring of panels, with a lane running out
 * from each panel. Flies come in along the lanes. The swatter sits on one
 * panel; it moves one panel at a time. Pure and seeded.
 *
 * - **A fly reaching the ring** at the swatter's panel is SWAT, knocked out;
 *   at any other panel it gets to the pie: **a bite**.
 * - **Kinds:** fast flies (Tier II and up), zig-zag flies that blink and hop
 *   to the next lane once on the way in (Tier III and up), horseflies that
 *   take two swats (Tier IV and up), and bees (Tier III and up): let them
 *   by. A bee that hits the swatter stings (a bite); one that reaches the
 *   pie just leaves.
 * - **A round:** one hiker at a time, in line order, each facing the tier's
 *   flies (a few at once later in the round). [3] bites and that hiker
 *   fails at once; finishing with bites to spare passes.
 *
 * Lanes are numbered clockwise from the top; distances are along a lane,
 * from the ring outward.
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

const FB = BALANCE.minigames.flyBlock;

export type FlyKind = 'fly' | 'fast' | 'zig' | 'horse' | 'bee';

export interface Fly {
  id: number;
  kind: FlyKind;
  lane: number;
  /** How far out along its lane (it reaches the ring at 0). */
  dist: number;
  speed: number;
  /** Swats it still takes (a horsefly: 2). */
  hp: number;
  /** A zig-zag fly hops one lane at this distance (once), blinking just before. */
  hopAt?: number;
  hopDir?: 1 | -1;
  hopped?: true;
}

export interface FlyBlockOptions {
  tier: Tier;
  /** Panels around the pie ("auto": the tier's), and bees ("auto": from Tier III). */
  panels?: number | 'auto';
  bees?: 'auto' | 'on' | 'off';
  /** Prepare: +1 bite for some hikers, slower flies (the share), fewer flies (SMOKE). */
  extraBites?: Readonly<Record<string, number>>;
  slower?: number;
  fewer?: number;
}

/** Something that just happened at the ring (for the screen and sounds). */
export interface RingEvent {
  kind: 'swat' | 'bite' | 'sting' | 'knock' | 'pass';
  lane: number;
  at: number;
}

export interface FlyBlockState {
  tier: Tier;
  turns: Turns;
  panels: number;
  /** The swatter's panel. */
  at: number;
  flies: Fly[];
  /** This hiker's round: flies sent so far, of how many; bites so far, of how many allowed. */
  sent: number;
  total: number;
  bites: number;
  biteMax: Record<string, number>;
  nextAt: number;
  nextId: number;
  bees: boolean;
  speedK: number;
  last?: RingEvent;
  time: number;
  over: boolean;
  rng: RngState;
}

export function newFlyBlock(
  options: FlyBlockOptions,
  order: readonly string[],
  seed: number,
): FlyBlockState {
  const t = FB.tiers[options.tier];
  const panels = typeof options.panels === 'number' ? options.panels : t.panels;
  return {
    tier: options.tier,
    turns: newTurns(order),
    panels,
    at: 0,
    flies: [],
    sent: 0,
    total: Math.max(1, t.flies - (options.fewer ?? 0)),
    bites: 0,
    biteMax: Object.fromEntries(
      order.map((id) => [id, FB.bites + (options.extraBites?.[id] ?? 0)]),
    ),
    nextAt: FB.firstSec,
    nextId: 1,
    bees:
      options.bees === 'on' ? true : options.bees === 'off' ? false : options.tier >= FB.bee.from,
    speedK: 1 - (options.slower ?? 0),
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
}

/** The hiker playing now. */
export const swatting = (s: FlyBlockState): string | undefined => current(s.turns);

/** Bites this hiker can still take before failing. */
export const bitesLeft = (s: FlyBlockState): number => {
  const who = swatting(s);
  return who ? (s.biteMax[who] ?? FB.bites) - s.bites : 0;
};

/** Move the swatter one panel: 1 is clockwise (D, →, a swipe right). */
export function move(s: FlyBlockState, dir: 1 | -1): FlyBlockState {
  if (s.over || !playing(s.turns)) return s;
  return { ...s, at: (s.at + dir + s.panels) % s.panels };
}

/** Whether a zig-zag fly is blinking (about to hop). */
export const blinking = (f: Fly): boolean =>
  f.hopAt !== undefined && !f.hopped && f.dist <= f.hopAt + f.speed * FB.zig.blinkSec;

/** A new fly (or bee) at the outer end of a random lane, its kind by tier. */
function spawnOne(s: FlyBlockState, rng: RngState, id: number): Fly {
  const t = FB.tiers[s.tier];
  const lane = Math.floor(nextFloat(rng) * s.panels);
  const base = t.speed * s.speedK;
  const roll = nextFloat(rng);
  const kinds: { kind: FlyKind; share: number; ok: boolean }[] = [
    { kind: 'horse', share: FB.horse.share, ok: s.tier >= FB.horse.from },
    { kind: 'zig', share: FB.zig.share, ok: s.tier >= FB.zig.from },
    { kind: 'fast', share: FB.fast.share, ok: s.tier >= FB.fast.from },
  ];
  let acc = 0;
  let kind: FlyKind = 'fly';
  for (const k of kinds) {
    if (!k.ok) continue;
    acc += k.share;
    if (roll < acc) {
      kind = k.kind;
      break;
    }
  }
  const fly: Fly = {
    id,
    kind,
    lane,
    dist: FB.laneLength,
    speed: kind === 'fast' ? base * FB.fast.times : base,
    hp: kind === 'horse' ? 2 : 1,
  };
  if (kind === 'zig') {
    fly.hopAt = FB.laneLength * (0.3 + nextFloat(rng) * 0.35);
    fly.hopDir = nextFloat(rng) < 0.5 ? 1 : -1;
  }
  return fly;
}

/** This hiker's round is over: passed if they finished with bites to spare. */
function finishRound(s: FlyBlockState, passed: boolean): FlyBlockState {
  const turns = endTurn(s.turns, passed);
  return {
    ...s,
    turns,
    flies: [],
    sent: 0,
    bites: 0,
    nextAt: s.time + BALANCE.minigames.quick.handoffSec + FB.firstSec,
    over: allDone(turns),
  };
}

export function tick(s0: FlyBlockState, dt: number): FlyBlockState {
  if (s0.over) return s0;
  let s: FlyBlockState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  const t = FB.tiers[s.tier];
  const rng: RngState = [...s.rng];
  // New flies when due: later in the round, sometimes a few at once. Bees come on their own.
  if (s.sent < s.total && s.time >= s.nextAt) {
    const late = s.sent >= s.total / 2;
    const n = Math.min(
      s.total - s.sent,
      late && nextFloat(rng) < FB.together.chance ? FB.together.count : 1,
    );
    const born = Array.from({ length: n }, (_, k) => spawnOne(s, rng, s.nextId + k));
    const bee =
      s.bees && nextFloat(rng) < FB.bee.chance
        ? [
            {
              id: s.nextId + n,
              kind: 'bee' as const,
              lane: Math.floor(nextFloat(rng) * s.panels),
              dist: FB.laneLength,
              speed: t.speed * s.speedK * FB.bee.times,
              hp: 1,
            },
          ]
        : [];
    s = {
      ...s,
      flies: [...s.flies, ...born, ...bee],
      sent: s.sent + n,
      nextId: s.nextId + n + bee.length,
      nextAt: s.time + t.everySec * (0.85 + nextFloat(rng) * 0.3),
    };
  }
  s = { ...s, rng };
  // Flies move in; zig-zags hop once; at the ring: swat, knock back, sting, bite or pass.
  const flies: Fly[] = [];
  let bites = s.bites;
  let last = s.last;
  for (const f0 of s.flies) {
    let f: Fly = { ...f0, dist: f0.dist - f0.speed * dt };
    if (f.hopAt !== undefined && !f.hopped && f.dist <= f.hopAt) {
      f = { ...f, lane: (f.lane + (f.hopDir ?? 1) + s.panels) % s.panels, hopped: true };
    }
    if (f.dist > 0) {
      flies.push(f);
      continue;
    }
    const blocked = f.lane === s.at;
    if (f.kind === 'bee') {
      if (blocked) {
        bites++;
        last = { kind: 'sting', lane: f.lane, at: s.time };
      } else last = { kind: 'pass', lane: f.lane, at: s.time };
      continue;
    }
    if (!blocked) {
      bites++;
      last = { kind: 'bite', lane: f.lane, at: s.time };
      continue;
    }
    if (f.hp > 1) {
      flies.push({ ...f, hp: f.hp - 1, dist: FB.horse.knockBack });
      last = { kind: 'knock', lane: f.lane, at: s.time };
      continue;
    }
    last = { kind: 'swat', lane: f.lane, at: s.time };
  }
  s = { ...s, flies, bites, ...(last ? { last } : {}) };
  const who = swatting(s)!;
  if (bites >= (s.biteMax[who] ?? FB.bites)) return finishRound(s, false);
  // Every fly sent and none left (bees don't count): the round is done.
  if (s.sent >= s.total && !s.flies.some((f) => f.kind !== 'bee')) return finishRound(s, true);
  return s;
}

/** Each hiker passes or fails on their own round; failing costs [1] energy (the challenge can say otherwise). */
export const result = (s: FlyBlockState): MinigameResult =>
  quickResult(s.turns.order, (id) => s.turns.done[id] === true);

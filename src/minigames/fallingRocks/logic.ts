/**
 * Falling Rocks (docs/design/23-minigames-final.md, section 2), a passing
 * challenge seen from the side: one hiker at a time walks a ledge trail
 * across a mountainside, from the left end to the right, under falling
 * rocks. Pure and seeded.
 *
 * - **Controls:** walk right, back up left, or stop.
 * - **Falling rock** (all tiers): a dust puff at the top marks where it'll
 *   fall; its shadow grows on the trail for the tier's warning; then it
 *   lands, hitting if the hiker is within the shadow's half-width (small,
 *   medium or large), and bounces away.
 * - **Rock shower** (Tier II and up): a few small rocks spread out, a moment
 *   apart.
 * - **Rolling boulder** (Tier III and up): it rumbles at one edge, then rolls
 *   the whole trail. Only an overhang is safe from it.
 * - **Overhangs** (two notches under a lip of rock) are safe from everything.
 * - **Pacing:** a hazard every so often by tier, mostly aimed at the trail
 *   ahead of the hiker, so standing still isn't safe forever.
 * - **Lives:** [2] each; a hit costs one, then a moment of safety. Out of
 *   lives, the hiker fails with the challenge's stake and the next one
 *   starts at the left. Reaching the right end passes.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
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

const F = BALANCE.minigames.fallingRocks;

export type RockSize = 's' | 'm' | 'l';

/** A rock: dust at `warnAt`, its shadow growing until it lands at `landAt`, at `x` on the trail. */
export interface Rock {
  kind: 'rock';
  id: number;
  x: number;
  size: RockSize;
  warnAt: number;
  landAt: number;
  /** It hit nobody yet (it can hit once, as it lands). */
  landed?: true;
}

/** A boulder: rumbling at one edge from `warnAt`, rolling from `rollAt` (dir 1: rightward). */
export interface Boulder {
  kind: 'boulder';
  id: number;
  dir: 1 | -1;
  warnAt: number;
  rollAt: number;
  speed: number;
}

export type Hazard = Rock | Boulder;

export interface FallingRocksOptions {
  tier: Tier;
  /** Lives each hiker has ("auto": [2]); boulders ("auto": from Tier III). */
  lives?: number | 'auto';
  boulders?: 'auto' | 'on' | 'off';
  /** Prepare: +1 life for some hikers, slower rocks (the share), more warning (Binoculars). */
  extraLives?: Readonly<Record<string, number>>;
  slower?: number;
  extraWarnSec?: number;
}

export interface FallingRocksState {
  tier: Tier;
  turns: Turns;
  /** The hiker on the trail: where (0 to the trail's length), and which way they're walking. */
  x: number;
  dir: -1 | 0 | 1;
  lives: Record<string, number>;
  /** Safe (blinking) until then after a hit. */
  safeUntil: number;
  hazards: Hazard[];
  nextAt: number;
  nextId: number;
  warnSec: number;
  interval: number;
  boulders: boolean;
  boulderSpeed: number;
  /** Who ran out of lives, and the last hit (for the screen). */
  out: string[];
  lastHit?: { at: number; x: number; by: Hazard['kind'] };
  time: number;
  over: boolean;
  rng: RngState;
}

const pick = <T>(rng: RngState, list: readonly T[]): T =>
  list[Math.floor(nextFloat(rng) * list.length)]!;
const between = (rng: RngState, a: number, b: number) => a + nextFloat(rng) * (b - a);

export function newFallingRocks(
  options: FallingRocksOptions,
  order: readonly string[],
  seed: number,
): FallingRocksState {
  const t = F.tiers[options.tier];
  const each = typeof options.lives === 'number' ? options.lives : F.lives;
  const slower = options.slower ?? 0;
  const boulders =
    options.boulders === 'on'
      ? true
      : options.boulders === 'off'
        ? false
        : options.tier >= F.boulder.from;
  return {
    tier: options.tier,
    turns: newTurns(order),
    x: 0,
    dir: 0,
    lives: Object.fromEntries(order.map((id) => [id, each + (options.extraLives?.[id] ?? 0)])),
    safeUntil: 0,
    hazards: [],
    nextAt: F.firstSec,
    nextId: 1,
    warnSec: t.warnSec * (1 + slower) + (options.extraWarnSec ?? 0),
    interval: t.everySec * (1 + slower),
    boulders,
    boulderSpeed: F.boulder.speed * (1 - slower),
    out: [],
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
}

/** The hiker on the trail now (or about to start). */
export const walker = (s: FallingRocksState): string | undefined => current(s.turns);

/** Whether a spot on the trail is under an overhang (safe from everything). */
export const underOverhang = (x: number): boolean =>
  F.overhangs.some((o) => Math.abs(x - o.x) <= o.half);

/** A rock's shadow half-width (and what it hits). */
export const halfOf = (size: RockSize): number => F.half[size];

/** How far a rock's shadow has grown (0 at the dust, 1 as it lands). */
export const shadowGrowth = (r: Rock, time: number): number =>
  Math.max(0, Math.min(1, (time - r.warnAt) / (r.landAt - r.warnAt)));

/** Where a boulder is on the trail now (it starts just outside the edge it rumbles at). */
export function boulderX(b: Boulder, time: number): number {
  const start = b.dir === 1 ? -F.boulder.half : F.length + F.boulder.half;
  return start + b.dir * Math.max(0, time - b.rollAt) * b.speed;
}

/** Walk right (1), back up (−1), or stop (0). */
export const setDir = (s: FallingRocksState, dir: -1 | 0 | 1): FallingRocksState =>
  s.dir === dir ? s : { ...s, dir };

/** A new hazard: mostly at the trail ahead of the hiker. */
function spawn(s: FallingRocksState, rng: RngState): Hazard[] {
  const roll = nextFloat(rng);
  const id = s.nextId;
  if (s.boulders && roll < F.boulder.chance && !s.hazards.some((h) => h.kind === 'boulder')) {
    return [
      {
        kind: 'boulder',
        id,
        dir: nextFloat(rng) < 0.5 ? 1 : -1,
        warnAt: s.time,
        rollAt: s.time + F.boulder.warnSec,
        speed: s.boulderSpeed,
      },
    ];
  }
  const aim = () => {
    const ahead = nextFloat(rng) < F.aimAhead;
    const x = ahead ? s.x + between(rng, F.ahead[0], F.ahead[1]) : s.x + between(rng, -20, 20);
    return Math.max(4, Math.min(F.length - 4, x));
  };
  if (s.tier >= F.shower.from && roll < F.boulder.chance + F.shower.chance) {
    const n = Math.round(between(rng, F.shower.count[0], F.shower.count[1] + 0.999) - 0.5);
    const mid = aim();
    return Array.from({ length: n }, (_, k) => ({
      kind: 'rock' as const,
      id: id + k,
      x: Math.max(
        4,
        Math.min(F.length - 4, mid + between(rng, -F.shower.spread / 2, F.shower.spread / 2)),
      ),
      size: 's' as const,
      warnAt: s.time + k * F.shower.apartSec,
      landAt: s.time + k * F.shower.apartSec + s.warnSec,
    }));
  }
  return [
    {
      kind: 'rock',
      id,
      x: aim(),
      size: pick(rng, F.sizes),
      warnAt: s.time,
      landAt: s.time + s.warnSec,
    },
  ];
}

/** The current hiker's turn ends: passed (across) or not (out of lives). */
function finish(s: FallingRocksState, passed: boolean): FallingRocksState {
  const turns = endTurn(s.turns, passed);
  return {
    ...s,
    turns,
    x: 0,
    dir: 0,
    hazards: [],
    nextAt: s.time + F.firstSec + BALANCE.minigames.quick.handoffSec,
    safeUntil: 0,
    over: allDone(turns),
  };
}

export function tick(s0: FallingRocksState, dt: number): FallingRocksState {
  if (s0.over) return s0;
  let s: FallingRocksState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  const who = walker(s)!;
  // Walking: right at [40], back at [30].
  const speed = s.dir === 1 ? F.walk : s.dir === -1 ? F.back : 0;
  const x = Math.max(0, Math.min(F.length, s.x + s.dir * speed * dt));
  s = { ...s, x };
  if (x >= F.length) return finish(s, true);
  // New hazards when they're due.
  const rng: RngState = [...s.rng];
  if (s.time >= s.nextAt) {
    const born = spawn(s, rng);
    s = {
      ...s,
      hazards: [...s.hazards, ...born],
      nextId: s.nextId + born.length,
      nextAt: s.time + s.interval * between(rng, 0.8, 1.2),
    };
  }
  s = { ...s, rng };
  // Hits: a rock as it lands, a boulder as it rolls past; never under an overhang or while safe.
  const safe = s.time < s.safeUntil || underOverhang(s.x);
  let hit: Hazard['kind'] | null = null;
  const hazards: Hazard[] = [];
  for (const h of s.hazards) {
    if (h.kind === 'rock') {
      if (!h.landed && s.time >= h.landAt) {
        if (!safe && !hit && Math.abs(s.x - h.x) <= halfOf(h.size)) hit = 'rock';
        hazards.push({ ...h, landed: true });
        continue;
      }
      if (s.time < h.landAt + F.bounceSec) hazards.push(h);
      continue;
    }
    const bx = boulderX(h, s.time);
    if (s.time >= h.rollAt && !safe && !hit && Math.abs(s.x - bx) <= F.boulder.half)
      hit = 'boulder';
    if (bx > -F.boulder.half * 2 && bx < F.length + F.boulder.half * 2) hazards.push(h);
  }
  s = { ...s, hazards };
  if (!hit) return s;
  const left = (s.lives[who] ?? 0) - 1;
  s = {
    ...s,
    lives: { ...s.lives, [who]: left },
    safeUntil: s.time + F.safeSec,
    lastHit: { at: s.time, x: s.x, by: hit },
  };
  if (left > 0) return s;
  return finish({ ...s, out: [...s.out, who] }, false);
}

/** Hikers who reached the right end pass; hikers out of lives fail with the stake. */
export function result(s: FallingRocksState): MinigameResult {
  const order = s.turns.order;
  const passed = order.filter((id) => s.turns.done[id] === true);
  const costs: Record<string, Pay> = {};
  for (const id of s.out) costs[id] = { conditions: [F.stake] };
  return passingResult(order, s.tier, passed, costs);
}

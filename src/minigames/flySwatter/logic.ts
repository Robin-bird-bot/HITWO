/**
 * Fly Swatter (docs/design/18-minigames-quick.md, section 5): flies are
 * heading for the picnic. Circles pop up where each one will land: tap a
 * circle before it shrinks away and the fly gets there.
 *
 * - One hiker at a time, in line order, each with the tier's flies.
 * - A circle appears at full size at a random spot and shrinks to nothing
 *   over the tier's time; its fly flies in from off screen and arrives just
 *   as the circle disappears.
 * - A tap inside a circle swats it (where circles overlap, the one closest
 *   to disappearing).
 * - A strike: a fly that lands; from Tier III, a tap that hits no circle;
 *   tapping a bee circle (a sting).
 * - Bees (from Tier III): some circles are bee circles. Leave them alone:
 *   letting one shrink away is fine. Bee circles are extra, not part of the
 *   tier's flies (my reading).
 * - The hiker passes if they finish the round with strikes to spare; at [3]
 *   strikes they fail and the round stops.
 *
 * Pure and seeded; scene units (320 × 240), y down.
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

const FS = BALANCE.minigames.flySwatter;
const AREA = FS.area;

export interface FlySwatterOptions {
  tier: Tier;
  /** The Bees setting ("auto": the tier's share). */
  bees?: 'auto' | 'on' | 'off';
  /** The Strikes setting ("auto": the tier's). */
  strikes?: number | 'auto';
  /** Prepare: units more circle, and seconds more before a circle shrinks away. */
  bigger?: number;
  slowerShrink?: number;
}

export interface Circle {
  id: number;
  /** Its middle, where the fly lands. */
  x: number;
  y: number;
  /** Where its fly (or bee) comes from, off screen. */
  fromX: number;
  fromY: number;
  /** When it appeared (turn time). */
  bornAt: number;
  bee: boolean;
}

export type Ending = 'swat' | 'land' | 'sting' | 'gone';

export interface FlySwatterState {
  tier: Tier;
  flies: number;
  size: number;
  shrinkSec: number;
  everySec: number;
  maxUp: number;
  beeShare: number;
  strikesAllowed: number;
  stray: boolean;
  turns: Turns;
  /** This hiker's round. */
  turnTime: number;
  spawned: number;
  swats: number;
  strikes: number;
  circles: Circle[];
  nextSpawnAt: number;
  nextId: number;
  /** What happened lately, for the screen (game time): swats, landings, stings and stray taps. */
  events: { at: number; kind: Ending | 'stray'; x: number; y: number }[];
  /** Each hiker's round, once done. */
  record: Readonly<Record<string, { swats: number; strikes: number }>>;
  time: number;
  over: boolean;
  rng: RngState;
}

/** A circle's radius now (it shrinks to nothing over the shrink time). */
export const radiusAt = (s: FlySwatterState, c: Circle, turnTime = s.turnTime): number =>
  Math.max(0, (s.size / 2) * (1 - (turnTime - c.bornAt) / s.shrinkSec));

/** When a circle disappears (turn time): its fly lands then. */
export const endsAt = (s: FlySwatterState, c: Circle): number => c.bornAt + s.shrinkSec;

/** Where a circle's fly (or bee) is: on a straight line from off screen, at the middle as the circle disappears. */
export function flyAt(
  s: FlySwatterState,
  c: Circle,
  turnTime = s.turnTime,
): { x: number; y: number } {
  const k = Math.min(1, Math.max(0, (turnTime - c.bornAt) / s.shrinkSec));
  return { x: c.fromX + (c.x - c.fromX) * k, y: c.fromY + (c.y - c.fromY) * k };
}

/** A spot off screen to fly in from: past the screen's edge, in a random direction from the circle. */
function offScreen(rng: RngState, x: number, y: number): { fromX: number; fromY: number } {
  const angle = nextFloat(rng) * Math.PI * 2;
  const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
  const margin = 16;
  // How far along that direction until it leaves the screen (plus a margin).
  const tx = dx > 0 ? (320 + margin - x) / dx : dx < 0 ? (-margin - x) / dx : Infinity;
  const ty = dy > 0 ? (240 + margin - y) / dy : dy < 0 ? (-margin - y) / dy : Infinity;
  const d = Math.min(tx, ty);
  return { fromX: x + dx * d, fromY: y + dy * d };
}

function startTurn(s: FlySwatterState): FlySwatterState {
  return {
    ...s,
    turnTime: 0,
    spawned: 0,
    swats: 0,
    strikes: 0,
    circles: [],
    nextSpawnAt: 0,
  };
}

export function newFlySwatter(
  options: FlySwatterOptions,
  order: readonly string[],
  seed: number,
): FlySwatterState {
  const t = FS.tiers[options.tier];
  const bees =
    options.bees === 'off' ? 0 : options.bees === 'on' ? Math.max(t.bees, FS.beesOn) : t.bees;
  return startTurn({
    tier: options.tier,
    flies: t.flies,
    size: t.circle + (options.bigger ?? 0),
    shrinkSec: t.shrinkSec + (options.slowerShrink ?? 0),
    everySec: t.everySec,
    maxUp: t.maxUp,
    beeShare: bees,
    strikesAllowed: typeof options.strikes === 'number' ? options.strikes : t.strikes,
    stray: t.stray,
    turns: newTurns(order),
    turnTime: 0,
    spawned: 0,
    swats: 0,
    strikes: 0,
    circles: [],
    nextSpawnAt: 0,
    nextId: 1,
    events: [],
    record: {},
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  });
}

function finish(s: FlySwatterState): FlySwatterState {
  const id = current(s.turns);
  const passed = s.strikes < s.strikesAllowed;
  const record = id ? { ...s.record, [id]: { swats: s.swats, strikes: s.strikes } } : s.record;
  const turns = endTurn(s.turns, passed);
  const next = { ...s, record, turns, circles: [] };
  if (allDone(turns)) return { ...next, over: true };
  return startTurn(next);
}

/** Recent events only (the screen shows a splat for [0.6 s]). */
const recent = (s: FlySwatterState) => s.events.filter((e) => s.time - e.at < 1);

/** The round is over: strikes used up, or every fly has come and every circle is gone. */
function maybeFinish(s: FlySwatterState): FlySwatterState {
  if (s.strikes >= s.strikesAllowed) return finish(s);
  if (s.spawned >= s.flies && s.circles.length === 0) return finish(s);
  return s;
}

/** A tap (or Space with the pointer there) at a scene point. */
export function tapAt(s: FlySwatterState, x: number, y: number): FlySwatterState {
  if (s.over || !playing(s.turns)) return s;
  const under = s.circles.filter((c) => Math.hypot(x - c.x, y - c.y) <= radiusAt(s, c));
  if (under.length === 0) {
    if (!s.stray) return s;
    const out = {
      ...s,
      strikes: s.strikes + 1,
      events: [...recent(s), { at: s.time, kind: 'stray' as const, x, y }],
    };
    return maybeFinish(out);
  }
  // The one closest to disappearing.
  const hit = under.reduce((a, b) => (endsAt(s, b) < endsAt(s, a) ? b : a));
  const circles = s.circles.filter((c) => c !== hit);
  const out: FlySwatterState = hit.bee
    ? {
        ...s,
        circles,
        strikes: s.strikes + 1,
        events: [...recent(s), { at: s.time, kind: 'sting', x: hit.x, y: hit.y }],
      }
    : {
        ...s,
        circles,
        swats: s.swats + 1,
        events: [...recent(s), { at: s.time, kind: 'swat', ...flyAt(s, hit) }],
      };
  return maybeFinish(out);
}

export function tick(s0: FlySwatterState, dt: number): FlySwatterState {
  if (s0.over) return s0;
  let s: FlySwatterState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  const rng: RngState = [...s.rng];
  const turnTime = s.turnTime + dt;
  s = { ...s, turnTime };

  // Circles that run out: a fly lands (a strike); a bee just goes.
  const ended = s.circles.filter((c) => turnTime >= endsAt(s, c));
  if (ended.length) {
    const landed = ended.filter((c) => !c.bee);
    s = {
      ...s,
      circles: s.circles.filter((c) => !ended.includes(c)),
      strikes: s.strikes + landed.length,
      events: [
        ...recent(s),
        ...ended.map((c) => ({
          at: s.time,
          kind: c.bee ? ('gone' as const) : ('land' as const),
          x: c.x,
          y: c.y,
        })),
      ],
    };
    const done = maybeFinish(s);
    if (done !== s) return { ...done, rng };
  }

  // A new circle every so often, while there's room and flies are left.
  if (s.spawned < s.flies && turnTime >= s.nextSpawnAt && s.circles.length < s.maxUp) {
    const bee = s.beeShare > 0 && nextFloat(rng) < s.beeShare;
    const x = AREA.left + nextFloat(rng) * (AREA.right - AREA.left);
    const y = AREA.top + nextFloat(rng) * (AREA.bottom - AREA.top);
    const c: Circle = { id: s.nextId, x, y, ...offScreen(rng, x, y), bornAt: turnTime, bee };
    s = {
      ...s,
      circles: [...s.circles, c],
      nextId: s.nextId + 1,
      spawned: s.spawned + (bee ? 0 : 1),
      nextSpawnAt: turnTime + s.everySec,
    };
  }
  return { ...s, rng };
}

/** Who passed (strikes to spare); those who failed lose [1] energy. */
export const result = (s: FlySwatterState): MinigameResult =>
  quickResult(s.turns.order, (id) => s.turns.done[id] === true);

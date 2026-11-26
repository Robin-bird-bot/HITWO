/**
 * Rock Climb (docs/design/19-minigames-signs-trails.md, section 4), a
 * passing challenge: climb a wall by jumping between holds in the right
 * hikers' colors.
 *
 * - **The color sequence (Wyatt):** hands take turns (left, then right),
 *   and each move uses the next color in the sequence; that hand can only
 *   grab holds of its color. The sequence is shuffled so every hiker gets
 *   the same number of turns: [8] long with an even number of hikers, [9]
 *   with an odd number, then a new shuffle.
 * - **The wall:** a path of holds in the sequence's order, each above the
 *   last and [40–90] units away (within the aim's half circle), so the
 *   climb is always possible; decoys in other colors on every screen.
 * - **A move:** the arrow swings over the top; hold to stop it, and a
 *   power meter fills and empties; let go to jump [30–110] units that way.
 *   During the jump, tap a hold of the active hand's color within reach to
 *   grab it (from Tier III, one try per jump).
 * - **A fall** (no grab): the climber slides back to the last hold; the
 *   hiker whose color that hand had fails, once (later falls only cost
 *   time); the same hand and color go again.
 * - **Results:** the top in time: hikers who never fell pass, the rest
 *   fail (they lose [1] energy). Time runs out: nobody passes.
 *
 * Wall positions: x across, h up from the start.
 *
 * TODO(wyatt): 5 or 6 hikers can't share 8 or 9 turns evenly. Wyatt doesn't
 * expect parties that big, so for now the extra turns go to some hikers.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import type { MinigameResult, Pay, Tier } from '../types';

const R = BALANCE.minigames.rockClimb;

export interface Hold {
  id: number;
  x: number;
  h: number;
  /** Whose color it is (a hiker id), or null for a hold nobody can grab. */
  color: string | null;
  /** Its place on the planned path (null: a decoy). */
  path: number | null;
}

export interface RockClimbOptions {
  tier: Tier;
  /** Holds to the top ("auto": the tier's). */
  holds?: number | 'auto';
  /** Time (seconds; "auto": the tier's). */
  timeSec?: number | 'auto';
  /** Grab tries per jump ("auto": the tier's). */
  tries?: 'auto' | 'one' | 'any';
}

export type ClimbPhase = 'aim' | 'power' | 'jump' | 'slide' | 'top' | 'out';

export interface RockClimbState {
  tier: Tier;
  order: readonly string[];
  holds: Hold[];
  /** The planned path's holds in order (ids). */
  path: number[];
  reach: number;
  oneTry: boolean;
  swingSec: number;
  powerSec: number;
  timeSec: number;
  timeLeft: number;
  /** The last path hold grabbed (−1: still at the start), and where the climber hangs. */
  pathAt: number;
  at: { x: number; h: number };
  /** Moves made (the hands alternate: even left, odd right). */
  moves: number;
  phase: ClimbPhase;
  /** When the phase began (game time). */
  phaseAt: number;
  /** Power: the arrow's angle (degrees, 0 right, 180 left) once stopped. */
  aimDeg: number;
  /** The jump under way: where from, which way (degrees), how far, and whether its one try is used. */
  jump: { from: { x: number; h: number }; deg: number; dist: number; tried: boolean } | null;
  /** Hikers who've fallen (each fails once). */
  fell: string[];
  /** The last grab (for a moment's flash) and the last fall. */
  lastGrab?: { at: number; hold: number };
  lastFall?: { at: number; by: string };
  time: number;
  over: boolean;
  rng: RngState;
}

/**
 * The color sequence: each hiker the same number of times in [8] (even
 * party) or [9] (odd), shuffled. TODO(wyatt): with 5 or 6 hikers the split
 * can't be even; the leftover turns go to the first hikers of a shuffle.
 */
export function makeSequence(rng: RngState, order: readonly string[]): string[] {
  const n = order.length;
  if (n === 0) return [];
  const len = n % 2 === 0 ? R.seqEven : R.seqOdd;
  const each = Math.floor(len / n);
  const items = order.flatMap((id) => Array.from({ length: each }, () => id));
  items.push(...shuffle(rng, order).slice(0, len - items.length));
  return shuffle(rng, items);
}

/** The color for each move along the path: sequences one after another. */
function colorsFor(rng: RngState, order: readonly string[], n: number): string[] {
  const out: string[] = [];
  while (out.length < n) out.push(...makeSequence(rng, order));
  return out.slice(0, n);
}

/**
 * Plans the wall: a path of holds, each above the last, [40–90] away and
 * at least [25°] off flat, inside the wall's edges; then decoys on every
 * screen, never in a color a nearby path hold needs (a neutral hold when
 * every party color is taken).
 */
export function planWall(
  rng: RngState,
  tier: Tier,
  order: readonly string[],
  count: number,
): { holds: Hold[]; path: number[] } {
  const t = R.tiers[tier];
  const colors = colorsFor(rng, order, count);
  const holds: Hold[] = [];
  const path: number[] = [];
  let p = { x: 160, h: 0 };
  const min = (R.minTurnDeg * Math.PI) / 180;
  for (let k = 0; k < count; k++) {
    let next = p;
    for (let tries = 0; tries < 200; tries++) {
      const ang = min + nextFloat(rng) * (Math.PI - 2 * min);
      const dist = R.step[0] + nextFloat(rng) * (R.step[1] - R.step[0]);
      const x = p.x + Math.cos(ang) * dist;
      if (x < R.wallX[0] || x > R.wallX[1]) continue;
      next = { x, h: p.h + Math.sin(ang) * dist };
      break;
    }
    if (next === p) next = { x: p.x < 160 ? p.x + 30 : p.x - 30, h: p.h + 60 };
    holds.push({ id: holds.length, x: next.x, h: next.h, color: colors[k]!, path: k });
    path.push(holds.length - 1);
    p = next;
  }
  // Decoys: the tier's number per screen, clear of the path.
  const top = p.h;
  for (let floor = 0; floor < top + R.screen; floor += R.screen) {
    for (let d = 0; d < t.decoys; d++) {
      for (let tries = 0; tries < 60; tries++) {
        const x = R.wallX[0] + nextFloat(rng) * (R.wallX[1] - R.wallX[0]);
        const h = floor + nextFloat(rng) * R.screen;
        if (h < 30 || h > top + 40) continue;
        if (holds.some((o) => Math.hypot(o.x - x, o.h - h) < R.decoyClear)) continue;
        holds.push({
          id: holds.length,
          x,
          h,
          color: decoyColor(rng, order, holds, path, t.reach, x, h),
          path: null,
        });
        break;
      }
    }
  }
  return { holds, path };
}

/**
 * A decoy's color. Best: a party color no move starting within jumping range
 * needs (it can't be grabbed then). Otherwise a color whose grab can't strand
 * the climber: for every move needing it nearby, that move's own hold is
 * still reachable from the decoy (above it, within a jump). Otherwise a
 * hold nobody can grab.
 */
function decoyColor(
  rng: RngState,
  order: readonly string[],
  holds: readonly Hold[],
  path: readonly number[],
  reach: number,
  x: number,
  h: number,
): string | null {
  const range = R.power[1] + reach;
  const moves = path.map((id, k) => {
    const from = k === 0 ? { x: 160, h: 0 } : holds[path[k - 1]!]!;
    return { from, to: holds[id]! };
  });
  const near = moves.filter((m) => Math.hypot(m.from.x - x, m.from.h - h) <= range);
  const pickOf = (ids: readonly string[]) =>
    ids.length ? ids[Math.floor(nextFloat(rng) * ids.length)]! : null;
  const free = order.filter((id) => !near.some((m) => m.to.color === id));
  if (free.length) return pickOf(free);
  const safe = order.filter((id) =>
    near
      .filter((m) => m.to.color === id)
      .every((m) => {
        const d = Math.hypot(m.to.x - x, m.to.h - h);
        return m.to.h > h + 5 && d >= R.power[0] && d <= R.power[1] - 5;
      }),
  );
  return pickOf(safe);
}

export function newRockClimb(
  options: RockClimbOptions,
  order: readonly string[],
  seed: number,
): RockClimbState {
  const t = R.tiers[options.tier];
  const rng = seedRng(seed);
  const count = typeof options.holds === 'number' ? options.holds : t.holds;
  const timeSec = typeof options.timeSec === 'number' ? options.timeSec : t.timeSec;
  const { holds, path } = planWall(rng, options.tier, order, count);
  return {
    tier: options.tier,
    order,
    holds,
    path,
    reach: t.reach,
    oneTry: options.tries === 'one' ? true : options.tries === 'any' ? false : t.oneTry,
    swingSec: t.swingSec,
    powerSec: t.powerSec,
    timeSec,
    timeLeft: timeSec,
    pathAt: -1,
    at: { x: 160, h: 0 },
    moves: 0,
    phase: order.length ? 'aim' : 'out',
    phaseAt: 0,
    aimDeg: 90,
    jump: null,
    fell: [],
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The next path hold, whose color the active hand needs. */
export const nextHold = (s: RockClimbState): Hold | undefined =>
  s.holds[s.path[s.pathAt + 1] ?? -1];

/** Whose color the active hand has (the next path hold's), and which hand it is. */
export const activeColor = (s: RockClimbState): string | null => nextHold(s)?.color ?? null;
export const activeHand = (s: RockClimbState): 'left' | 'right' =>
  s.moves % 2 === 0 ? 'left' : 'right';

/** A back-and-forth: 0 → 1 → 0 over two `sec`s. */
const tri = (t: number, sec: number) => {
  const m = (t / sec) % 2;
  return m < 1 ? m : 2 - m;
};

/** The arrow's angle now (degrees: 180 left, 90 up, 0 right), swinging over the top. */
export const aimNow = (s: RockClimbState): number =>
  s.phase === 'aim' ? 180 - 180 * tri(s.time - s.phaseAt, s.swingSec) : s.aimDeg;

/** The power meter now (0 to 1), filling and emptying while held. */
export const powerNow = (s: RockClimbState): number =>
  s.phase === 'power' ? tri(s.time - s.phaseAt, s.powerSec) : 0;

/** Where the moving hand is: at the hold, or partway through a jump (easing out). */
export function handAt(s: RockClimbState): { x: number; h: number } {
  if (s.phase !== 'jump' || !s.jump) return s.at;
  const k = Math.min(1, (s.time - s.phaseAt) / R.jumpSec);
  const e = 1 - (1 - k) * (1 - k);
  const rad = (s.jump.deg * Math.PI) / 180;
  return {
    x: s.jump.from.x + Math.cos(rad) * s.jump.dist * e,
    h: s.jump.from.h + Math.sin(rad) * s.jump.dist * e,
  };
}

/** Hold (press): the arrow stops, and the power meter starts. */
export function hold(s: RockClimbState): RockClimbState {
  if (s.over || s.phase !== 'aim') return s;
  return { ...s, phase: 'power', phaseAt: s.time, aimDeg: aimNow(s) };
}

/** Let go: the climber jumps that way, as far as the power says. */
export function letGo(s: RockClimbState): RockClimbState {
  if (s.over || s.phase !== 'power') return s;
  const dist = R.power[0] + powerNow(s) * (R.power[1] - R.power[0]);
  return {
    ...s,
    phase: 'jump',
    phaseAt: s.time,
    jump: { from: s.at, deg: s.aimDeg, dist, tried: false },
  };
}

/** A tap on a hold during a jump: grabs it if it's the hand's color and within reach. */
export function grab(s: RockClimbState, holdId: number): RockClimbState {
  if (s.over || s.phase !== 'jump' || !s.jump) return s;
  const h = s.holds[holdId];
  if (!h || h.color === null || h.color !== activeColor(s)) return s;
  if (s.oneTry && s.jump.tried) return s;
  const hand = handAt(s);
  if (Math.hypot(hand.x - h.x, hand.h - h.h) > s.reach) {
    return s.oneTry ? { ...s, jump: { ...s.jump, tried: true } } : s;
  }
  const pathAt = h.path !== null ? Math.max(s.pathAt, h.path) : s.pathAt;
  const out: RockClimbState = {
    ...s,
    at: { x: h.x, h: h.h },
    pathAt,
    moves: s.moves + 1,
    jump: null,
    lastGrab: { at: s.time, hold: h.id },
    phase: 'aim',
    phaseAt: s.time,
  };
  return pathAt >= s.path.length - 1 ? { ...out, phase: 'top', over: false } : out;
}

export function tick(s0: RockClimbState, dt: number): RockClimbState {
  if (s0.over) return s0;
  let s: RockClimbState = { ...s0, time: s0.time + dt };
  if (s.phase === 'top' || s.phase === 'out') return { ...s, over: true };
  s = { ...s, timeLeft: s.timeLeft - dt };
  if (s.timeLeft <= 0) return { ...s, timeLeft: 0, phase: 'out', over: true };
  const since = s.time - s.phaseAt;
  if (s.phase === 'jump' && since >= R.jumpSec) {
    // No grab: a fall. The hand's hiker fails (once); the same hand and color go again.
    const by = activeColor(s);
    const fell = by && !s.fell.includes(by) ? [...s.fell, by] : s.fell;
    return {
      ...s,
      fell,
      phase: 'slide',
      phaseAt: s.time,
      lastFall: by ? { at: s.time, by } : s.lastFall,
    };
  }
  if (s.phase === 'slide' && since >= R.slideSec)
    return { ...s, phase: 'aim', phaseAt: s.time, jump: null };
  return s;
}

/** The top in time: hikers who never fell pass (the rest lose [1] energy). Time out: nobody passes. */
export function result(s: RockClimbState): MinigameResult {
  const top = s.pathAt >= s.path.length - 1;
  const passed = top ? s.order.filter((id) => !s.fell.includes(id)) : [];
  const costs: Record<string, Pay> = Object.fromEntries(
    s.order
      .filter((id) => !passed.includes(id))
      .map((id) => [id, { energy: BALANCE.minigames.quick.failEnergy }]),
  );
  return passingResult(s.order, s.tier, passed, costs);
}

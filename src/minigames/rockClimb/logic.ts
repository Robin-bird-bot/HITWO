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
 * - **Grabbing (fixed Nov 26):** tapping a hold of the active hand's color
 *   at any time during the jump queues it; the hand grabs it the moment it
 *   passes within reach, including in the [0.25 s] hang at the end of the
 *   [0.9 s] jump. Space (or a tap off any hold) queues the hold the rest of
 *   the jump passes closest to. From Tier III the queued grab is the one
 *   try; at Tiers I and II a new tap replaces it.
 * - **Tries and falls** (22-minigame-revisions.md, section 2.1): each hiker
 *   has [3] tries. A fall (no grab) drops the climber off the screen and
 *   costs the hiker whose color the hand had one try and [1] energy (paid
 *   at the end, even if they pass later); the same hand and color go again.
 *   The Harness takes the first fall: no try, no energy.
 * - **Out of tries:** the hiker leaves the color sequence, and every hold in
 *   their color changes to a color of a hiker still in (decoys with the same
 *   check as the wall's plan). Everyone out: everyone fails.
 * - **The top** (section 2.2): a line [40–70] above the last path hold. The
 *   last move is a jump, in the next color, that must carry the hand above
 *   it; no grab is needed. Short of it is a fall.
 * - **No timer** by default (the Time setting stays for testing).
 * - **Results:** over the top, every hiker still in passes and moves on;
 *   hikers who are out stay back and pay nothing more (their falls already
 *   cost energy). Time out (testing) or everyone out: nobody passes.
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
  /** Time (seconds; "auto": no timer). */
  timeSec?: number | 'auto';
  /** Grab tries per jump ("auto": the tier's). */
  tries?: 'auto' | 'one' | 'any';
  /** Tries each hiker has ("auto": [3]). */
  triesEach?: number | 'auto';
  /** Prepare: more grab reach (Chalk), the first fall free (Harness), +1 try for some hikers. */
  extraReach?: number;
  harness?: boolean;
  extraTries?: Readonly<Record<string, number>>;
}

/** `fall`: dropping off the screen, then the box, then the camera back to the last hold. */
export type ClimbPhase = 'aim' | 'power' | 'jump' | 'fall' | 'top' | 'out';

/** Holds that changed color when a hiker went out: they blink from `from` over [0.6 s] at `at`. */
export interface Recolor {
  at: number;
  from: string;
  ids: number[];
}

export interface RockClimbState {
  tier: Tier;
  order: readonly string[];
  holds: Hold[];
  /** The planned path's holds in order (ids). */
  path: number[];
  /** The top line (its height), and the last move's color: the jump over it. */
  topH: number;
  topColor: string | null;
  reach: number;
  oneTry: boolean;
  swingSec: number;
  powerSec: number;
  /** 0: no timer. */
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
  /**
   * The jump under way: where from, which way (degrees), how far, whether
   * its one try is used, and the hold queued to grab (if any).
   */
  jump: {
    from: { x: number; h: number };
    deg: number;
    dist: number;
    tried: boolean;
    queued?: number | null;
  } | null;
  /** The Harness: the first fall costs nothing (used up once it saves someone). */
  harness: boolean;
  /** Tries left, and energy the falls cost, by hiker; the hikers who are out, in order. */
  triesLeft: Record<string, number>;
  energy: Record<string, number>;
  out: string[];
  /** The last grab (for a moment's flash), the last fall (who, from where, and whether it put them out). */
  lastGrab?: { at: number; hold: number; fromH: number };
  lastFall?: {
    at: number;
    by: string;
    from: { x: number; h: number };
    hand: { x: number; h: number };
    free: boolean;
    out: boolean;
  };
  recolor?: Recolor;
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
export function colorsFor(rng: RngState, order: readonly string[], n: number): string[] {
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
): { holds: Hold[]; path: number[]; topH: number; topColor: string | null } {
  const t = R.tiers[tier];
  // One more color than holds: the last move is the jump over the top.
  const colors = colorsFor(rng, order, count + 1);
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
  const [lo, hi] = R.topAbove;
  return {
    holds,
    path,
    topH: top + lo + nextFloat(rng) * (hi - lo),
    topColor: colors[count] ?? null,
  };
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
  // No timer unless the testing tab sets one.
  const timeSec = typeof options.timeSec === 'number' ? options.timeSec : 0;
  const each = typeof options.triesEach === 'number' ? options.triesEach : R.tries;
  const { holds, path, topH, topColor } = planWall(rng, options.tier, order, count);
  return {
    tier: options.tier,
    order,
    holds,
    path,
    topH,
    topColor,
    reach: t.reach + (options.extraReach ?? 0),
    harness: options.harness ?? false,
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
    triesLeft: Object.fromEntries(order.map((id) => [id, each + (options.extraTries?.[id] ?? 0)])),
    energy: {},
    out: [],
    time: 0,
    over: order.length === 0,
    rng,
  };
}

/** The next path hold, whose color the active hand needs. */
export const nextHold = (s: RockClimbState): Hold | undefined =>
  s.holds[s.path[s.pathAt + 1] ?? -1];

/** Whether the next move is the last: the jump over the top. */
export const onLastMove = (s: RockClimbState): boolean => s.pathAt >= s.path.length - 1;

/** Whose color the active hand has (the next path hold's, or the top's), and which hand it is. */
export const activeColor = (s: RockClimbState): string | null =>
  onLastMove(s) ? s.topColor : (nextHold(s)?.color ?? null);
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

/** Where the hand is at a moment of the jump: easing out over [0.9 s], then hanging at the end. */
export function handOnJump(
  j: NonNullable<RockClimbState['jump']>,
  since: number,
): { x: number; h: number } {
  const k = Math.min(1, Math.max(0, since / R.jumpSec));
  const e = 1 - (1 - k) * (1 - k);
  const rad = (j.deg * Math.PI) / 180;
  return { x: j.from.x + Math.cos(rad) * j.dist * e, h: j.from.h + Math.sin(rad) * j.dist * e };
}

/** Where the moving hand is: at the hold, or partway through a jump (or hanging at its end). */
export function handAt(s: RockClimbState): { x: number; h: number } {
  if (s.phase !== 'jump' || !s.jump) return s.at;
  return handOnJump(s.jump, s.time - s.phaseAt);
}

/** How close the rest of this jump (and its hang) comes to a hold. */
export function closestApproach(s: RockClimbState, hold: Hold): number {
  if (s.phase !== 'jump' || !s.jump) return Infinity;
  const since = s.time - s.phaseAt;
  let best = Infinity;
  for (let t = since; t <= R.jumpSec + 1e-9; t += 0.02) {
    const p = handOnJump(s.jump, t);
    best = Math.min(best, Math.hypot(p.x - hold.x, p.h - hold.h));
  }
  return best;
}

/** The active-color holds the rest of this jump passes within reach of (the soft rings). */
export const reachableHolds = (s: RockClimbState): Hold[] =>
  s.holds.filter(
    (h) => h.color !== null && h.color === activeColor(s) && closestApproach(s, h) <= s.reach,
  );

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

/** The hand takes hold: it hangs there, and the next move is the other hand's (the last path hold: the jump over the top). */
function take(s: RockClimbState, h: Hold): RockClimbState {
  const pathAt = h.path !== null ? Math.max(s.pathAt, h.path) : s.pathAt;
  return {
    ...s,
    at: { x: h.x, h: h.h },
    pathAt,
    moves: s.moves + 1,
    jump: null,
    lastGrab: { at: s.time, hold: h.id, fromH: s.at.h },
    phase: 'aim',
    phaseAt: s.time,
  };
}

/**
 * A tap on a hold during a jump (fixed Nov 26): a hold of the active hand's
 * color is queued, and grabbed the moment the hand passes within reach (at
 * once if it's already there). Other colors do nothing. From Tier III the
 * queued grab is the one try; at Tiers I and II a new tap replaces it.
 */
export function grab(s: RockClimbState, holdId: number): RockClimbState {
  // The jump over the top grabs nothing: it only has to clear the line.
  if (s.over || s.phase !== 'jump' || !s.jump || onLastMove(s)) return s;
  const h = s.holds[holdId];
  if (!h || h.color === null || h.color !== activeColor(s)) return s;
  if (s.oneTry && s.jump.tried) return s;
  const out = { ...s, jump: { ...s.jump, tried: true, queued: h.id } };
  const hand = handAt(out);
  return Math.hypot(hand.x - h.x, hand.h - h.h) <= s.reach ? take(out, h) : out;
}

/** Space, or a tap off any hold: queue the active-color hold the rest of the jump passes closest to. */
export function grabClosest(s: RockClimbState): RockClimbState {
  if (s.over || s.phase !== 'jump' || !s.jump || onLastMove(s)) return s;
  const color = activeColor(s);
  const best = s.holds
    .filter((h) => h.color !== null && h.color === color)
    .map((h) => ({ h, d: closestApproach(s, h) }))
    .sort((a, b) => a.d - b.d)[0];
  return best ? grab(s, best.h.id) : s;
}

/** How long a fall takes, all told: dropping off the screen, the box, and the camera sliding back. */
export const fallDropSec = Math.sqrt((2 * R.fall.drop) / R.fall.gravity);
export const fallSec = fallDropSec + R.fall.boxSec + R.fall.backSec;

/**
 * A hiker goes out (section 2.1): every hold in their color changes to a
 * color of a hiker still in. Path holds still to climb (and the top) are
 * given the colors used least so far among those left, so the turns stay
 * even; decoys get theirs with the wall plan's check (never a color a
 * nearby move needs, unless grabbing it can't strand the climber).
 */
export function goOut(s: RockClimbState, id: string, rng: RngState): RockClimbState {
  const out = [...s.out, id];
  const left = s.order.filter((h) => !out.includes(h));
  if (!left.length) return { ...s, out };
  const holds = s.holds.map((h) => ({ ...h }));
  const ids: number[] = [];
  const pickOf = (list: readonly string[]) => list[Math.floor(nextFloat(rng) * list.length)]!;
  // The moves still to make, in order: the uses so far keep the turns even.
  const uses: Record<string, number> = Object.fromEntries(left.map((h) => [h, 0]));
  const ahead = s.path.slice(s.pathAt + 1).map((pid) => holds[pid]!);
  for (const h of ahead) if (h.color && h.color !== id) uses[h.color] = (uses[h.color] ?? 0) + 1;
  const least = () => {
    const low = Math.min(...left.map((h) => uses[h] ?? 0));
    const c = pickOf(left.filter((h) => (uses[h] ?? 0) === low));
    uses[c] = (uses[c] ?? 0) + 1;
    return c;
  };
  for (const h of ahead) {
    if (h.color !== id) continue;
    h.color = least();
    ids.push(h.id);
  }
  const topColor = s.topColor === id ? least() : s.topColor;
  // Holds already climbed: any color still in (they won't be needed again).
  for (const pid of s.path.slice(0, s.pathAt + 1)) {
    const h = holds[pid]!;
    if (h.color !== id) continue;
    h.color = pickOf(left);
    ids.push(h.id);
  }
  // Decoys: the plan's check against the path as it is now.
  const t = R.tiers[s.tier];
  for (const h of holds) {
    if (h.path !== null || h.color !== id) continue;
    h.color = decoyColor(rng, left, holds, s.path, t.reach, h.x, h.h);
    ids.push(h.id);
  }
  return {
    ...s,
    out,
    holds,
    topColor,
    recolor: { at: s.time + fallDropSec + R.fall.boxSec, from: id, ids },
  };
}

/** No grab: a fall (section 2.1). It costs the hand's hiker a try and [1] energy, unless the Harness takes it. */
function fall(s: RockClimbState): RockClimbState {
  const by = activeColor(s);
  const base = { ...s, phase: 'fall' as const, phaseAt: s.time };
  const hand = handAt(s);
  const record = (free: boolean, isOut: boolean) =>
    by ? { at: s.time, by, from: s.at, hand, free, out: isOut } : s.lastFall;
  if (!by) return base;
  if (s.harness) return { ...base, harness: false, lastFall: record(true, false) };
  const triesLeft = { ...s.triesLeft, [by]: Math.max(0, (s.triesLeft[by] ?? 0) - 1) };
  const energy = { ...s.energy, [by]: (s.energy[by] ?? 0) + R.fallEnergy };
  const isOut = triesLeft[by] === 0;
  const next: RockClimbState = { ...base, triesLeft, energy, lastFall: record(false, isOut) };
  if (!isOut) return next;
  const rng: RngState = [...s.rng];
  return { ...goOut(next, by, rng), rng };
}

export function tick(s0: RockClimbState, dt: number): RockClimbState {
  if (s0.over) return s0;
  let s: RockClimbState = { ...s0, time: s0.time + dt };
  // Over the top: a moment to land on the ledge before it's over.
  if (s.phase === 'top') return s.time - s.phaseAt >= R.topSec ? { ...s, over: true } : s;
  if (s.phase === 'out') return { ...s, over: true };
  if (s.timeSec > 0) {
    s = { ...s, timeLeft: s.timeLeft - dt };
    if (s.timeLeft <= 0) return { ...s, timeLeft: 0, phase: 'out', over: true };
  }
  const since = s.time - s.phaseAt;
  if (s.phase === 'jump' && s.jump) {
    // The last move: over the top the moment the hand clears the line.
    if (onLastMove(s)) {
      const hand = handAt(s);
      if (hand.h >= s.topH)
        return { ...s, at: hand, moves: s.moves + 1, phase: 'top', phaseAt: s.time };
    }
    // A queued grab happens the moment the hand passes within reach.
    const q = s.jump.queued != null ? s.holds[s.jump.queued] : undefined;
    if (q) {
      const hand = handAt(s);
      if (Math.hypot(hand.x - q.x, hand.h - q.h) <= s.reach) return take(s, q);
    }
    if (since >= R.jumpSec + R.hangSec) return fall(s);
  }
  if (s.phase === 'fall' && since >= fallSec) {
    // Everyone out: the climb is over, and nobody passes.
    if (s.out.length >= s.order.length) return { ...s, phase: 'out', over: true, jump: null };
    return { ...s, phase: 'aim', phaseAt: s.time, jump: null };
  }
  return s;
}

/**
 * Over the top: every hiker still in passes; hikers who are out stay back
 * and pay nothing more. Every fall's energy is paid, passed or not. Time
 * out (testing) or everyone out: nobody passes.
 */
export function result(s: RockClimbState): MinigameResult {
  const top = s.phase === 'top';
  const passed = top ? s.order.filter((id) => !s.out.includes(id)) : [];
  const costs: Record<string, Pay> = Object.fromEntries(
    s.order.filter((id) => (s.energy[id] ?? 0) > 0).map((id) => [id, { energy: s.energy[id]! }]),
  );
  return passingResult(s.order, s.tier, passed, costs);
}

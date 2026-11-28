/**
 * Wrong Turn (docs/design/30-quick-minigames.md, section 2): the party took
 * a wrong turn. Each hiker in turn swings a compass needle onto a bearing
 * and holds it in the notch until it locks.
 *
 * - Holding A (or the left half) turns the needle left, D (or the right
 *   half) right. It speeds up while held, keeps going a little when let go,
 *   overshoots, and settles: the needle springs after where the keys point.
 * - In the notch, HOLD TO LOCK fills; out of it, the bar drains [2×] as fast.
 *   A locked bearing flashes (the clock stops a moment), and the next hiker
 *   gets the next bearing, at least [60°] from the last.
 * - One bearing per hiker, and at least [3] (fewer hikers take turns).
 * - From Tier III the needle wobbles on its own; from Tier IV the notch hides
 *   a moment into each bearing (the bearing's number stays in the list).
 * - A passing challenge for the whole party: every bearing locked before the
 *   clock runs out passes everyone; else nobody.
 * - Prepare: FOOD adds seconds, a CAIRN widens the notch, a LUCKY CHARM locks
 *   in half the time, and a SUPPLY MAP keeps the notch showing and the
 *   needle still.
 *
 * Pure and seeded. Angles are degrees, clockwise from north; the needle's
 * angle isn't wrapped (it can wind past 360), bearings are 0 to 359.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import type { MinigameResult, Tier } from '../types';

const W = BALANCE.minigames.wrongTurn;

export interface WrongTurnOptions {
  tier: Tier;
  /** The clock per bearing ("auto": the tier's). */
  clockSec?: number | 'auto';
  /** Prepare: seconds added, CAIRNs, a LUCKY CHARM, a SUPPLY MAP. */
  extraSec?: number;
  cairns?: number;
  charm?: number;
  map?: number;
}

export type Turn = -1 | 0 | 1;

export interface WrongTurnState {
  tier: Tier;
  order: readonly string[];
  /** The bearings to lock, and whose each is. */
  bearings: readonly number[];
  whose: readonly string[];
  /** The bearing up now (bearings.length once all are locked). */
  at: number;
  notchDeg: number;
  holdSec: number;
  /** The needle's wobble (0: none), and when the notch hides (null: never). */
  wobbleDeg: number;
  hideSec: number | null;
  clockSec: number;
  timeLeft: number;
  /** Where the keys point (and how fast that's turning), and the needle. */
  aim: number;
  aimSpeed: number;
  needle: number;
  needleSpeed: number;
  /** The key held now: −1 left, 1 right. */
  turn: Turn;
  /** Seconds of HOLD TO LOCK filled. */
  hold: number;
  /** Seconds into this bearing (the notch hides after a while). */
  bearingTime: number;
  /** A lock flashing (the clock stopped), seconds left of it. */
  flash: number;
  lastLock?: { at: number; index: number };
  wobblePhase: readonly [number, number];
  time: number;
  over: boolean;
  passed: boolean;
}

/** −180 to 180: how far to turn from `from` to face `to`, the short way. */
export const turnTo = (from: number, to: number): number => {
  const d = (((to - from) % 360) + 540) % 360;
  return d - 180;
};

/** The bearing up now, or null when they're all locked. */
export const bearingNow = (s: WrongTurnState): number | null => s.bearings[s.at] ?? null;

/** The hiker up now. */
export const whoNow = (s: WrongTurnState): string | undefined => s.whose[s.at];

/** Whether the needle points into the notch. */
export function inNotch(s: WrongTurnState): boolean {
  const b = bearingNow(s);
  return b !== null && Math.abs(turnTo(s.needle, b)) <= s.notchDeg;
}

/** Whether the notch is hidden now (from Tier IV, a moment into each bearing). */
export const notchHidden = (s: WrongTurnState): boolean =>
  s.hideSec !== null && s.bearingTime >= s.hideSec && s.flash <= 0;

/** The wobble the needle springs toward on its own (degrees). */
export const wobbleAt = (s: WrongTurnState, time = s.time): number => {
  if (s.wobbleDeg <= 0) return 0;
  const hz = W.tiers[s.tier].wobbleHz;
  const [p, q] = s.wobblePhase;
  return (
    s.wobbleDeg *
    (0.65 * Math.sin(2 * Math.PI * hz * time + p) +
      0.35 * Math.sin(2 * Math.PI * hz * 1.7 * time + q))
  );
};

/** The bearings: each at least [60°] from the one before (the first from north), on a multiple of [5°]. */
function makeBearings(count: number, rng: RngState): number[] {
  const out: number[] = [];
  let from = 0;
  for (let k = 0; k < count; k++) {
    const away = W.apartDeg + nextFloat(rng) * (180 - W.apartDeg);
    const step = Math.ceil(away / W.roundDeg) * W.roundDeg;
    const b = (((from + (nextFloat(rng) < 0.5 ? -step : step)) % 360) + 360) % 360;
    out.push(b);
    from = b;
  }
  return out;
}

export function newWrongTurn(
  options: WrongTurnOptions,
  order: readonly string[],
  seed: number,
): WrongTurnState {
  const t = W.tiers[options.tier];
  const rng = seedRng(seed);
  const count = order.length === 0 ? 0 : Math.max(W.minBearings, order.length);
  const perBearing = typeof options.clockSec === 'number' ? options.clockSec : t.clockSec;
  const clockSec = perBearing * count + Math.max(0, options.extraSec ?? 0);
  const map = (options.map ?? 0) > 0;
  return {
    tier: options.tier,
    order,
    bearings: makeBearings(count, rng),
    whose: Array.from({ length: count }, (_, k) => order[k % order.length]!),
    at: 0,
    notchDeg: t.notchDeg + W.cairnDeg * Math.max(0, options.cairns ?? 0),
    holdSec: t.holdSec * ((options.charm ?? 0) > 0 ? W.charmHold : 1),
    wobbleDeg: map ? 0 : t.wobbleDeg,
    hideSec: map ? null : t.hideSec,
    clockSec,
    timeLeft: clockSec,
    aim: 0,
    aimSpeed: 0,
    needle: 0,
    needleSpeed: 0,
    turn: 0,
    hold: 0,
    bearingTime: 0,
    flash: 0,
    wobblePhase: [nextFloat(rng) * Math.PI * 2, nextFloat(rng) * Math.PI * 2],
    time: 0,
    over: count === 0,
    passed: false,
  };
}

/** A key held or let go (A or D, or a half of the screen). */
export const setTurn = (s: WrongTurnState, turn: Turn): WrongTurnState =>
  s.over || s.turn === turn ? s : { ...s, turn };

export function tick(s0: WrongTurnState, dt: number): WrongTurnState {
  if (s0.over) return s0;
  let s: WrongTurnState = { ...s0, time: s0.time + dt };
  // A lock flashing: the clock waits, then the next bearing starts.
  if (s.flash > 0) {
    const flash = s.flash - dt;
    if (flash > 0) return { ...s, flash };
    return { ...s, flash: 0, bearingTime: 0, hold: 0 };
  }
  const timeLeft = s.timeLeft - dt;
  if (timeLeft <= 0) return { ...s, timeLeft: 0, over: true, passed: false };

  // Where the keys point: speeding up while held, coasting a little when let go.
  const N = W.needle;
  let aimSpeed = s.aimSpeed;
  if (s.turn !== 0) {
    if (Math.sign(aimSpeed) !== s.turn) aimSpeed = 0;
    aimSpeed = Math.max(-N.maxSpeed, Math.min(N.maxSpeed, aimSpeed + s.turn * N.accel * dt));
  } else {
    aimSpeed *= Math.exp(-dt / N.coastSec);
  }
  const aim = s.aim + aimSpeed * dt;

  // The needle springs after it (and the wobble), overshooting more the springier it is.
  const w = 2 * Math.PI * N.springHz;
  const goal = aim + wobbleAt(s);
  const pull = w * w * (goal - s.needle) - 2 * W.tiers[s.tier].damping * w * s.needleSpeed;
  const needleSpeed = s.needleSpeed + pull * dt;
  const needle = s.needle + needleSpeed * dt;
  s = { ...s, timeLeft, aim, aimSpeed, needle, needleSpeed, bearingTime: s.bearingTime + dt };

  const hold = inNotch(s) ? s.hold + dt : Math.max(0, s.hold - W.drainTimes * dt);
  if (hold < s.holdSec) return { ...s, hold };
  // Locked.
  const at = s.at + 1;
  const locked = { ...s, hold: s.holdSec, at, lastLock: { at: s.time, index: s.at } };
  if (at >= s.bearings.length) return { ...locked, over: true, passed: true };
  return { ...locked, flash: W.lockPauseSec };
}

/** Every bearing locked: everyone passes; else nobody does (a passing challenge). */
export const result = (s: WrongTurnState): MinigameResult =>
  passingResult(s.order, s.tier, s.passed ? s.order : [], {});

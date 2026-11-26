/**
 * Firefly Catch (docs/design/18-minigames-quick.md, section 2): a firefly
 * bounces around a night meadow. Tap when it's inside your jar ring.
 *
 * - One hiker at a time, in line order, each with the tier's time.
 * - The firefly flies in straight lines and bounces off the box's edges;
 *   every [0.5–1 s] its heading wobbles by up to ±[20°].
 * - The ring drifts and bounces too, faster at higher tiers.
 * - A tap is a catch if the firefly's center is inside the ring: a new
 *   firefly appears at least [60] units from the ring. From Tier II a miss
 *   costs [1 s].
 * - From Tier III the firefly goes dark for a moment every [1.5–2.5 s]. It
 *   can still be caught.
 * - The hiker passes with the catches needed before their time runs out.
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

const F = BALANCE.minigames.fireflyCatch;
const BOX = F.box;

export interface FireflyOptions {
  tier: Tier;
  /** The Catches setting ("auto": the tier's). */
  catches?: number | 'auto';
  /** The Time setting, seconds per hiker ("auto": the tier's). */
  timeSec?: number | 'auto';
}

/** Something moving in a straight line: where it is, and its heading (radians). */
export interface Mover {
  x: number;
  y: number;
  angle: number;
}

export interface FireflyState {
  tier: Tier;
  catchesNeeded: number;
  timeSec: number;
  /** The ring's size (across, units), and speeds (units a second). */
  ring: number;
  speed: number;
  drift: number;
  turns: Turns;
  /** This hiker's turn. */
  caught: number;
  timeLeft: number;
  /** Seconds into this hiker's turn. */
  turnTime: number;
  fly: Mover;
  ringAt: Mover;
  /** When the firefly's heading wobbles next, and when it next goes dark (turn time). */
  wobbleAt: number;
  darkAt: number;
  /** The last catch (the firefly flying to the jar) and the last miss, for the screen. */
  lastCatch?: { at: number; x: number; y: number; by: string };
  lastMiss?: { at: number };
  /** Each hiker's catches, once done. */
  record: Readonly<Record<string, number>>;
  time: number;
  over: boolean;
  rng: RngState;
}

const span = (rng: RngState, [a, b]: readonly [number, number]) => a + nextFloat(rng) * (b - a);

/** Whether the firefly is dark now (from Tier III, for a moment every so often). */
export const isDark = (s: FireflyState): boolean =>
  F.tiers[s.tier].darkSec > 0 &&
  s.turnTime >= s.darkAt &&
  s.turnTime < s.darkAt + F.tiers[s.tier].darkSec;

/** Whether the firefly's center is inside the ring. */
export const inRing = (s: FireflyState): boolean =>
  Math.hypot(s.fly.x - s.ringAt.x, s.fly.y - s.ringAt.y) <= s.ring / 2;

/** A new firefly: anywhere in the box, at least [60] units from the ring, heading anywhere. */
function newFly(rng: RngState, ringAt: { x: number; y: number }): Mover {
  for (let k = 0; k < 200; k++) {
    const x = span(rng, [BOX.left, BOX.right]);
    const y = span(rng, [BOX.top, BOX.bottom]);
    if (Math.hypot(x - ringAt.x, y - ringAt.y) >= F.newAway) {
      return { x, y, angle: nextFloat(rng) * Math.PI * 2 };
    }
  }
  // The far corner (never needed with the box this size).
  const x = ringAt.x < (BOX.left + BOX.right) / 2 ? BOX.right : BOX.left;
  const y = ringAt.y < (BOX.top + BOX.bottom) / 2 ? BOX.bottom : BOX.top;
  return { x, y, angle: nextFloat(rng) * Math.PI * 2 };
}

/** Moves something in a straight line, bouncing off the box's edges (kept `pad` inside them). */
export function bounce(m: Mover, speed: number, dt: number, pad: number): Mover {
  let x = m.x + Math.cos(m.angle) * speed * dt;
  let y = m.y + Math.sin(m.angle) * speed * dt;
  let dx = Math.cos(m.angle);
  let dy = Math.sin(m.angle);
  const [l, r, t, b] = [BOX.left + pad, BOX.right - pad, BOX.top + pad, BOX.bottom - pad];
  if (x < l) [x, dx] = [2 * l - x, Math.abs(dx)];
  if (x > r) [x, dx] = [2 * r - x, -Math.abs(dx)];
  if (y < t) [y, dy] = [2 * t - y, Math.abs(dy)];
  if (y > b) [y, dy] = [2 * b - y, -Math.abs(dy)];
  return {
    x: Math.min(r, Math.max(l, x)),
    y: Math.min(b, Math.max(t, y)),
    angle: Math.atan2(dy, dx),
  };
}

/** A fresh turn for the hiker now up: the ring somewhere in the box, a firefly away from it. */
function startTurn(s: FireflyState, rng: RngState): FireflyState {
  const r = s.ring / 2;
  const ringAt: Mover = {
    x: span(rng, [BOX.left + r, BOX.right - r]),
    y: span(rng, [BOX.top + r, BOX.bottom - r]),
    angle: nextFloat(rng) * Math.PI * 2,
  };
  return {
    ...s,
    caught: 0,
    timeLeft: s.timeSec,
    turnTime: 0,
    ringAt,
    fly: newFly(rng, ringAt),
    wobbleAt: span(rng, F.wobbleEverySec),
    darkAt: span(rng, F.darkEverySec),
  };
}

export function newFireflyCatch(
  options: FireflyOptions,
  order: readonly string[],
  seed: number,
): FireflyState {
  const t = F.tiers[options.tier];
  const rng = seedRng(seed);
  const s: FireflyState = {
    tier: options.tier,
    catchesNeeded: typeof options.catches === 'number' ? options.catches : t.catches,
    timeSec: typeof options.timeSec === 'number' ? options.timeSec : t.timeSec,
    ring: t.ring,
    speed: t.speed,
    drift: t.drift,
    turns: newTurns(order),
    caught: 0,
    timeLeft: 0,
    turnTime: 0,
    fly: { x: 0, y: 0, angle: 0 },
    ringAt: { x: 0, y: 0, angle: 0 },
    wobbleAt: 0,
    darkAt: 0,
    record: {},
    time: 0,
    over: order.length === 0,
    rng,
  };
  return startTurn(s, rng);
}

function finish(s: FireflyState, passed: boolean, rng: RngState): FireflyState {
  const id = current(s.turns);
  const record = id ? { ...s.record, [id]: s.caught } : s.record;
  const turns = endTurn(s.turns, passed);
  const next = { ...s, record, turns };
  if (allDone(turns)) return { ...next, over: true };
  return startTurn(next, rng);
}

/** A tap (or Space): a catch when the firefly's center is inside the ring (dark or not), else a miss. */
export function tap(s: FireflyState): FireflyState {
  if (s.over || !playing(s.turns)) return s;
  const rng: RngState = [...s.rng];
  if (inRing(s)) {
    const caught = s.caught + 1;
    const by = current(s.turns) ?? '';
    const out = { ...s, caught, lastCatch: { at: s.time, x: s.fly.x, y: s.fly.y, by } };
    if (caught >= s.catchesNeeded) return { ...finish(out, true, rng), rng };
    return { ...out, fly: newFly(rng, s.ringAt), rng };
  }
  const timeLeft = s.timeLeft - F.tiers[s.tier].missSec;
  const out = { ...s, timeLeft, lastMiss: { at: s.time } };
  if (timeLeft <= 0) return { ...finish({ ...out, timeLeft: 0 }, false, rng), rng };
  return out;
}

export function tick(s0: FireflyState, dt: number): FireflyState {
  if (s0.over) return s0;
  const s: FireflyState = { ...s0, time: s0.time + dt, turns: tickTurns(s0.turns, dt) };
  if (!playing(s.turns)) return s;
  const rng: RngState = [...s.rng];
  const timeLeft = s.timeLeft - dt;
  if (timeLeft <= 0) return { ...finish({ ...s, timeLeft: 0 }, false, rng), rng };

  const turnTime = s.turnTime + dt;
  let fly = bounce(s.fly, s.speed, dt, 0);
  let wobbleAt = s.wobbleAt;
  if (turnTime >= wobbleAt) {
    const turn = ((nextFloat(rng) * 2 - 1) * F.wobbleDeg * Math.PI) / 180;
    fly = { ...fly, angle: fly.angle + turn };
    wobbleAt = turnTime + span(rng, F.wobbleEverySec);
  }
  let darkAt = s.darkAt;
  const darkSec = F.tiers[s.tier].darkSec;
  if (darkSec > 0 && turnTime >= darkAt + darkSec) darkAt = turnTime + span(rng, F.darkEverySec);
  const ringAt = bounce(s.ringAt, s.drift, dt, s.ring / 2);
  return { ...s, timeLeft, turnTime, fly, wobbleAt, darkAt, ringAt, rng };
}

/** Who passed (caught enough in time); those who failed lose [1] energy. */
export const result = (s: FireflyState): MinigameResult =>
  quickResult(s.turns.order, (id) => s.turns.done[id] === true);

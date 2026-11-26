/**
 * Train! (docs/design/17-minigames-lanes.md, section 2): hop between
 * railroad tracks as trains come through. Pure and seeded, in small steps.
 *
 * - **One party sprite,** like Dodge: the active hiker switches every few
 *   seconds, and each hiker has lives. It stands in the middle of the
 *   screen and only hops up and down, one track at a time.
 * - **Trains** (an engine and a few cars) come from the right on Tiers I
 *   and II, from either side from Tier III. Each is warned first (a
 *   headlight flashing at the edge it comes from, and a "!"). At least one
 *   track always stays clear for the next moment.
 * - **A hit** costs the active hiker a life, then a moment of safety; a
 *   hiker with none left is out and the next takes over at once.
 * - **The end:** when the clock runs out (or everyone is out). A passing
 *   challenge: hikers with lives left move on; hikers who are out lose energy.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passingResult } from '../passing';
import type { MinigameResult, Pay, Tier } from '../types';

const T = BALANCE.minigames.train;

export type { Tier };
export type CarKind = 'boxcar' | 'tanker';

/** A train: its track, which way it goes (1 left to right, −1 right to left), its cars, speed and timing. */
export interface Train {
  id: number;
  track: number;
  dir: 1 | -1;
  cars: CarKind[];
  length: number;
  speed: number;
  /** Warned from `warnAt`; it comes onto the screen at `enterAt` and is gone at `leaveAt`. */
  warnAt: number;
  enterAt: number;
  leaveAt: number;
}

export interface TrainState {
  tier: Tier;
  tracks: number;
  order: string[];
  lives: Record<string, number>;
  maxLives: number;
  /** Each hiker's lives at the start (Prepare's +1 LIFE adds to one hiker's). */
  startLives: Record<string, number>;
  /** The share of the tier's speed the trains go (Prepare's SLOWER TRAINS). */
  pace: number;
  active: string;
  switchSec: number;
  switchIn: number;
  /** The sprite's track, and a hop on its way. */
  track: number;
  hop?: { from: number; to: number; at: number };
  trains: Train[];
  nextTrain: number;
  nextId: number;
  safeFor: number;
  warnSec: number;
  fog: boolean;
  lengthSec: number;
  lastHit?: { hikerId: string; at: number };
  time: number;
  over: boolean;
  rng: RngState;
}

export interface TrainOptions {
  tier: Tier;
  /** The testing tab's overrides: "auto" uses the tier's. */
  lives?: 'auto' | number;
  surviveSec?: 'auto' | number;
  fog?: 'auto' | 'on' | 'off';
  /**
   * Prepare (20-challenge-popup.md, section 7): extra lives by hiker, the
   * share slower the trains go, and seconds more warning (fog only).
   */
  extraLives?: Readonly<Record<string, number>>;
  slower?: number;
  brighter?: number;
}

export function newTrain(
  options: TrainOptions,
  order: readonly string[],
  seed: number,
): TrainState {
  const t = T.tiers[options.tier];
  const lives = Math.max(1, typeof options.lives === 'number' ? options.lives : t.lives);
  return {
    tier: options.tier,
    tracks: t.tracks,
    order: [...order],
    lives: Object.fromEntries(order.map((id) => [id, lives + (options.extraLives?.[id] ?? 0)])),
    maxLives: lives,
    startLives: Object.fromEntries(
      order.map((id) => [id, lives + (options.extraLives?.[id] ?? 0)]),
    ),
    pace: 1 - Math.max(0, Math.min(0.8, options.slower ?? 0)),
    active: order[0] ?? '',
    switchSec: T.switchSec,
    switchIn: T.switchSec,
    track: Math.floor((t.tracks - 1) / 2),
    trains: [],
    nextTrain: 0.6,
    nextId: 1,
    safeFor: 0,
    warnSec: t.warnSec + (options.brighter ?? 0),
    fog: options.fog === 'on' ? true : options.fog === 'off' ? false : t.fog,
    lengthSec: typeof options.surviveSec === 'number' ? options.surviveSec : t.surviveSec,
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
}

/** Where a train's body is along the screen now (x from its back to its front, or nothing yet). */
export function trainSpan(tr: Train, time: number): { left: number; right: number } | null {
  if (time < tr.enterAt) return null;
  const run = tr.speed * (time - tr.enterAt);
  if (tr.dir < 0) {
    const left = 322 - run;
    return { left, right: left + tr.length };
  }
  const right = -2 + run;
  return { left: right - tr.length, right };
}

/** Whether a track has a train warned or on it at any time between `from` and `to`. */
const busy = (trains: readonly Train[], track: number, from: number, to: number) =>
  trains.some((tr) => tr.track === track && tr.warnAt <= to && tr.leaveAt >= from);

/** The sprite's track now (the nearer one, part way through a hop). */
export function spriteTrack(s: TrainState): number {
  if (!s.hop) return s.track;
  const u = Math.min(1, (s.time - s.hop.at) / T.hopSec);
  return u < 0.5 ? s.hop.from : s.hop.to;
}

/** Where the sprite is drawn now, as a track number (part way during a hop). */
export function spriteAt(s: TrainState): number {
  if (!s.hop) return s.track;
  const u = Math.min(1, (s.time - s.hop.at) / T.hopSec);
  return s.hop.from + (s.hop.to - s.hop.from) * u;
}

/** A hop up (−1) or down (1), if the sprite isn't already hopping. */
export function hop(s: TrainState, dir: -1 | 1): TrainState {
  if (s.over || s.hop) return s;
  const to = s.track + dir;
  if (to < 0 || to >= s.tracks) return s;
  return { ...s, hop: { from: s.track, to, at: s.time } };
}

/** Hikers still in, in line order. */
export const stillIn = (s: TrainState): string[] => s.order.filter((id) => (s.lives[id] ?? 0) > 0);

/** The next hiker in line after `from` who is still in (wrapping around). */
function nextInLine(s: TrainState, from: string): string | undefined {
  const i = s.order.indexOf(from);
  for (let k = 1; k <= s.order.length; k++) {
    const id = s.order[(i + k) % s.order.length]!;
    if (id !== from && (s.lives[id] ?? 0) > 0) return id;
  }
  return undefined;
}

/** A new train, on a track that leaves at least one track clear for the next moment (or none yet). */
function spawn(s: TrainState, rng: RngState): TrainState {
  const t = T.tiers[s.tier];
  const dir: 1 | -1 = s.tier >= T.bothSidesFrom && nextFloat(rng) < 0.5 ? 1 : -1;
  const n = int(rng, T.cars[0], T.cars[1]);
  const cars = Array.from(
    { length: n },
    () => (nextFloat(rng) < 0.5 ? 'boxcar' : 'tanker') as CarKind,
  );
  const length = T.engineLength + n * T.carLength;
  const speed = (t.speed[0] + nextFloat(rng) * (t.speed[1] - t.speed[0])) * s.pace;
  const warnAt = s.time;
  const enterAt = warnAt + s.warnSec;
  const leaveAt = enterAt + (324 + length) / speed;
  const window = [s.time, s.time + T.clearSec] as const;
  for (const track of shuffle(
    rng,
    Array.from({ length: s.tracks }, (_, k) => k),
  )) {
    if (busy(s.trains, track, warnAt, leaveAt)) continue;
    const blocked = Array.from({ length: s.tracks }, (_, k) => k).filter(
      (k) => k === track || busy(s.trains, k, window[0], window[1]),
    ).length;
    if (blocked >= s.tracks) continue;
    const train: Train = {
      id: s.nextId,
      track,
      dir,
      cars,
      length,
      speed,
      warnAt,
      enterAt,
      leaveAt,
    };
    return {
      ...s,
      trains: [...s.trains, train],
      nextId: s.nextId + 1,
      nextTrain: s.time + t.everySec,
    };
  }
  // No fair track now: try again in a moment.
  return { ...s, nextTrain: s.time + 0.2 };
}

/** Time passes: switching, hops, trains, hits and the clock. */
export function tick(s0: TrainState, dt: number): TrainState {
  if (s0.over) return s0;
  const rng = [...s0.rng] as RngState;
  let s: TrainState = { ...s0, rng, time: s0.time + dt, safeFor: Math.max(0, s0.safeFor - dt) };

  // Switching hikers.
  const next = nextInLine(s, s.active);
  if (next) {
    const switchIn = s.switchIn - dt;
    s = switchIn <= 0 ? { ...s, active: next, switchIn: s.switchSec } : { ...s, switchIn };
  }

  // The hop lands.
  if (s.hop && s.time - s.hop.at >= T.hopSec) {
    s = { ...s, track: s.hop.to };
    delete s.hop;
  }

  // Trains come and go.
  s = { ...s, trains: s.trains.filter((tr) => s.time <= tr.leaveAt) };
  if (s.time >= s.nextTrain) s = spawn(s, rng);

  // A train at the sprite (its middle, x 160) on its track is a hit.
  if (s.safeFor <= 0) {
    const track = spriteTrack(s);
    const hitBy = s.trains.some((tr) => {
      if (tr.track !== track) return false;
      const span = trainSpan(tr, s.time);
      return !!span && span.left < 165 && span.right > 155;
    });
    if (hitBy) {
      const who = s.active;
      const lives = { ...s.lives, [who]: Math.max(0, (s.lives[who] ?? 0) - 1) };
      s = { ...s, lives, safeFor: T.safeSec, lastHit: { hikerId: who, at: s.time } };
      if (lives[who] === 0) {
        const up = nextInLine(s, who);
        s = up ? { ...s, active: up, switchIn: s.switchSec } : { ...s, over: true };
      }
    }
  }

  if (s.time >= s.lengthSec) s = { ...s, over: true };
  return s;
}

/** A passing challenge: hikers with lives left move on; hikers who are out lose energy. */
export function result(s: TrainState): MinigameResult {
  const costs: Record<string, Pay> = {};
  for (const id of s.order) if ((s.lives[id] ?? 0) <= 0) costs[id] = { energy: T.failEnergy };
  return passingResult(s.order, s.tier, stillIn(s), costs);
}

/**
 * Whackoon (docs/design/14-minigames-trail-blocks.md, section 4):
 * whack-a-mole with raccoons popping out of trash cans. Pure and seeded,
 * stepped in small steps. Everyone plays at once, in colors.
 *
 * - **One shared clock** for the party.
 * - **Raccoons** wear a bandit mask in one hiker's color, dealt out evenly
 *   (every hiker's once, shuffled, then again). Each hiker needs a number of
 *   whacks on their own color; reaching it, they're done and pass.
 * - **Done hikers' raccoons** keep popping up: whacking one does nothing,
 *   and the mallet can't swing again for a moment. Be choosy.
 * - **Several up at once:** never fewer than the tier's fewest (when one
 *   goes down, another pops up within a moment), and another every so
 *   often up to the most.
 * - **Skunks** are decoys: whacking one sprays a fog over the cans for a
 *   moment and takes time off the clock.
 * - **The end:** when everyone is done or the clock runs out. Hikers short
 *   of their whacks fail and lose energy. Whackoon isn't a passing challenge.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Pay, Tier } from '../types';

const W = BALANCE.minigames.whackoon;

export type { Tier };

/**
 * Something up in a can: when it came up, when it ducks back down, when it
 * was whacked, and (a raccoon) whose color it wears.
 */
export interface Mole {
  kind: 'raccoon' | 'skunk';
  color?: string;
  upAt: number;
  until: number;
  bonkedAt?: number;
}

export interface WhackoonState {
  tier: Tier;
  order: string[];
  /** The shared clock: what it started at and what's left. */
  clockSec: number;
  timeLeft: number;
  /** The hiker colors still to deal to raccoons. */
  deck: string[];
  /** The mallet can't swing again until this time (after a wasted whack). */
  malletUntil: number;
  /** Whacks each hiker needs on their own color. */
  target: number;
  cols: number;
  rows: number;
  /** Each can, row by row: what's up in it, if anything. */
  cans: (Mole | null)[];
  whacks: Record<string, number>;
  /** When the next one pops up (the rhythm), and when one pops up to keep the fewest up. */
  nextPop: number;
  refillAt: number | null;
  /** The skunk's spray covers the cans until this time. */
  fogUntil: number;
  skunkChance: number;
  time: number;
  over: boolean;
  rng: RngState;
}

export function newWhackoon(
  options: { tier: Tier; skunks?: 'auto' | 'on' | 'off' },
  order: readonly string[],
  seed: number,
): WhackoonState {
  const t = W.tiers[options.tier];
  const skunkChance =
    options.skunks === 'off' ? 0 : options.skunks === 'on' ? t.skunks || W.skunksOn : t.skunks;
  const clockSec = W.secPerHiker * order.length;
  return {
    tier: options.tier,
    order: [...order],
    clockSec,
    timeLeft: clockSec,
    deck: [],
    malletUntil: 0,
    target: t.target,
    cols: t.cols,
    rows: 3,
    cans: Array.from({ length: t.cols * 3 }, () => null),
    whacks: Object.fromEntries(order.map((id) => [id, 0])),
    nextPop: t.everySec,
    refillAt: W.refillSec,
    fogUntil: 0,
    skunkChance,
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
}

/** Whether a hiker has reached their number. */
export const isDone = (s: WhackoonState, id: string): boolean => (s.whacks[id] ?? 0) >= s.target;

/** Whether something in a can is still up and can be whacked. */
const live = (m: Mole | null, time: number): m is Mole =>
  !!m && m.bonkedAt === undefined && time < m.until;

/** How many are up and whackable now. */
export const upNow = (s: Pick<WhackoonState, 'cans' | 'time'>): number =>
  s.cans.filter((m) => live(m, s.time)).length;

/** Pops one up in an empty can: a skunk now and then, otherwise a raccoon in the next color. */
function popOne(s: WhackoonState, rng: RngState): WhackoonState {
  const empty = s.cans.flatMap((m, i) => (m ? [] : [i]));
  if (!empty.length) return s;
  const t = W.tiers[s.tier];
  const i = empty[int(rng, 0, empty.length - 1)]!;
  const kind = nextFloat(rng) < s.skunkChance ? 'skunk' : 'raccoon';
  let deck = s.deck;
  let color: string | undefined;
  if (kind === 'raccoon') {
    if (!deck.length) deck = shuffle(rng, s.order);
    [color, ...deck] = deck;
  }
  const cans = [...s.cans];
  cans[i] = { kind, upAt: s.time, until: s.time + t.upSec, ...(color ? { color } : {}) };
  return { ...s, cans, deck };
}

/** Time passes: things duck down, new ones pop up (never fewer than the fewest), and the clock runs. */
export function tick(s0: WhackoonState, dt: number): WhackoonState {
  if (s0.over) return s0;
  const t = W.tiers[s0.tier];
  const rng = [...s0.rng] as RngState;
  const time = s0.time + dt;
  const timeLeft = s0.timeLeft - dt;
  if (timeLeft <= 0) return { ...s0, rng, time, timeLeft: 0, over: true };

  // Ducking back down (or dropping after a bonk).
  const cans = s0.cans.map((m) =>
    !m
      ? null
      : m.bonkedAt !== undefined
        ? time - m.bonkedAt >= W.bonkSec
          ? null
          : m
        : time >= m.until
          ? null
          : m,
  );
  let s: WhackoonState = { ...s0, rng, time, timeLeft, cans };

  // Never fewer than the fewest: under it, one pops up within a moment (as many as it takes).
  let refillAt = s.refillAt;
  if (upNow(s) < t.minUp) {
    refillAt ??= time + W.refillSec;
    if (time >= refillAt) {
      while (upNow(s) < t.minUp && s.cans.some((m) => !m)) s = popOne(s, rng);
      refillAt = null;
    }
  } else refillAt = null;

  // The rhythm: another now and then, up to the most.
  let nextPop = s.nextPop;
  if (time >= nextPop) {
    nextPop = time + t.everySec;
    if (upNow(s) < t.maxUp) s = popOne(s, rng);
  }
  return { ...s, nextPop, refillAt };
}

/**
 * A whack at a can. A skunk sprays: a fog over the cans and less time. A
 * raccoon counts for the hiker in its color (everyone done ends it). A done
 * hiker's raccoon does nothing, and the mallet can't swing again for a
 * moment; nothing can be whacked while it's resting.
 */
export function whack(
  s: WhackoonState,
  can: number,
): { state: WhackoonState; outcome: 'bonk' | 'spray' | 'wasted' | 'empty' } {
  const m = s.cans[can];
  if (s.over || s.time < s.malletUntil || !live(m ?? null, s.time))
    return { state: s, outcome: 'empty' };
  const cans = [...s.cans];
  if (m!.kind === 'skunk') {
    cans[can] = null;
    return {
      state: {
        ...s,
        cans,
        fogUntil: s.time + W.sprayFogSec,
        timeLeft: s.timeLeft - W.sprayCostSec,
      },
      outcome: 'spray',
    };
  }
  const who = m!.color;
  if (!who) return { state: s, outcome: 'empty' };
  if (isDone(s, who)) {
    return { state: { ...s, malletUntil: s.time + W.donePauseSec }, outcome: 'wasted' };
  }
  cans[can] = { ...m!, bonkedAt: s.time };
  const whacks = { ...s.whacks, [who]: (s.whacks[who] ?? 0) + 1 };
  const next = { ...s, cans, whacks };
  return { state: { ...next, over: s.order.every((id) => isDone(next, id)) }, outcome: 'bonk' };
}

/** Hikers who reached their number pass; the rest fail and lose energy. */
export function result(s: WhackoonState): MinigameResult {
  const pays: Record<string, Pay> = Object.fromEntries(
    s.order.filter((id) => !isDone(s, id)).map((id) => [id, { energy: W.failEnergy }]),
  );
  return { ...passFailResult(s.order, (id) => isDone(s, id)), pays };
}

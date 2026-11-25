/**
 * Whackoon (docs/design/14-minigames-trail-blocks.md, section 4):
 * whack-a-mole with raccoons popping out of trash cans. Pure and seeded,
 * stepped in small steps.
 *
 * - Hikers take turns of a few seconds each, in line order. Raccoons pop
 *   up at random, a few at a time; whack them before they duck back down.
 * - Skunks are decoys: whacking one sprays a fog over the cans for a moment
 *   and takes time off the turn.
 * - The team's whacks add up. Reach the target and everyone passes (it ends
 *   there); miss it and everyone fails and loses energy. Whackoon isn't a
 *   passing challenge.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Pay } from '../types';

const W = BALANCE.minigames.whackoon;

export type Tier = 1 | 2 | 3;

/** Something up in a can: when it came up, when it ducks back down, and when it was whacked. */
export interface Mole {
  kind: 'raccoon' | 'skunk';
  upAt: number;
  until: number;
  bonkedAt?: number;
}

export interface WhackoonState {
  tier: Tier;
  order: string[];
  /** Whose turn it is, and its seconds left. */
  turn: number;
  turnLeft: number;
  cols: number;
  rows: number;
  /** Each can, row by row: what's up in it, if anything. */
  cans: (Mole | null)[];
  whacks: Record<string, number>;
  team: number;
  target: number;
  nextPop: number;
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
  return {
    tier: options.tier,
    order: [...order],
    turn: 0,
    turnLeft: W.turnSec,
    cols: t.cols,
    rows: 3,
    cans: Array.from({ length: t.cols * 3 }, () => null),
    whacks: Object.fromEntries(order.map((id) => [id, 0])),
    team: 0,
    target: t.targetPerHiker * order.length,
    nextPop: t.everySec / 2,
    fogUntil: 0,
    skunkChance,
    time: 0,
    over: order.length === 0,
    rng: seedRng(seed),
  };
}

/** Whose turn it is. */
export const turnHiker = (s: WhackoonState): string | undefined => s.order[s.turn];

/** Whether something in a can is still up and can be whacked. */
const live = (m: Mole | null, time: number): m is Mole =>
  !!m && m.bonkedAt === undefined && time < m.until;

/** Time passes: things duck down, new ones pop up, and turns end. */
export function tick(s0: WhackoonState, dt: number): WhackoonState {
  if (s0.over) return s0;
  const t = W.tiers[s0.tier];
  const rng = [...s0.rng] as RngState;
  const time = s0.time + dt;
  const s: WhackoonState = { ...s0, rng, time, turnLeft: s0.turnLeft - dt };

  // The turn ends: the next hiker, with clear cans; after the last, it's over.
  if (s.turnLeft <= 0) {
    const turn = s.turn + 1;
    if (turn >= s.order.length) return { ...s, turnLeft: 0, over: true };
    return {
      ...s,
      turn,
      turnLeft: W.turnSec,
      cans: s.cans.map(() => null),
      nextPop: time + t.everySec / 2,
      fogUntil: 0,
    };
  }

  // Ducking back down (or dropping after a bonk).
  const cans = s.cans.map((m) =>
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

  // Popping up.
  let nextPop = s.nextPop;
  if (time >= nextPop) {
    nextPop = time + t.everySec;
    const up = cans.filter((m) => live(m, time)).length;
    const empty = cans.flatMap((m, i) => (m ? [] : [i]));
    if (up < t.maxUp && empty.length) {
      const i = empty[int(rng, 0, empty.length - 1)]!;
      cans[i] = {
        kind: nextFloat(rng) < s.skunkChance ? 'skunk' : 'raccoon',
        upAt: time,
        until: time + t.upSec,
      };
    }
  }
  return { ...s, cans, nextPop };
}

/**
 * A whack at a can. A raccoon is bonked and counts for the team (reaching
 * the target ends it). A skunk sprays: a fog over the cans and less time.
 */
export function whack(
  s: WhackoonState,
  can: number,
): { state: WhackoonState; outcome: 'bonk' | 'spray' | 'empty' } {
  const m = s.cans[can];
  const who = turnHiker(s);
  if (s.over || !who || !live(m ?? null, s.time)) return { state: s, outcome: 'empty' };
  const cans = [...s.cans];
  if (m!.kind === 'skunk') {
    cans[can] = null;
    return {
      state: {
        ...s,
        cans,
        fogUntil: s.time + W.sprayFogSec,
        turnLeft: s.turnLeft - W.sprayCostSec,
      },
      outcome: 'spray',
    };
  }
  cans[can] = { ...m!, bonkedAt: s.time };
  const team = s.team + 1;
  return {
    state: {
      ...s,
      cans,
      team,
      whacks: { ...s.whacks, [who]: (s.whacks[who] ?? 0) + 1 },
      over: team >= s.target,
    },
    outcome: 'bonk',
  };
}

/** Everyone passes if the team reached the target; otherwise everyone fails and loses energy. */
export function result(s: WhackoonState): MinigameResult {
  const passed = s.team >= s.target;
  const pays: Record<string, Pay> = passed
    ? {}
    : Object.fromEntries(s.order.map((id) => [id, { energy: W.failEnergy }]));
  return { ...passFailResult(s.order, () => passed), pays };
}

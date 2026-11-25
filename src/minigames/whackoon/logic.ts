/**
 * Whackoon (docs/design/14-minigames-trail-blocks.md, section 4):
 * whack-a-mole with raccoons popping out of trash cans. Pure and seeded,
 * stepped in small steps.
 *
 * Raccoons pop up at random, a few at a time; whack them before they duck
 * back down. Skunks are decoys: whacking one sprays a fog over the cans for
 * a moment and takes time off the clock. Whackoon isn't a passing challenge.
 *
 * Two modes (Nov 25):
 * - **Colors** (the default): one shared clock. Each raccoon wears a mask in
 *   one hiker's color, dealt out evenly, and each hiker needs a number of
 *   whacks on their own color. A hiker who reaches it is done (and passes),
 *   but their raccoons keep popping up: whacking one does nothing, and the
 *   pan can't swing again for a moment. It ends when everyone is done or the
 *   clock runs out; hikers short of their target fail and lose energy.
 * - **Turns:** hikers take turns of a few seconds each, in line order. The
 *   team's whacks add up. Reach the target and everyone passes (it ends
 *   there); miss it and everyone fails and loses energy.
 */
import { BALANCE } from '../../config/balance';
import { int, nextFloat, seedRng, shuffle } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { passFailResult } from '../lineup';
import type { MinigameResult, Pay, Tier } from '../types';

const W = BALANCE.minigames.whackoon;

export type { Tier };

export type WhackoonMode = 'colors' | 'turns';

/**
 * Something up in a can: when it came up, when it ducks back down, and when
 * it was whacked. In Colors, a raccoon wears a hiker's color.
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
  mode: WhackoonMode;
  order: string[];
  /**
   * Turns: whose turn it is, and its seconds left. Colors: the shared
   * clock's seconds left (the turn stays 0).
   */
  turn: number;
  turnLeft: number;
  /** What a full turn (or the shared clock) lasts, for the bar. */
  clockSec: number;
  /** Colors: the hiker colors still to deal to raccoons, and the pan's pause after a wasted whack. */
  deck: string[];
  panUntil: number;
  /** Colors: whacks each hiker needs on their own color. */
  colorTarget: number;
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
  options: { tier: Tier; mode?: WhackoonMode; skunks?: 'auto' | 'on' | 'off' },
  order: readonly string[],
  seed: number,
): WhackoonState {
  const t = W.tiers[options.tier];
  const mode: WhackoonMode = options.mode === 'turns' ? 'turns' : 'colors';
  const skunkChance =
    options.skunks === 'off' ? 0 : options.skunks === 'on' ? t.skunks || W.skunksOn : t.skunks;
  const clockSec = mode === 'colors' ? W.colorSecPerHiker * order.length : W.turnSec;
  return {
    tier: options.tier,
    mode,
    order: [...order],
    turn: 0,
    turnLeft: clockSec,
    clockSec,
    deck: [],
    panUntil: 0,
    colorTarget: t.colorTarget,
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

/** Whose turn it is (Turns mode only). */
export const turnHiker = (s: WhackoonState): string | undefined =>
  s.mode === 'turns' ? s.order[s.turn] : undefined;

/** Colors: whether a hiker has reached their target. */
export const isDone = (s: WhackoonState, id: string): boolean =>
  (s.whacks[id] ?? 0) >= s.colorTarget;

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

  // Colors: the shared clock runs out, and it's over.
  if (s.mode === 'colors' && s.turnLeft <= 0) return { ...s, turnLeft: 0, over: true };

  // Turns: the turn ends; the next hiker, with clear cans; after the last, it's over.
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

  // Popping up. In Colors, each raccoon gets the next color from the deck
  // (every hiker's once, shuffled, then again), so they come out even.
  let nextPop = s.nextPop;
  let deck = s.deck;
  if (time >= nextPop) {
    nextPop = time + t.everySec;
    const up = cans.filter((m) => live(m, time)).length;
    const empty = cans.flatMap((m, i) => (m ? [] : [i]));
    if (up < t.maxUp && empty.length) {
      const i = empty[int(rng, 0, empty.length - 1)]!;
      const kind = nextFloat(rng) < s.skunkChance ? 'skunk' : 'raccoon';
      let color: string | undefined;
      if (s.mode === 'colors' && kind === 'raccoon') {
        if (!deck.length) deck = shuffle(rng, s.order);
        [color, ...deck] = deck;
      }
      cans[i] = { kind, upAt: time, until: time + t.upSec, ...(color ? { color } : {}) };
    }
  }
  return { ...s, cans, nextPop, deck };
}

/**
 * A whack at a can. A skunk sprays: a fog over the cans and less time.
 * - Turns: a raccoon is bonked and counts for the team (reaching the
 *   target ends it).
 * - Colors: a raccoon counts for the hiker in its color (everyone done ends
 *   it). A done hiker's raccoon does nothing, and the pan can't swing again
 *   for a moment; nothing can be whacked while it's paused.
 */
export function whack(
  s: WhackoonState,
  can: number,
): { state: WhackoonState; outcome: 'bonk' | 'spray' | 'wasted' | 'empty' } {
  const m = s.cans[can];
  if (s.over || s.time < s.panUntil || !live(m ?? null, s.time))
    return { state: s, outcome: 'empty' };
  const who = s.mode === 'colors' ? m!.color : turnHiker(s);
  if (m!.kind === 'raccoon' && !who) return { state: s, outcome: 'empty' };
  if (s.mode === 'colors' && m!.kind === 'raccoon' && isDone(s, who!)) {
    return { state: { ...s, panUntil: s.time + W.donePauseSec }, outcome: 'wasted' };
  }
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
  const whacks = { ...s.whacks, [who!]: (s.whacks[who!] ?? 0) + 1 };
  const next = { ...s, cans, team, whacks };
  return {
    state: {
      ...next,
      over: s.mode === 'colors' ? s.order.every((id) => isDone(next, id)) : team >= s.target,
    },
    outcome: 'bonk',
  };
}

/**
 * Colors: hikers who reached their target pass; the rest fail and lose
 * energy. Turns: everyone passes if the team reached the target; otherwise
 * everyone fails and loses energy.
 */
export function result(s: WhackoonState): MinigameResult {
  if (s.mode === 'colors') {
    const pays: Record<string, Pay> = Object.fromEntries(
      s.order.filter((id) => !isDone(s, id)).map((id) => [id, { energy: W.failEnergy }]),
    );
    return { ...passFailResult(s.order, (id) => isDone(s, id)), pays };
  }
  const passed = s.team >= s.target;
  const pays: Record<string, Pay> = passed
    ? {}
    : Object.fromEntries(s.order.map((id) => [id, { energy: W.failEnergy }]));
  return { ...passFailResult(s.order, () => passed), pays };
}

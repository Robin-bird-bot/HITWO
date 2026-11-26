/**
 * Turns for the quick games (docs/design/18-minigames-quick.md, "Turns"):
 * Trail Blazes, Firefly Catch, Size Up, Fly Swatter and Raccoon Shuffle are
 * played one hiker at a time, in line order. Each hiker passes or fails on
 * their own (none is a passing challenge).
 *
 * - Between one hiker and the next there's a short hand-off ("MOM, YOUR
 *   TURN"): the next hiker's turn is set up, but nothing moves yet.
 * - The bottom bar says NOW, WAITING or DONE while playing, and PASSED or
 *   FAILED once everyone's done.
 * - Hikers who fail lose [1] energy (Raccoon Shuffle has its own costs).
 */
import { BALANCE } from '../../config/balance';
import { passFailResult } from '../lineup';
import type { MinigameResult, Pay } from '../types';

const Q = BALANCE.minigames.quick;

export interface Turns {
  order: readonly string[];
  /** Who's playing now (an index into `order`); `order.length` once everyone's done. */
  at: number;
  /** Each finished hiker: whether they passed. */
  done: Readonly<Record<string, boolean>>;
  /** Seconds left of the hand-off before the current hiker starts (0: playing). */
  handoff: number;
}

export const newTurns = (order: readonly string[]): Turns => ({
  order,
  at: 0,
  done: {},
  handoff: 0,
});

/** The hiker playing now (or about to, during a hand-off). */
export const current = (t: Turns): string | undefined => t.order[t.at];

export const allDone = (t: Turns): boolean => t.at >= t.order.length;

/** Whether the current hiker is playing (not over, not in a hand-off). */
export const playing = (t: Turns): boolean => !allDone(t) && t.handoff <= 0;

/** The current hiker is done: record it, and hand off to the next one (if any). */
export function endTurn(t: Turns, passed: boolean): Turns {
  const id = current(t);
  if (!id) return t;
  const at = t.at + 1;
  return {
    ...t,
    at,
    done: { ...t.done, [id]: passed },
    handoff: at < t.order.length ? Q.handoffSec : 0,
  };
}

export const tickTurns = (t: Turns, dt: number): Turns =>
  t.handoff > 0 ? { ...t, handoff: Math.max(0, t.handoff - dt) } : t;

export type TurnWord = 'NOW' | 'WAITING' | 'DONE' | 'PASSED' | 'FAILED';

/** What the bottom bar says for a hiker: DONE while others play, PASSED or FAILED once everyone's done. */
export function turnWord(t: Turns, id: string): TurnWord {
  if (id in t.done) {
    if (!allDone(t)) return 'DONE';
    return t.done[id] ? 'PASSED' : 'FAILED';
  }
  return current(t) === id ? 'NOW' : 'WAITING';
}

/** Who passed, in line order. */
export const passedIds = (t: Turns): string[] => t.order.filter((id) => t.done[id] === true);

/**
 * A quick game's result: who passed and who failed, and what each hiker
 * who failed pays ([1] energy unless `pays` says otherwise).
 */
export function quickResult(
  order: readonly string[],
  passed: (id: string) => boolean,
  pays?: Readonly<Record<string, Pay>>,
): MinigameResult {
  const out: Record<string, Pay> = {};
  for (const id of order) {
    if (pays?.[id]) out[id] = pays[id];
    else if (!passed(id)) out[id] = { energy: Q.failEnergy };
  }
  return { ...passFailResult(order, passed), pays: out };
}

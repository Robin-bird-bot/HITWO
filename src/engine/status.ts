/**
 * "Blocked by status" (Nov 5 update, 2b): an action that only something
 * abnormal about a hiker stops (a threshold state like Exhausted, Morale at
 * 0, a condition like Frozen, being passed out) shows in red, so it's clear
 * something is wrong. Normal limits (Sleep in the day, Tend at night,
 * nowhere to move, already acted) don't count.
 *
 * The test is simple and general: would the action be allowed if every
 * hiker were in normal shape? Conditions plug in by living on the hiker
 * (`hiker.conditions`), so Phase 6's conditions turn red with no extra code.
 */
import { BALANCE } from '../config/balance';
import { validateAction } from './applyAction';
import type { Action, GameState, Hiker } from './types';

/** The same game with every hiker in normal shape: full stats, no conditions, awake. */
export function withoutStatus(state: GameState): GameState {
  const { energy, appetite, morale } = BALANCE.stats.start;
  return {
    ...state,
    hikers: state.hikers.map((h): Hiker => ({
      ...h,
      stats: { energy, appetite, morale },
      conditions: [],
      status: h.status === 'passedOut' ? 'active' : h.status,
    })),
  };
}

/**
 * Why a status stops this action, when that's the only thing stopping it.
 * Returns undefined when the action is allowed, or when something normal
 * stops it.
 */
export function blockedByStatus(state: GameState, action: Action): string | undefined {
  const reason = validateAction(state, action);
  if (reason === null) return undefined;
  return validateAction(withoutStatus(state), action) === null ? reason : undefined;
}

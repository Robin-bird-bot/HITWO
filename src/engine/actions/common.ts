import { canActReason } from '../effects';
import { changeStat } from '../stats';
import type { Action, GameState, Hiker, HikerId, StatAmounts } from '../types';

export function findHiker(state: GameState, id: HikerId): Hiker | undefined {
  return state.hikers.find((h) => h.id === id);
}

/** For apply steps, which only run after validation passed. */
export function mustFindHiker(state: GameState, id: HikerId): Hiker {
  const hiker = findHiker(state, id);
  if (!hiker) throw new Error(`No hiker ${id}`);
  return hiker;
}

/** Why this hiker can't do anything at all right now, if anything. */
export function notActiveReason(hiker: Hiker | undefined): string | undefined {
  if (!hiker) return 'That hiker isn’t in the party.';
  if (hiker.status === 'passedOut') return `${hiker.name} has passed out.`;
  if (hiker.status === 'checkedIn') return `${hiker.name} has checked in.`;
  if (hiker.status !== 'active') return `${hiker.name} has left the hike.`;
  return undefined;
}

/** Why this hiker can't take an action that uses their phase, if anything. */
export function phaseActionReason(
  state: GameState,
  hiker: Hiker | undefined,
  action: Action,
): string | undefined {
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  if (hiker.acted) return `${hiker.name} has already acted this ${state.phase}.`;
  return canActReason(state, hiker, { action, role: 'actor', phase: state.phase });
}

/** Pays a cost one stat at a time, so each change (and any injury) resolves before the next. */
export function payCost(state: GameState, hiker: Hiker, cost: StatAmounts, cause: string): void {
  changeStat(state, hiker, 'appetite', -cost.appetite, cause);
  changeStat(state, hiker, 'energy', -cost.energy, cause);
  changeStat(state, hiker, 'morale', -cost.morale, cause);
}

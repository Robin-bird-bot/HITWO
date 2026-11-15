/**
 * Submit to injury (Wyatt, Nov 14): with no Appetite drain overnight, a hiker
 * can get stuck (too hungry to move, nothing to eat). Taking an injury on
 * purpose raises every stat below the line back up to it, as any injury does.
 * The third one passes the hiker out. The UI confirms it first.
 *
 * TODO(wyatt): first guesses: it's a free action (it doesn't use the
 * hiker's phase), it can be taken any time the hiker is active and no
 * challenge or scavenge is open, and a Star or Hardhat doesn't stop it.
 */
import { addInjury } from '../stats';
import type { Action, GameState } from '../types';
import { findHiker, mustFindHiker } from './common';

type InjureAction = Extract<Action, { type: 'submitToInjury' }>;

export function validateSubmitToInjury(state: GameState, action: InjureAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  if (!hiker) return 'That hiker isn’t in the party.';
  if (hiker.status !== 'active') return `${hiker.name} can’t do that right now.`;
  if (state.challenge) return 'Finish the challenge first.';
  if (state.scavenge) return 'Finish scavenging first.';
  return undefined;
}

export function applySubmitToInjury(state: GameState, action: InjureAction): void {
  addInjury(state, mustFindHiker(state, action.hikerId), 'their choice', { chosen: true });
}

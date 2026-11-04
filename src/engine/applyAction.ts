/**
 * The one way the game changes (CLAUDE.md rule 1): applyAction(state, action)
 * returns a new state and never touches the one passed in.
 */
import { applyDebug } from './actions/debug';
import { applyMove, validateMove } from './actions/move';
import { applyMoveAll, validateMoveAll } from './actions/moveAll';
import {
  applyCancel,
  applyFlip,
  applyScavenge,
  applyTake,
  validateCancel,
  validateFlip,
  validateScavenge,
  validateTake,
} from './actions/scavenge';
import { applySleep, validateSleep } from './actions/sleep';
import { applyUseAbility, validateUseAbility } from './actions/useAbility';
import { endPhase } from './dayLoop';
import type { Action, GameState } from './types';

/** What can happen while a scavenge is open (plus the debug tools). */
const SCAVENGE_STEPS = new Set<Action['type']>([
  'scavengeFlip',
  'scavengeCancel',
  'scavengeTake',
  'debug',
]);

export class InvalidActionError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidActionError';
    this.reason = reason;
  }
}

/** Why the action isn't allowed right now, for the UI to show, or null when it is. */
export function validateAction(state: GameState, action: Action): string | null {
  // An open scavenge waits for a card before anything else happens.
  if (state.scavenge && !SCAVENGE_STEPS.has(action.type)) return 'Finish scavenging first.';
  switch (action.type) {
    case 'move':
      return validateMove(state, action) ?? null;
    case 'moveAll':
      return validateMoveAll(state, action) ?? null;
    case 'sleep':
      return validateSleep(state, action) ?? null;
    case 'useAbility':
      return validateUseAbility(state, action) ?? null;
    case 'scavenge':
      return validateScavenge(state, action) ?? null;
    case 'scavengeFlip':
      return validateFlip(state, action) ?? null;
    case 'scavengeCancel':
      return validateCancel(state) ?? null;
    case 'scavengeTake':
      return validateTake(state, action) ?? null;
    case 'endPhase':
    case 'debug':
      return null;
  }
}

/** The state after the action. Throws InvalidActionError when it isn't allowed. */
export function applyAction(state: GameState, action: Action): GameState {
  const reason = validateAction(state, action);
  if (reason) throw new InvalidActionError(reason);

  const draft = structuredClone(state);
  switch (action.type) {
    case 'move':
      applyMove(draft, action);
      break;
    case 'moveAll':
      applyMoveAll(draft, action);
      break;
    case 'sleep':
      applySleep(draft, action);
      break;
    case 'useAbility':
      applyUseAbility(draft, action);
      break;
    case 'scavenge':
      applyScavenge(draft, action);
      break;
    case 'scavengeFlip':
      applyFlip(draft, action);
      break;
    case 'scavengeCancel':
      applyCancel(draft);
      break;
    case 'scavengeTake':
      applyTake(draft, action);
      break;
    case 'endPhase':
      endPhase(draft);
      break;
    case 'debug':
      applyDebug(draft, action.op);
      break;
  }
  return draft;
}

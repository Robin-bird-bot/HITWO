/**
 * The one way the game changes (CLAUDE.md rule 1): applyAction(state, action)
 * returns a new state and never touches the one passed in.
 */
import { applyDebug } from './actions/debug';
import { applyChoose, applyResolve, validateChoose, validateResolve } from './challenges/resolve';
import { applyAccept, validateAccept } from './challenges/trials';
import { applyPress, validatePress } from './challenges/buttons';
import { applyMove, validateMove } from './actions/move';
import {
  applyDrop,
  applyGive,
  applyReturn,
  validateDrop,
  validateGive,
  validateReturn,
} from './actions/give';
import { applyMoveAll, validateMoveAll } from './actions/moveAll';
import {
  applyCancel,
  applyFlip,
  applyScavenge,
  applyReroll,
  applyTake,
  validateCancel,
  validateFlip,
  validateReroll,
  validateScavenge,
  validateTake,
} from './actions/scavenge';
import { applySleep, validateSleep } from './actions/sleep';
import { applyTend, validateTend } from './actions/tend';
import { applyWatch, validateWatch } from './actions/watch';
import { applyUse, validateUse } from './actions/useItem';
import { applyAbandon, validateAbandon } from './actions/abandon';
import { applyPutOn, applyTakeOff, validatePutOn, validateTakeOff } from './actions/dress';
import { applyPickUp, applyPutDown, validatePickUp, validatePutDown } from './actions/carry';
import { applyUseAbility, validateUseAbility } from './actions/useAbility';
import { endPhase } from './dayLoop';
import { isHikeOver } from './health';
import { pushEvent } from './log';
import { applyAccomplish, validateAccomplish } from './wonders/wonders';
import type { Action, GameState } from './types';

/** What can happen while a scavenge is open (plus the debug tools). */
const SCAVENGE_STEPS = new Set<Action['type']>([
  'scavengeFlip',
  'scavengeCancel',
  'scavengeTake',
  'scavengeReroll',
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
  // Nobody can act any more (the debug panel still works).
  if (action.type !== 'debug' && isHikeOver(state)) return 'The hike is over.';
  // An open scavenge waits for a card before anything else happens.
  if (state.scavenge && !SCAVENGE_STEPS.has(action.type)) return 'Finish scavenging first.';
  // So does an open challenge.
  const challengeSteps: Action['type'][] = [
    'resolveChallenge',
    'chooseChallenge',
    'acceptTrial',
    'pressButton',
    'debug',
  ];
  if (state.challenge && !challengeSteps.includes(action.type)) {
    return 'Finish the challenge first.';
  }
  switch (action.type) {
    case 'move':
      return validateMove(state, action) ?? null;
    case 'moveAll':
      return validateMoveAll(state, action) ?? null;
    case 'sleep':
      return validateSleep(state, action) ?? null;
    case 'keepWatch':
      return validateWatch(state, action) ?? null;
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
    case 'scavengeReroll':
      return validateReroll(state, action) ?? null;
    case 'tend':
      return validateTend(state, action) ?? null;
    case 'give':
      return validateGive(state, action) ?? null;
    case 'returnToNature':
      return validateReturn(state, action) ?? null;
    case 'dropItem':
      return validateDrop(state, action) ?? null;
    case 'useItem':
      return validateUse(state, action) ?? null;
    case 'pickUp':
      return validatePickUp(state, action) ?? null;
    case 'abandon':
      return validateAbandon(state, action) ?? null;
    case 'putOn':
      return validatePutOn(state, action) ?? null;
    case 'takeOff':
      return validateTakeOff(state, action) ?? null;
    case 'putDown':
      return validatePutDown(state, action) ?? null;
    case 'resolveChallenge':
      return validateResolve(state, action) ?? null;
    case 'chooseChallenge':
      return validateChoose(state, action) ?? null;
    case 'acceptTrial':
      return validateAccept(state) ?? null;
    case 'pressButton':
      return validatePress(state, action) ?? null;
    case 'accomplishWonder':
      return validateAccomplish(state, action) ?? null;
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
    case 'keepWatch':
      applyWatch(draft, action);
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
    case 'scavengeReroll':
      applyReroll(draft, action);
      break;
    case 'tend':
      applyTend(draft, action);
      break;
    case 'give':
      applyGive(draft, action);
      break;
    case 'returnToNature':
      applyReturn(draft, action);
      break;
    case 'dropItem':
      applyDrop(draft, action);
      break;
    case 'useItem':
      applyUse(draft, action);
      break;
    case 'pickUp':
      applyPickUp(draft, action);
      break;
    case 'abandon':
      applyAbandon(draft, action);
      break;
    case 'putOn':
      applyPutOn(draft, action);
      break;
    case 'takeOff':
      applyTakeOff(draft, action);
      break;
    case 'putDown':
      applyPutDown(draft, action);
      break;
    case 'resolveChallenge':
      applyResolve(draft, action);
      break;
    case 'chooseChallenge':
      applyChoose(draft, action);
      break;
    case 'acceptTrial':
      applyAccept(draft);
      break;
    case 'pressButton':
      applyPress(draft, action);
      break;
    case 'accomplishWonder':
      applyAccomplish(draft, action);
      break;
    case 'endPhase':
      endPhase(draft);
      break;
    case 'debug':
      applyDebug(draft, action.op);
      break;
  }
  // The last active hiker passed out or abandoned: the hike is over.
  if (!isHikeOver(state) && isHikeOver(draft))
    pushEvent(draft, { kind: 'hikeOver', day: draft.day });
  return draft;
}

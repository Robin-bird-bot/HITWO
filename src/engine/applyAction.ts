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
import { applyEat, validateEat } from './actions/eat';
import {
  applyPackUpShelter,
  applySetUpShelter,
  validatePackUpShelter,
  validateSetUpShelter,
} from './actions/shelter';
import {
  applyCraft,
  applyCraftTake,
  applyTeach,
  validateCraft,
  validateCraftTake,
  validateTeach,
} from './actions/craft';
import { applyAbandon, validateAbandon } from './actions/abandon';
import { applyFound, validateFound } from './actions/found';
import {
  applyOpen,
  applyPresentTake,
  applyWrap,
  validateOpen,
  validatePresentTake,
  validateWrap,
} from './actions/presents';
import { applyTactical, validateTactical } from './actions/tactical';
import { scoutAround } from './traits/reveal';
import { applyPick, pickReason } from './traits/levelUp';
import { noteXpRows } from './xp';
import { applySubmitToInjury, validateSubmitToInjury } from './actions/injure';
import { applyPutOn, applyTakeOff, validatePutOn, validateTakeOff } from './actions/dress';
import { applyPickUp, applyPutDown, validatePickUp, validatePutDown } from './actions/carry';
import { applyUseAbility, validateUseAbility } from './actions/useAbility';
import { applyLearn, applyToggle, validateLearn, validateToggle } from './actions/trails';
import { syncExtraUses } from './items/properWay';
import { endPhase } from './dayLoop';
import { isHikeOver } from './health';
import { applyMerchantBuy, applyTrade, validateMerchantBuy, validateTrade } from './station/trail';
import {
  applyBuy,
  applyRestAndGo,
  applySell,
  validateBuy,
  validateRestAndGo,
  validateSell,
} from './actions/station';
import { finishSection, readyToLeave } from './station/checkIn';
import { pushEvent } from './log';
import { applyAccomplish, validateAccomplish } from './wonders/wonders';
import type { Action, GameState } from './types';
import { applyResolveMinigame, validateResolveMinigame } from './challenges/minigame';

/** What can happen while a scavenge is open (plus the debug tools). */
const SCAVENGE_STEPS = new Set<Action['type']>([
  'scavengeFlip',
  'scavengeCancel',
  'scavengeTake',
  'scavengeReroll',
  'debug',
]);

/** What can happen at a ranger station (plus the debug tools). */
const STATION_STEPS = new Set<Action['type']>([
  'buy',
  'sell',
  'give',
  'craft',
  'craftTake',
  'wrapPresent',
  'teach',
  'restAndGo',
  'learnStep',
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
  // The illustrated map finding a place is only a look: nothing waits on it, and it waits on nothing.
  if (action.type === 'foundPlace') return validateFound(state, action) ?? null;
  // Nobody can act any more (the debug panel still works).
  if (action.type !== 'debug' && isHikeOver(state)) return 'The hike is over.';
  // An open scavenge waits for a card before anything else happens.
  if (state.scavenge && !SCAVENGE_STEPS.has(action.type)) return 'Finish scavenging first.';
  // At a ranger station: shopping, the Workbench, and Rest & Go to leave.
  if (state.station && !STATION_STEPS.has(action.type)) {
    return 'The party is at the ranger station: Rest & Go to move on.';
  }
  // A level-up (or an Old Photo) waits for its pick, even with a challenge open.
  if (state.traitPick && action.type !== 'pickTrait' && action.type !== 'debug') {
    return state.traitPick.source === 'levelUp'
      ? 'Pick from the level-up first.'
      : 'Pick a trait for the Old Photo first.';
  }
  // So does an open challenge.
  const challengeSteps: Action['type'][] = [
    'pickTrait',
    'resolveChallenge',
    'resolveMinigameChallenge',
    'chooseChallenge',
    'acceptTrial',
    'pressButton',
    'debug',
  ];
  if (state.challenge && !challengeSteps.includes(action.type)) {
    return 'Finish the challenge first.';
  }
  // A basic craft waits for its pick.
  if (state.crafting && action.type !== 'craftTake' && action.type !== 'debug') {
    return 'Finish crafting first: pick one of the cards.';
  }
  // So does a Choosy hiker's Present.
  if (state.presentPick && action.type !== 'presentTake' && action.type !== 'debug') {
    return 'Pick an item from the Present first.';
  }
  switch (action.type) {
    case 'learnStep':
      return validateLearn(state, action) ?? null;
    case 'toggleTrait':
      return validateToggle(state, action) ?? null;
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
    case 'eat':
      return validateEat(state, action) ?? null;
    case 'setUpShelter':
      return validateSetUpShelter(state, action) ?? null;
    case 'packUpShelter':
      return validatePackUpShelter(state, action) ?? null;
    case 'craft':
      return validateCraft(state, action) ?? null;
    case 'craftTake':
      return validateCraftTake(state, action) ?? null;
    case 'teach':
      return validateTeach(state, action) ?? null;
    case 'wrapPresent':
      return validateWrap(state, action) ?? null;
    case 'openPresent':
      return validateOpen(state, action) ?? null;
    case 'presentTake':
      return validatePresentTake(state, action) ?? null;
    case 'buy':
      return validateBuy(state, action) ?? null;
    case 'sell':
      return validateSell(state, action) ?? null;
    case 'restAndGo':
      return validateRestAndGo(state) ?? null;
    case 'merchantBuy':
      return validateMerchantBuy(state, action) ?? null;
    case 'trade':
      return validateTrade(state, action) ?? null;
    case 'pickUp':
      return validatePickUp(state, action) ?? null;
    case 'abandon':
      return validateAbandon(state, action) ?? null;
    case 'submitToInjury':
      return validateSubmitToInjury(state, action) ?? null;
    case 'putOn':
      return validatePutOn(state, action) ?? null;
    case 'takeOff':
      return validateTakeOff(state, action) ?? null;
    case 'putDown':
      return validatePutDown(state, action) ?? null;
    case 'resolveChallenge':
      return validateResolve(state, action) ?? null;
    case 'resolveMinigameChallenge':
      return validateResolveMinigame(state, action) ?? null;
    case 'chooseChallenge':
      return validateChoose(state, action) ?? null;
    case 'acceptTrial':
      return validateAccept(state) ?? null;
    case 'pressButton':
      return validatePress(state, action) ?? null;
    case 'accomplishWonder':
      return validateAccomplish(state, action) ?? null;
    case 'tactical':
      return validateTactical(state, action) ?? null;
    case 'pickTrait':
      return pickReason(state, action) ?? null;
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
    case 'eat':
      applyEat(draft, action);
      break;
    case 'setUpShelter':
      applySetUpShelter(draft, action);
      break;
    case 'packUpShelter':
      applyPackUpShelter(draft, action);
      break;
    case 'craft':
      applyCraft(draft, action);
      break;
    case 'craftTake':
      applyCraftTake(draft, action);
      break;
    case 'teach':
      applyTeach(draft, action);
      break;
    case 'wrapPresent':
      applyWrap(draft, action);
      break;
    case 'openPresent':
      applyOpen(draft, action);
      break;
    case 'presentTake':
      applyPresentTake(draft, action);
      break;
    case 'foundPlace':
      applyFound(draft, action);
      break;
    case 'buy':
      applyBuy(draft, action);
      break;
    case 'sell':
      applySell(draft, action);
      break;
    case 'restAndGo':
      applyRestAndGo(draft);
      break;
    case 'merchantBuy':
      applyMerchantBuy(draft, action);
      break;
    case 'trade':
      applyTrade(draft, action);
      break;
    case 'pickUp':
      applyPickUp(draft, action);
      break;
    case 'abandon':
      applyAbandon(draft, action);
      break;
    case 'submitToInjury':
      applySubmitToInjury(draft, action);
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
    case 'resolveMinigameChallenge':
      applyResolveMinigame(draft, action);
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
    case 'tactical':
      applyTactical(draft, action);
      break;
    case 'pickTrait':
      applyPick(draft, action);
      break;
    case 'learnStep':
      applyLearn(draft, action);
      break;
    case 'toggleTrait':
      applyToggle(draft, action);
      break;
    case 'endPhase':
      endPhase(draft);
      break;
    case 'debug':
      applyDebug(draft, action.op);
      break;
  }
  // Scouts see the nodes around wherever they are now.
  scoutAround(draft);
  // The XP row rule: a hiker who moved forward starts their new row now.
  noteXpRows(draft);
  // The Proper Way: tools in that hiker's pack carry an extra use (Phase 10.7).
  syncExtraUses(draft);
  // Nobody left on the trail and someone checked in: the station opens (or the summit).
  if (readyToLeave(draft)) finishSection(draft);
  // The last active hiker passed out or abandoned, or the summit: the hike is over.
  if (!isHikeOver(state) && isHikeOver(draft))
    pushEvent(draft, { kind: 'hikeOver', day: draft.day });
  return draft;
}

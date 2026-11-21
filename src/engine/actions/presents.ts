/**
 * Presents (Nov 20 update, holiday hikers; src/engine/items/presents.ts):
 *
 * - **Wrap** (Gift Wrapper; uses the action, like crafting, and is free at a
 *   station's Workbench): pay one of the four recipes and a Present of its
 *   grade goes in the wrapper's bag. Both wish lists are rolled again.
 * - **Open** (the opener's action and 1 Energy): the Present leaves the bag
 *   and a random item takes its place. A Choosy hiker sees several and keeps
 *   one (`presentTake`); everything else waits for that pick.
 */
import { BALANCE } from '../../config/balance';
import { PRESENT_ID } from '../../content/items/presents';
import { countCrafted } from '../counters';
import {
  fireAction,
  fireCraft,
  firePresentOpened,
  presentChoices,
  wrapsPresents,
} from '../effects';
import { bagSlots } from '../inventory';
import { atWorkbench, paymentReason, spend } from '../items/craft';
import { earnFreeMove } from '../items/freeMoves';
import {
  isPresent,
  makePresent,
  presentRecipe,
  RECIPE_GRADE,
  rollPresentItem,
  wrapSlots,
} from '../items/presents';
import { rollWishLists } from '../items/wishLists';
import { pushEvent } from '../log';
import { changeStat } from '../stats';
import { PRESENT_RECIPES, type Action, type GameState, type PaidSlot } from '../types';
import { gainXp } from '../xp';
import {
  findHiker,
  mustFindHiker,
  notActiveReason,
  phaseActionReason,
  spendAction,
} from './common';

type WrapAction = Extract<Action, { type: 'wrapPresent' }>;
type OpenAction = Extract<Action, { type: 'openPresent' }>;
type TakeAction = Extract<Action, { type: 'presentTake' }>;

const P = BALANCE.presents;

// ── Wrapping ───────────────────────────────────────────────────────────────

export function validateWrap(state: GameState, action: WrapAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  // At a station's Workbench crafting is free, and so is wrapping.
  const reason =
    hiker && atWorkbench(state, hiker) ? undefined : phaseActionReason(state, hiker, action);
  if (reason || !hiker) return reason;
  if (!wrapsPresents(state, hiker)) return `${hiker.name} doesn’t wrap Presents.`;
  if (!PRESENT_RECIPES.includes(action.recipe)) return 'That isn’t a Present recipe.';
  if (hiker.inventory.bag.length >= bagSlots(state, hiker).total) {
    return `${hiker.name}’s bag is full. Make room for the Present first.`;
  }
  const pick = {
    ...(action.resource ? { resource: action.resource } : {}),
    ...(action.node ? { node: action.node } : {}),
  };
  const made = presentRecipe(state, hiker, action.recipe, pick);
  if (!made) {
    if (action.recipe === 'sameResource') return `Needs ${P.sameResource} of one resource here.`;
    if (action.recipe === 'sameType') return `Needs ${P.sameType} resources of one type here.`;
    return `${hiker.name} has no wish list yet.`;
  }
  return paymentReason(state, hiker, made.parts, wrapSlots(state, hiker, made.parts, action.slots));
}

export function applyWrap(state: GameState, action: WrapAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const made = presentRecipe(state, hiker, action.recipe, {
    ...(action.resource ? { resource: action.resource } : {}),
    ...(action.node ? { node: action.node } : {}),
  });
  if (!made) throw new Error('applyWrap: no recipe');
  const slots = wrapSlots(state, hiker, made.parts, action.slots).filter((s): s is PaidSlot => !!s);
  if (!atWorkbench(state, hiker)) spendAction(state, hiker);
  spend(state, slots);

  const grade = RECIPE_GRADE[action.recipe];
  const present = makePresent(state, grade, { wrappedBy: hiker.id });
  hiker.inventory.bag.push(present);
  hiker.lastWrapDay = state.day;
  // Both wish lists change after every Present, whichever recipe made it.
  hiker.wishLists = rollWishLists(state.rng);
  pushEvent(state, {
    kind: 'wrapped',
    hikerId: hiker.id,
    grade,
    recipe: action.recipe,
    paid: slots,
  });
  countCrafted(state, hiker.id, 'present');
  // Crafting XP, as for an item of this tier. TODO(wyatt): first guess.
  const xp = BALANCE.xp.craft[P.xpTier - 1] ?? 0;
  gainXp(state, hiker, xp, 'craft', 'Wrapped a Present');
  fireCraft(state, hiker, PRESENT_ID, 'present', {
    item: present,
    paid: slots.map((s) => s.resource),
  });
  fireAction(state, hiker, {
    kind: 'craft',
    role: 'actor',
    tileId: hiker.tileId,
    itemType: 'present',
  });
  // Work Boots: a free move after crafting.
  earnFreeMove(state, hiker, 'afterCraft');
}

// ── Opening ────────────────────────────────────────────────────────────────

export function validateOpen(state: GameState, action: OpenAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = phaseActionReason(state, hiker, action);
  if (reason || !hiker) return reason;
  const item = hiker.inventory.bag.find((i) => i.uid === action.itemUid);
  if (!item) return `${hiker.name} doesn’t have that.`;
  if (!isPresent(item)) return 'That isn’t a Present.';
  if (hiker.stats.energy < P.openEnergy) {
    return `${hiker.name} needs ${P.openEnergy} Energy to open it.`;
  }
  return undefined;
}

export function applyOpen(state: GameState, action: OpenAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const i = hiker.inventory.bag.findIndex((it) => it.uid === action.itemUid);
  const [present] = hiker.inventory.bag.splice(i, 1);
  if (!present) return;
  spendAction(state, hiker);
  changeStat(state, hiker, 'energy', -P.openEnergy, 'Opened a Present');
  state.lastPresentDay = state.day;

  const grade = present.grade ?? 'plain';
  const wrappedBy = present.wrappedBy;
  const look = present.colorway ? { colorway: present.colorway } : {};
  const n = presentChoices(state, hiker);
  const options = Array.from({ length: n }, () => rollPresentItem(state, hiker, grade));
  if (n > 1) {
    // Choosy: the items wait for the pick; the Present is already open.
    state.presentPick = {
      hikerId: hiker.id,
      options,
      grade,
      ...(wrappedBy ? { wrappedBy } : {}),
    };
    pushEvent(state, {
      kind: 'presentOpened',
      hikerId: hiker.id,
      grade,
      ...(wrappedBy ? { wrappedBy } : {}),
      ...look,
    });
  } else {
    const [got] = options;
    if (got) hiker.inventory.bag.push(got);
    pushEvent(state, {
      kind: 'presentOpened',
      hikerId: hiker.id,
      grade,
      ...(got ? { itemId: got.itemId } : {}),
      ...(wrappedBy ? { wrappedBy } : {}),
      ...look,
    });
  }
  firePresentOpened(state, {
    openerId: hiker.id,
    tileId: hiker.tileId,
    ...(wrappedBy ? { wrappedBy } : {}),
  });
}

export function validatePresentTake(state: GameState, action: TakeAction): string | undefined {
  const open = state.presentPick;
  if (!open) return 'No Present is waiting for a pick.';
  if (!open.options[action.index]) return 'That item isn’t on the table.';
  const hiker = findHiker(state, open.hikerId);
  return hiker ? undefined : notActiveReason(hiker);
}

export function applyPresentTake(state: GameState, action: TakeAction): void {
  const open = state.presentPick;
  const got = open?.options[action.index];
  if (!open || !got) throw new Error('applyPresentTake: no item');
  const hiker = mustFindHiker(state, open.hikerId);
  delete state.presentPick;
  // The Present's own slot was freed when it was opened, so it fits.
  hiker.inventory.bag.push(got);
  pushEvent(state, {
    kind: 'gained',
    hikerId: hiker.id,
    resources: [],
    items: [got.itemId],
    cause: 'Choosy',
  });
}

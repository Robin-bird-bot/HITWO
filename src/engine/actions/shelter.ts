/**
 * Portable shelters (Phase 10.6): set one up from the pack on your own tile,
 * or pack up the one on your tile. Both are free actions. See
 * src/engine/items/shelters.ts for what a shelter does while it's up.
 */
import { ITEMS } from '../../content/items';
import { bagSlots } from '../inventory';
import { deploymentsOf, packUpShelter, setUpShelterOn, shelterOn } from '../items/shelters';
import { removeItem } from '../items/wear';
import type { Action, GameState } from '../types';
import { findHiker, mustFindHiker, notActiveReason } from './common';

type SetUpAction = Extract<Action, { type: 'setUpShelter' }>;
type PackUpAction = Extract<Action, { type: 'packUpShelter' }>;

export function validateSetUpShelter(state: GameState, action: SetUpAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  const item = hiker.inventory.bag.find((i) => i.uid === action.itemUid);
  if (!item) return `${hiker.name} doesn’t have that.`;
  const def = ITEMS[item.itemId];
  if (def?.type !== 'shelter') return `${def?.name ?? 'That'} isn’t a shelter.`;
  if (!state.section.tiles[hiker.tileId]) return 'There’s nowhere to set it up.';
  const up = shelterOn(state, hiker.tileId);
  if (up) return `A ${ITEMS[up.itemId]?.name ?? 'shelter'} is already up here.`;
  if (deploymentsOf(item) <= 0) return `The ${def.name} is worn out.`;
  return undefined;
}

export function applySetUpShelter(state: GameState, action: SetUpAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const item = removeItem(hiker, action.itemUid);
  if (item) {
    setUpShelterOn(state, hiker.tileId, item.itemId, deploymentsOf(item), hiker.id, item.uid);
  }
}

export function validatePackUpShelter(state: GameState, action: PackUpAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  const up = shelterOn(state, hiker.tileId);
  if (!up) return 'There’s no shelter up here.';
  const room = hiker.inventory.bag.length < bagSlots(state, hiker).total;
  // A worn-out one is thrown away, so it needs no room.
  if (up.deploymentsLeft > 0 && !room) return `${hiker.name}’s pack is full.`;
  return undefined;
}

export function applyPackUpShelter(state: GameState, action: PackUpAction): void {
  packUpShelter(state, mustFindHiker(state, action.hikerId));
}

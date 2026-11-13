/**
 * Placing a shelter (a free action): an active hiker puts a shelter from
 * their bag on their own tile. See src/engine/items/shelters.ts for what it
 * does there. TODO(wyatt): placing is a free action, on any tile.
 */
import { ITEMS } from '../../content/items';
import { placeShelterOn } from '../items/shelters';
import { removeItem } from '../items/wear';
import type { Action, GameState } from '../types';
import { findHiker, mustFindHiker, notActiveReason } from './common';

type PlaceAction = Extract<Action, { type: 'placeShelter' }>;

export function validatePlaceShelter(state: GameState, action: PlaceAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  const item = hiker.inventory.bag.find((i) => i.uid === action.itemUid);
  if (!item) return `${hiker.name} doesn’t have that.`;
  const def = ITEMS[item.itemId];
  if (def?.type !== 'shelter') return `${def?.name ?? 'That'} isn’t a shelter.`;
  if (!state.section.tiles[hiker.tileId]) return 'There’s nowhere to put it.';
  return undefined;
}

export function applyPlaceShelter(state: GameState, action: PlaceAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const item = removeItem(hiker, action.itemUid);
  if (item) placeShelterOn(state, hiker.tileId, item.itemId, hiker.id);
}

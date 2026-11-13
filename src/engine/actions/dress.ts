/**
 * Clothes (docs/design/03-items.md, "Clothes"): Gear, Body and Feet (shoes or
 * socks: Feet is one slot). Putting clothes on and taking them off are free
 * actions. TODO(wyatt): free, and equipped clothes take no bag slot, so
 * taking them off needs room in the bag.
 *
 * - Putting on clothes for a full slot swaps them: the old ones go to the bag.
 * - A passed-out hiker's clothes can be taken off by an active hiker on their
 *   tile, into that hiker's bag (Phase 7's "worn clothes" leftover).
 */
import { ITEMS } from '../../content/items';
import { bagSlots } from '../inventory';
import { pushEvent } from '../log';
import type { Action, EquipSlot, GameState, Hiker, Inventory } from '../types';
import { findHiker, mustFindHiker, notActiveReason } from './common';

type PutOnAction = Extract<Action, { type: 'putOn' }>;
type TakeOffAction = Extract<Action, { type: 'takeOff' }>;

/** The bag room a hiker would have with these clothes on (a Backpack adds slots). */
function roomWith(state: GameState, hiker: Hiker, equipped: Inventory['equipped']): number {
  return bagSlots(state, { ...hiker, inventory: { ...hiker.inventory, equipped } }).total;
}

export function validatePutOn(state: GameState, action: PutOnAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  const item = hiker.inventory.bag.find((i) => i.uid === action.itemUid);
  if (!item) return `${hiker.name} doesn’t have that.`;
  const def = ITEMS[item.itemId];
  if (def?.type !== 'clothes' || !def.slot)
    return `${def?.name ?? 'That'} isn’t something to wear.`;
  const old = hiker.inventory.equipped[def.slot];
  if (old) {
    // The old clothes go into the bag in the new ones' place.
    const room = roomWith(state, hiker, { ...hiker.inventory.equipped, [def.slot]: item });
    if (hiker.inventory.bag.length > room) {
      return `There’s no room in ${hiker.name}’s bag for the ${ITEMS[old.itemId]?.name ?? 'old clothes'}.`;
    }
  }
  return undefined;
}

export function applyPutOn(state: GameState, action: PutOnAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const i = hiker.inventory.bag.findIndex((it) => it.uid === action.itemUid);
  const [item] = hiker.inventory.bag.splice(i, 1);
  const slot = item && ITEMS[item.itemId]?.slot;
  if (!item || !slot) return;
  const old = hiker.inventory.equipped[slot];
  hiker.inventory.equipped[slot] = item;
  if (old) {
    hiker.inventory.bag.push(old);
    pushEvent(state, { kind: 'dressed', hikerId: hiker.id, itemId: old.itemId, on: false });
  }
  pushEvent(state, { kind: 'dressed', hikerId: hiker.id, itemId: item.itemId, on: true });
}

/** Who takes the clothes into their bag: the wearer, or an active hiker beside a passed-out one. */
function taker(state: GameState, wearer: Hiker, toId: string | undefined): Hiker | undefined {
  if (wearer.status === 'active') return wearer;
  return toId ? findHiker(state, toId) : undefined;
}

export function validateTakeOff(state: GameState, action: TakeOffAction): string | undefined {
  const wearer = findHiker(state, action.hikerId);
  if (!wearer || (wearer.status !== 'active' && wearer.status !== 'passedOut')) {
    return notActiveReason(wearer);
  }
  const item = wearer.inventory.equipped[action.slot];
  if (!item) return `${wearer.name} isn’t wearing anything there.`;
  const to = taker(state, wearer, action.toId);
  if (!to) return 'Pick who takes them.';
  const reason = notActiveReason(to);
  if (reason) return reason;
  if (to.tileId !== wearer.tileId) return `${to.name} isn’t on this tile.`;
  const equipped = { ...wearer.inventory.equipped };
  delete equipped[action.slot];
  const room = to === wearer ? roomWith(state, wearer, equipped) : bagSlots(state, to).total;
  if (to.inventory.bag.length + 1 > room) return `${to.name}’s bag is full.`;
  return undefined;
}

export function applyTakeOff(state: GameState, action: TakeOffAction): void {
  const wearer = mustFindHiker(state, action.hikerId);
  const item = wearer.inventory.equipped[action.slot as EquipSlot];
  const to = taker(state, wearer, action.toId);
  if (!item || !to) return;
  delete wearer.inventory.equipped[action.slot];
  to.inventory.bag.push(item);
  pushEvent(state, {
    kind: 'dressed',
    hikerId: wearer.id,
    itemId: item.itemId,
    on: false,
    ...(to !== wearer ? { by: to.id } : {}),
  });
}

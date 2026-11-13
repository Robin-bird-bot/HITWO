/**
 * Free actions with resources and items (they don't use the phase):
 * - give one resource or bag item to a hiker on the same tile (an active
 *   hiker can also take things from a passed-out one: Wyatt, Nov 7; their worn
 *   clothes come off with takeOff, src/engine/actions/dress.ts);
 * - return a resource to nature, +1 Abundance to its node.
 */
import { BALANCE } from '../../config/balance';
import { RESOURCES } from '../../content/resources';
import { changeAbundance } from '../abundance';
import { tradesAnywhere } from '../effects';
import { bagSlots, resourceCount, resourceLimit } from '../inventory';
import { pushEvent } from '../log';
import type { Action, GameState } from '../types';
import { findHiker, mustFindHiker, notActiveReason } from './common';

type GiveAction = Extract<Action, { type: 'give' }>;
type ReturnAction = Extract<Action, { type: 'returnToNature' }>;

export function validateGive(state: GameState, action: GiveAction): string | undefined {
  const from = findHiker(state, action.fromId);
  const to = findHiker(state, action.toId);
  // A passed-out hiker's things can be taken by an active hiker beside them.
  const takeFromOut = from?.status === 'passedOut';
  const reason = (takeFromOut ? undefined : notActiveReason(from)) ?? notActiveReason(to);
  if (reason || !from || !to) return reason;
  if (from.id === to.id) return 'Pick someone else to give it to.';
  // A Walkie-Talkie lets either one trade with anyone, anywhere.
  const anywhere = !takeFromOut && (tradesAnywhere(state, from) || tradesAnywhere(state, to));
  if (from.tileId !== to.tileId && !anywhere) return `${to.name} isn’t on this tile.`;
  if ((action.resource ? 1 : 0) + (action.itemUid ? 1 : 0) !== 1) return 'Pick one thing to give.';

  if (action.resource) {
    if ((from.inventory.resources[action.resource] ?? 0) < 1)
      return `${from.name} doesn’t have that.`;
    if (resourceCount(to) >= resourceLimit(state, to)) return `${to.name}’s resources are full.`;
  }
  if (action.itemUid) {
    if (!from.inventory.bag.some((i) => i.uid === action.itemUid))
      return `${from.name} doesn’t have that.`;
    if (to.inventory.bag.length >= bagSlots(state, to).total) return `${to.name}’s bag is full.`;
  }
  return undefined;
}

export function applyGive(state: GameState, action: GiveAction): void {
  const from = mustFindHiker(state, action.fromId);
  const to = mustFindHiker(state, action.toId);
  const taken = from.status === 'passedOut' ? { taken: true as const } : {};
  if (action.resource) {
    const r = action.resource;
    from.inventory.resources[r] = (from.inventory.resources[r] ?? 0) - 1;
    if (!from.inventory.resources[r]) delete from.inventory.resources[r];
    to.inventory.resources[r] = (to.inventory.resources[r] ?? 0) + 1;
    pushEvent(state, { kind: 'give', fromId: from.id, toId: to.id, resource: r, ...taken });
    return;
  }
  const i = from.inventory.bag.findIndex((it) => it.uid === action.itemUid);
  const [item] = from.inventory.bag.splice(i, 1);
  if (!item) return;
  to.inventory.bag.push(item);
  pushEvent(state, { kind: 'give', fromId: from.id, toId: to.id, itemId: item.itemId, ...taken });
}

export function validateReturn(state: GameState, action: ReturnAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  if ((hiker.inventory.resources[action.resource] ?? 0) < 1)
    return `${hiker.name} doesn’t have that.`;
  if (!RESOURCES.some((r) => r.id === action.resource)) return 'That isn’t a resource.';
  return undefined;
}

export function applyReturn(state: GameState, action: ReturnAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const r = action.resource;
  const node = RESOURCES.find((x) => x.id === r)?.node;
  if (!node) return;
  hiker.inventory.resources[r] = (hiker.inventory.resources[r] ?? 0) - 1;
  if (!hiker.inventory.resources[r]) delete hiker.inventory.resources[r];
  changeAbundance(state, node, BALANCE.abundance.returnToNature);
  pushEvent(state, { kind: 'returned', hikerId: hiker.id, resource: r, node });
}

type DropAction = Extract<Action, { type: 'dropItem' }>;

/** Dropping a bag item for good (Weak can leave a hiker with one more than fits). */
export function validateDrop(state: GameState, action: DropAction): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  if (!hiker.inventory.bag.some((i) => i.uid === action.itemUid)) {
    return `${hiker.name} doesn’t have that.`;
  }
  return undefined;
}

export function applyDrop(state: GameState, action: DropAction): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const i = hiker.inventory.bag.findIndex((it) => it.uid === action.itemUid);
  const [item] = hiker.inventory.bag.splice(i, 1);
  if (!item) return;
  pushEvent(state, {
    kind: 'lost',
    hikerId: hiker.id,
    resources: [],
    items: [item.itemId],
    cause: 'dropped',
  });
}

/** How many bag items don't fit any more (Weak). */
export function overBag(state: GameState, hiker: GameState['hikers'][number]): number {
  return Math.max(0, hiker.inventory.bag.length - bagSlots(state, hiker).total);
}

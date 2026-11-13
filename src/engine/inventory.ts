/**
 * Inventory limits. Bag slots come from the base number, family and trait
 * modifiers (a Cat has one fewer), and items (a Backpack adds 2). Slots an
 * item adds are reported separately, so the UI can mark where the extra room
 * came from and what is lost if the item comes off.
 */
import { BALANCE } from '../config/balance';
import { effectSourcesFor, queryContext, type Modifier } from './effects';
import type { GameState, Hiker } from './types';

export interface ItemSlots {
  /** The equipped item that adds these slots. */
  itemUid: string;
  itemId: string;
  name: string;
  count: number;
}

export interface BagSlots {
  /** Slots from the base number and family or trait modifiers. */
  base: number;
  fromItems: ItemSlots[];
  total: number;
}

const asList = (m: Modifier | Modifier[] | undefined) => (!m ? [] : Array.isArray(m) ? m : [m]);

export function bagSlots(state: GameState, hiker: Hiker): BagSlots {
  const ctx = queryContext(state, hiker);
  let base = BALANCE.inventory.bagSlots;
  const fromItems: ItemSlots[] = [];

  for (const source of effectSourcesFor(state, hiker)) {
    const flat = asList(source.hooks.modifyCapacity?.({ key: 'bag.slots' }, ctx)).reduce(
      (sum, m) => sum + (m.flat ?? 0),
      0,
    );
    if (!flat) continue;
    if (source.kind === 'item' && flat > 0) {
      const uid = source.id.slice('item:'.length);
      const item = Object.values(hiker.inventory.equipped).find((i) => i?.uid === uid);
      fromItems.push({ itemUid: uid, itemId: item?.itemId ?? '', name: source.name, count: flat });
    } else {
      base += flat;
    }
  }

  base = Math.max(0, base);
  return { base, fromItems, total: base + fromItems.reduce((sum, i) => sum + i.count, 0) };
}

/** How many resources a hiker can hold: the limit, plus what items add (a Fanny Pack). */
export function resourceLimit(state: GameState, hiker: Hiker): number {
  const ctx = queryContext(state, hiker);
  let limit = BALANCE.inventory.resourceLimit;
  for (const source of effectSourcesFor(state, hiker)) {
    for (const m of asList(source.hooks.modifyCapacity?.({ key: 'resources' }, ctx))) {
      limit += m.flat ?? 0;
    }
  }
  return Math.max(0, limit);
}

/** How many resources a hiker holds, out of resourceLimit(). */
export function resourceCount(hiker: Hiker): number {
  return Object.values(hiker.inventory.resources).reduce((sum: number, n) => sum + (n ?? 0), 0);
}

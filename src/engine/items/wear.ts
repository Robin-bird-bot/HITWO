/**
 * Items wearing out (docs/design/03-items.md):
 * - clothes lose durability at each camp step, and when weather, challenges
 *   or their own effects cost some; at 0 they're gone;
 * - tools lose uses when used (or to a challenge); at 0 they're gone.
 *
 * Every loss goes through here, so clothes that change it (Umbrella, Heavy
 * Jacket, Birkenstocks: Phase 8 step 4) have one place to plug in.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { pushEvent } from '../log';
import { fullCounters, fullDurability, qualityOf } from './make';
import type { EquipSlot, GameState, Hiker, ItemInstance } from '../types';

/** Takes an item off a hiker, wherever it is (bag or an equip slot). */
export function removeItem(hiker: Hiker, uid: string): ItemInstance | undefined {
  const i = hiker.inventory.bag.findIndex((it) => it.uid === uid);
  if (i >= 0) return hiker.inventory.bag.splice(i, 1)[0];
  for (const slot of Object.keys(hiker.inventory.equipped) as EquipSlot[]) {
    const item = hiker.inventory.equipped[slot];
    if (item?.uid === uid) {
      delete hiker.inventory.equipped[slot];
      return item;
    }
  }
  return undefined;
}

/** Clothes lose durability; at 0 they're gone. Returns how much was really lost. */
export function loseDurability(
  state: GameState,
  hiker: Hiker,
  item: ItemInstance,
  n: number,
  cause: string,
): number {
  const def = ITEMS[item.itemId];
  if (n <= 0 || def?.type !== 'clothes') return 0;
  // An item with no count yet (an old save, a test) starts full.
  const before = item.durability ?? fullDurability(def, qualityOf(item));
  item.durability = Math.max(0, before - n);
  if (item.durability === 0) {
    removeItem(hiker, item.uid);
    pushEvent(state, {
      kind: 'itemGone',
      hikerId: hiker.id,
      itemId: item.itemId,
      why: 'worn',
      cause,
    });
  }
  return before - item.durability;
}

/** A tool loses uses; at 0 it's gone. */
export function loseUses(
  state: GameState,
  hiker: Hiker,
  item: ItemInstance,
  n: number,
  cause: string,
): void {
  const def = ITEMS[item.itemId];
  if (n <= 0 || def?.type !== 'tool') return;
  const before = item.usesLeft ?? fullCounters(def, qualityOf(item)).usesLeft ?? 1;
  item.usesLeft = Math.max(0, before - n);
  if (item.usesLeft === 0) {
    removeItem(hiker, item.uid);
    pushEvent(state, {
      kind: 'itemGone',
      hikerId: hiker.id,
      itemId: item.itemId,
      why: 'used',
      cause,
    });
  }
}

/** The clothes a hiker has on. */
export function wornClothes(hiker: Hiker): ItemInstance[] {
  return Object.values(hiker.inventory.equipped).filter(
    (i): i is ItemInstance => !!i && ITEMS[i.itemId]?.type === 'clothes',
  );
}

/** The camp step: every hiker's worn clothes lose a day of durability. */
export function wearAtCamp(state: GameState): void {
  for (const h of state.hikers) {
    if (h.status !== 'active' && h.status !== 'passedOut') continue;
    for (const item of wornClothes(h))
      loseDurability(state, h, item, BALANCE.items.campWear, 'a day’s wear');
  }
}

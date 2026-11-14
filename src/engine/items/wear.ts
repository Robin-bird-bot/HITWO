/**
 * Items wearing out (docs/design/03-items.md):
 * - clothes lose durability at each camp step, and when weather, challenges
 *   or their own effects cost some; at 0 they're gone;
 * - tools lose uses when used (or to a challenge); at 0 they're gone.
 *
 * Every loss goes through here, so clothes that change it have one place to
 * plug in: an Umbrella takes the other clothes' losses, and a Heavy Jacket or
 * Birkenstocks (on their node) have a chance not to lose any.
 */
import { noteGone } from './gone';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { pushEvent } from '../log';
import { roll } from '../rng';
import { fullCounters, fullDurability, qualityOf } from './make';
import { valueAt } from './quality';
import type { EquipSlot, GameState, Hiker, ItemInstance, NodeType } from '../types';

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
  /** Spent on purpose (a challenge's cost): it comes off this item, with no Umbrella or saves. */
  { spent = false }: { spent?: boolean } = {},
): number {
  if (n <= 0 || ITEMS[item.itemId]?.type !== 'clothes') return 0;
  // An Umbrella takes what the hiker's other clothes would lose.
  const umbrella = spent
    ? undefined
    : wornClothes(hiker).find((i) => i !== item && ITEMS[i.itemId]?.takesWear);
  if (umbrella) item = umbrella;
  const def = ITEMS[item.itemId];
  if (!def) return 0;
  // A chance not to lose any (Heavy Jacket; Birkenstocks on their node).
  const save = spent ? undefined : def.wearSave;
  if (save && (!save.onNode || (item.node && tileHasNode(state, hiker, item.node)))) {
    const pct = valueAt(def.values?.[save.value], qualityOf(item));
    if (roll(state.rng, pct / 100)) return 0;
  }
  // An item with no count yet (an old save, a test) starts full.
  const before = item.durability ?? item.maxDurability ?? fullDurability(def, qualityOf(item));
  item.durability = Math.max(0, before - n);
  if (item.durability === 0) {
    removeItem(hiker, item.uid);
    noteGone(state, item.itemId);
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
    noteGone(state, item.itemId);
    pushEvent(state, {
      kind: 'itemGone',
      hikerId: hiker.id,
      itemId: item.itemId,
      why: 'used',
      cause,
    });
  }
}

function tileHasNode(state: GameState, hiker: Hiker, node: NodeType): boolean {
  return (state.section.tiles[hiker.tileId]?.nodes ?? []).some((n) => n.type === node);
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

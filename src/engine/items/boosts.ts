/**
 * Item boosts: an item's effect that lasts a while after it's used.
 *
 * - "This phase" (a Shovel, a Treasure Map) lasts until the phase ends.
 *   TODO(wyatt): "this phase" means the rest of the current one.
 * - Some last phases (a Star) or nights (Bear Spray).
 * - A Wheelbarrow works for every hiker on its tile; a Supply Map only on
 *   its tile, and only for the next scavenge there.
 *
 * While it lasts, a boost is an effect source like an equipped item: its
 * hooks come from the item's `boostHooks` at its Quality.
 */
import { ITEMS } from '../../content/items';
import type { EffectSource, ItemUse } from '../effects';
import type { GameState, Hiker, ItemBoost, ItemInstance, TileId } from '../types';
import { qualityOf } from './make';
import { valueAt } from './quality';

/** How long a boost lasts, read at the item's Quality. */
function lasting(use: NonNullable<ItemUse['boost']>, item: ItemInstance): number {
  const n = use.lasts.n;
  if (typeof n === 'number') return n;
  return valueAt(ITEMS[item.itemId]?.values?.[n], qualityOf(item));
}

/** Starts a used item's boost, on the hiker or (a Wheelbarrow) their tile. */
export function addBoost(
  state: GameState,
  hiker: Hiker,
  item: ItemInstance,
  choice: string | undefined,
): void {
  const use = ITEMS[item.itemId]?.use?.boost;
  if (!use) return;
  const quality = qualityOf(item);
  const boost: ItemBoost = {
    itemId: item.itemId,
    ...(quality ? { quality } : {}),
    remaining: Math.max(1, lasting(use, item)),
    unit: use.lasts.unit,
    ...(choice ? { choice } : {}),
    ...(use.once ? { once: true as const, tileId: hiker.tileId } : {}),
  };
  if (use.tile) {
    const tile = state.section.tiles[hiker.tileId];
    if (tile) tile.boosts = [...(tile.boosts ?? []), boost];
    return;
  }
  hiker.boosts = [...(hiker.boosts ?? []), boost];
}

/** The effect sources from a hiker's boosts, and their tile's. */
export function boostSources(state: GameState, hiker: Hiker): EffectSource[] {
  const tile = state.section.tiles[hiker.tileId];
  const all = [...(hiker.boosts ?? []), ...(tile?.boosts ?? [])];
  const out: EffectSource[] = [];
  for (const [i, b] of all.entries()) {
    if (b.tileId && b.tileId !== hiker.tileId) continue;
    const def = ITEMS[b.itemId];
    if (!def?.boostHooks) continue;
    const v = (key: string) => valueAt(def.values?.[key], b.quality);
    out.push({
      id: `boost:${b.itemId}:${i}`,
      kind: 'item',
      itemId: b.itemId,
      name: def.name,
      hooks: def.boostHooks(v, b.choice),
    });
  }
  return out;
}

/**
 * One list's countdown. A boost for the next scavenge on a tile (a Supply
 * Map) doesn’t count down: it waits for that scavenge, or for the trail to
 * move on to a new section. TODO(phase 9): drop them when a new section starts.
 */
const tick = (state: GameState, list: ItemBoost[] | undefined, unit: ItemBoost['unit']) => {
  if (!list) return undefined;
  for (const b of list) if (b.unit === unit && !b.once) b.remaining -= 1;
  const left = list.filter((b) =>
    b.once ? !!b.tileId && !!state.section.tiles[b.tileId] : b.remaining > 0,
  );
  return left.length ? left : undefined;
};

/** Boosts count down: phase ones at the end of each phase, night ones at camp. */
export function tickBoosts(state: GameState, unit: ItemBoost['unit']): void {
  for (const h of state.hikers) {
    const left = tick(state, h.boosts, unit);
    if (left) h.boosts = left;
    else delete h.boosts;
  }
  for (const t of Object.values(state.section.tiles)) {
    const left = tick(state, t.boosts, unit);
    if (left) t.boosts = left;
    else delete t.boosts;
  }
}

/** A scavenge on a tile uses up the boosts that only last for one (a Supply Map). */
export function spendOnceBoosts(hiker: Hiker, tileId: TileId): void {
  if (!hiker.boosts) return;
  const left = hiker.boosts.filter((b) => !(b.once && b.tileId === tileId));
  if (left.length) hiker.boosts = left;
  else delete hiker.boosts;
}

/** Does this hiker have a boost from this item right now? */
export const hasBoost = (hiker: Hiker, itemId: string) =>
  (hiker.boosts ?? []).some((b) => b.itemId === itemId);

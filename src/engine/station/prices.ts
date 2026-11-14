/**
 * Station prices (docs/design/06-ranger-stations.md, "Prices" and "Selling").
 * The same at every station: a theme only changes what is for sale.
 *
 * - An item costs its tier's price × its Quality's multiplier, to the nearest
 *   cap (Tier 1 = 4, Tier 2 = 8, Tier 3 = 14; Quality 1–5 = ×0.5 to ×1.5).
 *   Shelters and trinkets have no Quality: ×1.
 * - A blueprint costs 1.5× its item's Quality 3 price.
 * - Selling an item: half its price new, times what's left (uses, bites or
 *   durability out of full), rounded down, at least 1 cap. Shelters and
 *   trinkets sell for the full half.
 * - Selling resources: the normal price, ×2 or ×½ by this visit's market.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { fullCounters, maxDurabilityOf, qualityOf } from '../items/make';
import type { Quality } from '../items/quality';
import type { GameState, ItemId, ItemInstance, ResourceId } from '../types';

const S = BALANCE.station;

/** Floating-point safety for prices that land exactly on a whole cap. */
const down = (n: number) => Math.floor(n + 1e-9);

/** An item's price new, from its tier and Quality. */
export function itemPrice(itemId: ItemId, quality?: Quality): number {
  const def = ITEMS[itemId];
  if (!def) return 0;
  const base = S.tierPrice[def.tier] ?? S.tierPrice[3] ?? 0;
  const mult = quality ? (S.qualityPrice[quality - 1] ?? 1) : 1;
  return Math.round(base * mult);
}

/** A blueprint: 1.5× its item's Quality 3 price. */
export const blueprintPrice = (itemId: ItemId): number =>
  Math.round(S.blueprintPrice * itemPrice(itemId, 3));

/** How much of an item is left: uses, bites or durability out of full (1 for shelters and trinkets). */
export function leftShare(item: ItemInstance): number {
  const def = ITEMS[item.itemId];
  if (!def) return 1;
  const full = fullCounters(def, qualityOf(item));
  if (def.type === 'tool' && full.usesLeft) return (item.usesLeft ?? full.usesLeft) / full.usesLeft;
  if (def.type === 'food' && full.bitesLeft) {
    return (item.bitesLeft ?? full.bitesLeft) / full.bitesLeft;
  }
  if (def.type === 'clothes') {
    const max = maxDurabilityOf(item);
    return max > 0 ? (item.durability ?? max) / max : 1;
  }
  return 1;
}

/** What the shop pays for a bag item. */
export function sellPrice(item: ItemInstance): number {
  const half = itemPrice(item.itemId, qualityOf(item)) * S.sellShare;
  return Math.max(1, down(half * leftShare(item)));
}

/** This visit's market: ×2, ×½ or ×1 for a resource. */
export function marketMult(state: GameState, resource: ResourceId): number {
  const market = state.station?.market;
  if (market?.high.includes(resource)) return S.market.highMult;
  if (market?.low.includes(resource)) return S.market.lowMult;
  return 1;
}

/** What the shop pays for `count` of one resource (two ×½ ones make a cap). */
export const resourceSellPrice = (state: GameState, resource: ResourceId, count: number): number =>
  down(count * S.resourcePrice * marketMult(state, resource));

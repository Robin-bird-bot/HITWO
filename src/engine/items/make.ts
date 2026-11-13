/**
 * Making item instances: a Quality (tools, food and clothes), and full uses,
 * bites or durability for that Quality.
 *
 * - Found, bought and given items roll the plain Quality curve. Crafting
 *   shifts it with the crafter's Luck (Wyatt, Nov 7: each point of Luck moves
 *   5 points from Quality 1–2 to 4–5, half from each).
 * - An instance with no Quality (an older save, a test) counts as Quality 3.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import type { ItemDef } from '../effects';
import { pick, weightedPick } from '../rng';
import type { GameState, ItemId, ItemInstance, NodeType, RngState } from '../types';
import { hasQuality, valueAt, type Quality } from './quality';

/** The Quality odds (1 to 5) for a crafter with this much Luck. */
export function qualityOdds(luck = 0): [number, number, number, number, number] {
  const odds = [...BALANCE.items.quality.odds] as [number, number, number, number, number];
  // Each point of Luck moves half a step from each low Quality to each high one.
  const step = (BALANCE.items.quality.luckStep / 2) * Math.abs(luck);
  const [from, to] =
    luck >= 0
      ? [
          [0, 1],
          [3, 4],
        ]
      : [
          [3, 4],
          [0, 1],
        ];
  let moved = 0;
  for (const i of from) {
    const take = Math.min(odds[i] ?? 0, step);
    odds[i] = (odds[i] ?? 0) - take;
    moved += take;
  }
  for (const i of to) odds[i] = (odds[i] ?? 0) + moved / 2;
  return odds;
}

export function rollQuality(rng: RngState, luck = 0): Quality {
  const odds = qualityOdds(luck);
  return weightedPick(
    rng,
    odds.map((weight, i) => ({ item: (i + 1) as Quality, weight })),
  );
}

/** An item's Quality: its own, the item's fixed one, or 3. None for shelters and trinkets. */
export function qualityOf(item: Pick<ItemInstance, 'itemId' | 'quality'>): Quality | undefined {
  const def = ITEMS[item.itemId];
  if (!def || !hasQuality(def)) return undefined;
  return def.fixedQuality ?? item.quality ?? 3;
}

/** Clothes: full durability in days at this Quality. */
export function fullDurability(def: ItemDef, quality: Quality | undefined): number {
  const table = BALANCE.items.durability[def.tier] ?? BALANCE.items.durability[1];
  return valueAt(def.durability ?? table, quality);
}

/** What a full item of this Quality has: uses (tools), bites (food) or durability (clothes). */
export function fullCounters(
  def: ItemDef,
  quality: Quality | undefined,
): Pick<ItemInstance, 'usesLeft' | 'bitesLeft' | 'durability'> {
  if (def.type === 'tool') return { usesLeft: valueAt(def.uses ?? 1, quality) };
  if (def.type === 'food') return { bitesLeft: valueAt(def.bites ?? 1, quality) };
  if (def.type === 'clothes') return { durability: fullDurability(def, quality) };
  return {};
}

/** Fills in a Quality (3, or the item's fixed one) and full counters where they're missing. */
export function withDefaults(item: ItemInstance): ItemInstance {
  const def = ITEMS[item.itemId];
  if (!def) return item;
  const quality = hasQuality(def) ? (def.fixedQuality ?? item.quality ?? 3) : undefined;
  return { ...fullCounters(def, quality), ...item, ...(quality ? { quality } : {}) };
}

/**
 * A new item: Quality rolled on the plain curve (or as given), with full
 * counters. The uid is unique within the game.
 */
export function makeItem(
  state: GameState,
  itemId: ItemId,
  {
    quality,
    prefix = 'item',
    luck = 0,
    node,
  }: { quality?: Quality; prefix?: string; luck?: number; node?: NodeType } = {},
): ItemInstance {
  const def = ITEMS[itemId];
  const uid = `${prefix}-${state.nextEventId}-${state.itemSerial ?? 0}-${itemId}`;
  state.itemSerial = (state.itemSerial ?? 0) + 1;
  if (!def || !hasQuality(def))
    return { uid, itemId, ...(def ? fullCounters(def, undefined) : {}) };
  const q = def.fixedQuality ?? quality ?? rollQuality(state.rng, luck);
  // A crafter picks the node; found ones get a random one.
  const made = def.madeWithNode ? { node: node ?? pick(state.rng, NODES) } : {};
  return { uid, itemId, quality: q, ...fullCounters(def, q), ...made };
}

const NODES: readonly NodeType[] = ['forest', 'river', 'wildlife', 'mountain'];

/** A clothing item's full durability: its own raise (Fort Rock), or its tier's at its Quality. */
export function maxDurabilityOf(item: ItemInstance): number {
  const def = ITEMS[item.itemId];
  if (item.maxDurability !== undefined) return item.maxDurability;
  return def ? fullDurability(def, qualityOf(item)) : 0;
}

/** Durability left on a clothing item (full when it has no count yet). */
export const durabilityLeft = (item: ItemInstance): number =>
  item.durability ?? maxDurabilityOf(item);

/** Uses left on a tool (full when it has no count yet). */
export function usesLeftOf(item: ItemInstance): number {
  const def = ITEMS[item.itemId];
  return item.usesLeft ?? (def ? (fullCounters(def, qualityOf(item)).usesLeft ?? 1) : 0);
}

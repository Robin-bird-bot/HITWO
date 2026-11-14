/**
 * A trail tile's side features (01-design-doc.md, "Side features"; Phase 9),
 * free for any active hiker standing there, at station prices and Quality.
 *
 * - Merchant: 3 cards (items, resource bundles or blueprints), rolled the
 *   first time someone stands on the tile. Any of them can be bought, each
 *   once (Wyatt, Nov 14). The hiker who buys takes it.
 * - Traveling Trader: their item, one tier above the biome's (Wyatt, Nov 14),
 *   for any 1 item of a type they want (random, and not their item's). One
 *   trade. Trading, like selling, isn't "lost" for Rocco's Boutique.
 */
import { BALANCE } from '../../config/balance';
import { ITEMS, TABLE_ITEMS } from '../../content/items';
import { RESOURCES } from '../../content/resources';
import type { ItemDef } from '../effects';
import { bagSlots, resourceCount, resourceLimit } from '../inventory';
import { knowsBlueprint } from '../items/craft';
import { qualityOf } from '../items/make';
import { removeItem } from '../items/wear';
import { pushEvent } from '../log';
import { pick, roll, weightedPick } from '../rng';
import type {
  Action,
  BlueprintOffer,
  BundleOffer,
  GameState,
  Hiker,
  ItemId,
  ItemOffer,
  Tile,
  TrailShop,
} from '../types';
import { findHiker, mustFindHiker, notActiveReason } from '../actions/common';
import { blueprintPrice, itemPrice } from './prices';
import { makeShopItem, pickFrom } from './stock';

type MerchantBuy = Extract<Action, { type: 'merchantBuy' }>;
type Trade = Extract<Action, { type: 'trade' }>;
type Wanted = Extract<TrailShop, { kind: 'trader' }>['wants'];

const S = BALANCE.station;
/** What a Trader can want, and what their own item can be. TODO(wyatt): first guesses. */
const WANTS: readonly Wanted[] = ['tool', 'clothes', 'food'];
const OFFERS = ['tool', 'clothes', 'food', 'shelter'] as const;

const sellable = (d: ItemDef) => !d.notFound;
const anything = () => TABLE_ITEMS.filter((d) => sellable(d) && d.type !== 'trinket');
const trinkets = () => TABLE_ITEMS.filter((d) => sellable(d) && d.type === 'trinket');

/** Rolls a side feature's wares the first time someone stands on its tile. */
export function rollTrailShop(state: GameState, tile: Tile): void {
  if (!tile.feature || tile.shop) return;
  tile.shop = tile.feature === 'merchant' ? rollMerchant(state) : rollTrader(state);
}

function rollMerchant(state: GameState): TrailShop {
  const kinds = Object.entries(S.merchant.kinds).map(([item, weight]) => ({ item, weight }));
  const taken = new Set<ItemId>();
  const bundled = new Set<string>();
  const offers: (ItemOffer | BlueprintOffer | BundleOffer)[] = [];
  for (let i = 0; i < S.merchant.cards; i++) {
    const id = `merchant-${i}`;
    const kind = weightedPick(state.rng, kinds);
    if (kind === 'bundle') {
      // Never two bundles of the same resource.
      const left = RESOURCES.filter((r) => !bundled.has(r.id));
      if (!left.length) continue;
      const resource = pick(state.rng, left).id;
      bundled.add(resource);
      offers.push({ kind: 'bundle', id, resource, count: S.bundleSize, price: S.bundlePrice });
      continue;
    }
    if (kind === 'blueprint') {
      const pool = anything().filter((d) => !!d.recipe);
      const itemId = pickFrom(state, pool, [], taken);
      if (!itemId) continue;
      taken.add(itemId);
      offers.push({ kind: 'blueprint', id, itemId, price: blueprintPrice(itemId) });
      continue;
    }
    // An item: like a station's "anything" slot, with its trinket chance.
    const pool = roll(state.rng, S.trinketChance) ? trinkets() : anything();
    const itemId = pickFrom(state, pool, [], taken);
    if (!itemId) continue;
    taken.add(itemId);
    const item = makeShopItem(state, itemId);
    offers.push({ kind: 'item', id, item, price: itemPrice(itemId, qualityOf(item)) });
  }
  return { kind: 'merchant', offers };
}

function rollTrader(state: GameState): TrailShop {
  const tier = Math.min(3, state.section.tier + S.traderTierAbove);
  const type = pick(state.rng, OFFERS);
  const ofType = TABLE_ITEMS.filter((d) => sellable(d) && d.type === type);
  const atTier = ofType.filter((d) => d.tier === tier);
  const def = pick(state.rng, atTier.length ? atTier : ofType);
  const wants = pick(
    state.rng,
    WANTS.filter((w) => w !== type),
  );
  return { kind: 'trader', item: makeShopItem(state, def.id), wants };
}

/** The side feature on this hiker's tile, if it's that kind and stocked. */
function shopHere<K extends TrailShop['kind']>(
  state: GameState,
  hiker: Hiker,
  kind: K,
): Extract<TrailShop, { kind: K }> | undefined {
  const shop = state.section.tiles[hiker.tileId]?.shop;
  return shop?.kind === kind ? (shop as Extract<TrailShop, { kind: K }>) : undefined;
}

export function validateMerchantBuy(state: GameState, action: MerchantBuy): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  const shop = shopHere(state, hiker, 'merchant');
  if (!shop) return `There’s no Merchant on ${hiker.name}’s tile.`;
  const offer = shop.offers.find((o) => o.id === action.offerId);
  if (!offer) return 'The Merchant doesn’t have that.';
  if (offer.sold) return 'That’s already sold.';
  if (state.caps < offer.price) return `The party needs ${offer.price} caps.`;
  const bagFull = hiker.inventory.bag.length >= bagSlots(state, hiker).total;
  if (offer.kind === 'item' && bagFull) return `${hiker.name}’s bag is full.`;
  if (offer.kind === 'bundle') {
    const room = resourceLimit(state, hiker) - resourceCount(hiker);
    if (room < (offer.count ?? 0)) {
      return `${hiker.name} has room for ${Math.max(0, room)} more resource${room === 1 ? '' : 's'}.`;
    }
  }
  if (offer.kind === 'blueprint' && knowsBlueprint(hiker, offer.itemId)) {
    return `${hiker.name} already knows the ${ITEMS[offer.itemId]?.name ?? 'blueprint'}.`;
  }
  return undefined;
}

export function applyMerchantBuy(state: GameState, action: MerchantBuy): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const offer = shopHere(state, hiker, 'merchant')?.offers.find((o) => o.id === action.offerId);
  if (!offer) return;
  state.caps -= offer.price;
  offer.sold = true;
  const price = offer.price;
  if (offer.kind === 'blueprint') {
    hiker.blueprints = [...(hiker.blueprints ?? []), offer.itemId];
    pushEvent(state, { kind: 'bought', hikerId: hiker.id, price, blueprint: offer.itemId });
  } else if (offer.kind === 'bundle' && offer.resource) {
    const n = offer.count ?? 0;
    hiker.inventory.resources[offer.resource] =
      (hiker.inventory.resources[offer.resource] ?? 0) + n;
    pushEvent(state, {
      kind: 'bought',
      hikerId: hiker.id,
      price,
      resource: offer.resource,
      count: n,
    });
  } else if (offer.kind === 'item') {
    hiker.inventory.bag.push(offer.item);
    pushEvent(state, { kind: 'bought', hikerId: hiker.id, price, itemId: offer.item.itemId });
  }
}

/** The items a hiker could give a Trader: in the bag or worn, of the type they want. */
export function tradeable(state: GameState, hiker: Hiker) {
  const shop = shopHere(state, hiker, 'trader');
  if (!shop) return [];
  const worn = Object.values(hiker.inventory.equipped).filter((i) => !!i);
  return [...hiker.inventory.bag, ...worn].filter((i) => ITEMS[i.itemId]?.type === shop.wants);
}

export function validateTrade(state: GameState, action: Trade): string | undefined {
  const hiker = findHiker(state, action.hikerId);
  const reason = notActiveReason(hiker);
  if (reason || !hiker) return reason;
  const shop = shopHere(state, hiker, 'trader');
  if (!shop) return `There’s no Traveling Trader on ${hiker.name}’s tile.`;
  if (shop.traded) return 'The Trader has already traded.';
  const inBag = hiker.inventory.bag.some((i) => i.uid === action.itemUid);
  const item = tradeable(state, hiker).find((i) => i.uid === action.itemUid);
  if (!item) return `The Trader wants ${shop.wants === 'clothes' ? 'clothes' : `a ${shop.wants}`}.`;
  // A worn item comes off, so the Trader's item needs room in the bag.
  if (!inBag && hiker.inventory.bag.length >= bagSlots(state, hiker).total) {
    return `${hiker.name}’s bag is full.`;
  }
  return undefined;
}

export function applyTrade(state: GameState, action: Trade): void {
  const hiker = mustFindHiker(state, action.hikerId);
  const shop = shopHere(state, hiker, 'trader');
  if (!shop) return;
  const given = removeItem(hiker, action.itemUid);
  if (!given) return;
  hiker.inventory.bag.push(shop.item);
  shop.traded = { hikerId: hiker.id, itemId: given.itemId };
  pushEvent(state, {
    kind: 'traded',
    hikerId: hiker.id,
    gave: given.itemId,
    got: shop.item.itemId,
  });
}

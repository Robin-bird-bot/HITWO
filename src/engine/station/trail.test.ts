import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { validateAction } from '../applyAction';
import { makeItem } from '../items/make';
import { deserialize, serialize } from '../save';
import { fixtureGame, hiker, run } from '../test/fixtures';
import type { Action, GameState, TrailShop } from '../types';
import { blueprintPrice, itemPrice } from './prices';

const to = (tileId: string): Action => ({ type: 'move', hikerId: 'ash', toTileId: tileId });

/** A side feature on L, and Ash standing there. */
function at(feature: 'merchant' | 'trader', seed = 4): GameState {
  const s = fixtureGame({ seed });
  s.section.tiles.L!.feature = feature;
  return run(s, to('L'));
}

const merchant = (s: GameState) =>
  s.section.tiles.L?.shop as Extract<TrailShop, { kind: 'merchant' }> | undefined;
const trader = (s: GameState) =>
  s.section.tiles.L?.shop as Extract<TrailShop, { kind: 'trader' }> | undefined;

describe('the Merchant', () => {
  it('rolls 3 cards the first time someone stands there, at station prices', () => {
    const s = fixtureGame({ seed: 4 });
    s.section.tiles.L!.feature = 'merchant';
    expect(s.section.tiles.L?.shop).toBeUndefined();
    const after = run(s, to('L'));
    const offers = merchant(after)?.offers ?? [];
    expect(offers).toHaveLength(BALANCE.station.merchant.cards);
    for (const o of offers) {
      if (o.kind === 'item') expect(o.price).toBe(itemPrice(o.item.itemId, o.item.quality));
      if (o.kind === 'blueprint') expect(o.price).toBe(blueprintPrice(o.itemId));
      if (o.kind === 'bundle') expect(o.price).toBe(BALANCE.station.bundlePrice);
    }
  });

  it('never has two bundles of the same resource', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const offers = merchant(at('merchant', seed))?.offers ?? [];
      const res = offers.flatMap((o) => (o.kind === 'bundle' ? [o.resource] : []));
      expect(new Set(res).size).toBe(res.length);
    }
  });

  it('sells any of the 3, each once, to the hiker who buys it', () => {
    for (let seed = 1; seed <= 6; seed++) {
      let s = at('merchant', seed);
      s.caps = 100;
      const offers = merchant(s)?.offers ?? [];
      for (const o of offers) {
        s = run(s, { type: 'merchantBuy', hikerId: 'ash', offerId: o.id });
      }
      expect(merchant(s)?.offers.every((o) => o.sold)).toBe(true);
      const first = offers[0]!;
      expect(validateAction(s, { type: 'merchantBuy', hikerId: 'ash', offerId: first.id })).toBe(
        'That’s already sold.',
      );
      expect(s.caps).toBe(100 - offers.reduce((n, o) => n + o.price, 0));
    }
  });

  it('only on its tile, and only with the caps', () => {
    const s = at('merchant');
    const offer = merchant(s)!.offers[0]!;
    expect(validateAction(s, { type: 'merchantBuy', hikerId: 'birch', offerId: offer.id })).toBe(
      'There’s no Merchant on Birch’s tile.',
    );
    expect(validateAction(s, { type: 'merchantBuy', hikerId: 'ash', offerId: offer.id })).toBe(
      `The party needs ${offer.price} caps.`,
    );
  });
});

describe('the Traveling Trader', () => {
  it('has an item one tier above the biome, and wants another type', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const shop = trader(at('trader', seed));
      const def = ITEMS[shop!.item.itemId]!;
      expect(def.tier).toBe(2); // the Meadow is Tier I
      expect(shop!.wants).not.toBe(def.type);
    }
  });

  it('trades once: an item of the wanted type for theirs', () => {
    let s = at('trader', 3);
    const shop = trader(s)!;
    const want = { tool: 'shovel', clothes: 'plainShirt', food: 'trailMix' }[shop.wants];
    const mine = makeItem(s, want, { quality: 3 });
    const other = makeItem(s, shop.wants === 'food' ? 'shovel' : 'trailMix', { quality: 3 });
    hiker(s, 'ash').inventory.bag.push(mine, other);
    expect(validateAction(s, { type: 'trade', hikerId: 'ash', itemUid: other.uid })).toMatch(
      /The Trader wants/,
    );
    s = run(s, { type: 'trade', hikerId: 'ash', itemUid: mine.uid });
    const bag = hiker(s, 'ash').inventory.bag.map((i) => i.itemId);
    expect(bag).toContain(shop.item.itemId);
    expect(bag).not.toContain(want);
    expect(trader(s)?.traded).toEqual({ hikerId: 'ash', itemId: want });
    expect(s.usedOrLost).toBeUndefined();
    const again = makeItem(s, want, { quality: 3 });
    hiker(s, 'ash').inventory.bag.push(again);
    expect(validateAction(s, { type: 'trade', hikerId: 'ash', itemUid: again.uid })).toBe(
      'The Trader has already traded.',
    );
  });

  it('a worn item comes off for the trade, with room in the bag', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = at('trader', seed);
      if (trader(s)?.wants !== 'clothes') continue;
      const shirt = makeItem(s, 'plainShirt', { quality: 3 });
      hiker(s, 'ash').inventory.equipped.body = shirt;
      const bag = hiker(s, 'ash').inventory.bag;
      while (bag.length < BALANCE.inventory.bagSlots) bag.push(makeItem(s, 'tent'));
      expect(validateAction(s, { type: 'trade', hikerId: 'ash', itemUid: shirt.uid })).toBe(
        'Ash’s bag is full.',
      );
      bag.pop();
      const after = run(s, { type: 'trade', hikerId: 'ash', itemUid: shirt.uid });
      expect(hiker(after, 'ash').inventory.equipped.body).toBeUndefined();
      return;
    }
    throw new Error('No seed gave a Trader who wants clothes');
  });
});

describe('saves', () => {
  it('a Merchant someone reached in an older save gets its cards', () => {
    const s = at('merchant');
    const old = JSON.parse(serialize(s));
    old.saveVersion = 12;
    delete old.section.tiles.L.shop;
    const loaded = deserialize(JSON.stringify(old));
    const shop = loaded.ok ? loaded.state.section.tiles.L?.shop : undefined;
    expect(shop?.kind).toBe('merchant');
  });
});

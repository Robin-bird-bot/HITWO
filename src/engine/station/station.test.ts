import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { RESOURCES } from '../../content/resources';
import { STATION_THEMES } from '../../content/stations';
import { validateAction } from '../applyAction';
import { canUseBlueprint, craftTier, knowsBlueprint } from '../items/craft';
import { makeItem } from '../items/make';
import { deserialize, serialize } from '../save';
import { END, fixtureGame, hiker, run } from '../test/fixtures';
import type { Action, GameState, ItemOffer } from '../types';
import { blueprintPrice, itemPrice, resourceSellPrice, sellPrice } from './prices';
import { fromUsedOrLost, openStation, stationItemCount } from './stock';
import type { StationThemeId } from './types';

/** Everyone checked in, the station open with this theme. */
function station(themeId: StationThemeId, seed = 5, setup?: (s: GameState) => void): GameState {
  const s = fixtureGame({ seed });
  setup?.(s);
  const open = run(s, { type: 'debug', op: { kind: 'openStation', themeId } });
  expect(open.station?.themeId).toBe(themeId);
  return open;
}

const buy = (offerId: string, hikerId = 'ash', pick?: Extract<Action, { type: 'buy' }>['pick']) =>
  ({ type: 'buy', offerId, hikerId, ...(pick ? { pick } : {}) }) as Action;

describe('station themes', () => {
  it('nine themes, eight shopkeepers, and every listed item exists', () => {
    expect(STATION_THEMES).toHaveLength(9);
    expect(new Set(STATION_THEMES.map((t) => t.shopkeeper.portrait)).size).toBe(8);
    for (const t of STATION_THEMES) {
      const listed = [...t.featured, ...(t.favoredTrinkets ?? [])];
      if ('items' in t.focus) listed.push(...t.focus.items);
      for (const id of listed) expect(ITEMS[id], `${t.id}: ${id}`).toBeDefined();
      expect(t.lines.greet.length).toBeGreaterThan(0);
    }
  });

  it('never repeats a theme in a run, and both Rocco shops can come up together', () => {
    const s = fixtureGame({ seed: 2 });
    const seen = STATION_THEMES.map(() => openStation(s).themeId);
    expect(new Set(seen).size).toBe(STATION_THEMES.length);

    let both = false;
    for (let seed = 1; seed < 300 && !both; seed++) {
      const r = fixtureGame({ seed });
      const two = [openStation(r).themeId, openStation(r).themeId];
      both = two.includes('roccoBoutique') && two.includes('roccoResale');
    }
    expect(both).toBe(true);
  });
});

describe('stock', () => {
  it('6 items at the first station, +1 at each later one, at most 10', () => {
    expect([1, 2, 3, 4, 5, 6].map(stationItemCount)).toEqual([6, 7, 8, 9, 10, 10]);
    expect(station('finn').station?.items).toHaveLength(6);
  });

  it('3 blueprints for sale, 3 free ones for the Workbench, 2 bundles, a special, a market', () => {
    const v = station('businessman').station!;
    expect(v.blueprints).toHaveLength(3);
    expect(v.blueprints.every((b) => ITEMS[b.itemId]?.type === 'tool')).toBe(true);
    expect(v.tempBlueprints).toHaveLength(3);
    expect(v.tempBlueprints.some((id) => v.blueprints.some((b) => b.itemId === id))).toBe(false);
    expect(v.bundles).toHaveLength(2);
    expect(v.bundles.every((b) => b.count === 3 && b.price === 4)).toBe(true);
    expect(v.special).toBeDefined();
  });

  it('the market: 4 resources sell for ×2 and 4 others for ×½', () => {
    const v = station('wink').station!;
    expect(v.market.high).toHaveLength(4);
    expect(v.market.low).toHaveLength(4);
    expect(new Set([...v.market.high, ...v.market.low]).size).toBe(8);
  });

  it('the first slots come from the theme’s focus; Puked Nuggets only at Chef Bear’s', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const v = station('finn', seed).station!;
      const focus = v.items.slice(0, BALANCE.station.focusSlots);
      for (const o of focus) expect(['clothes', 'trinket']).toContain(ITEMS[o.item.itemId]?.type);
      const ids = station('bearEI', seed).station!.items.map((o) => o.item.itemId);
      expect(ids).not.toContain('pukedNuggets');
    }
  });

  it('the same seed stocks the same shop', () => {
    const a = station('drSckhunk', 9).station!;
    const b = station('drSckhunk', 9).station!;
    expect(a.items.map((o) => [o.item.itemId, o.item.quality])).toEqual(
      b.items.map((o) => [o.item.itemId, o.item.quality]),
    );
  });
});

describe('prices', () => {
  it('tier × Quality, to the nearest cap (the doc’s table)', () => {
    const row = (id: string) => ([1, 2, 3, 4, 5] as const).map((q) => itemPrice(id, q));
    expect(row('bandaid')).toEqual([2, 3, 4, 5, 6]); // Tier 1
    expect(row('bandages')).toEqual([4, 6, 8, 10, 12]); // Tier 2
    expect(row('medkit')).toEqual([7, 11, 14, 18, 21]); // Tier 3
    expect(['bandaid', 'bandages', 'medkit'].map(blueprintPrice)).toEqual([6, 12, 21]);
  });

  it('selling: half the price new × what’s left, rounded down, at least 1', () => {
    const s = fixtureGame();
    const jacket = makeItem(s, 'heavyJacket', { quality: 4 }); // Tier 2, 7 durability
    jacket.durability = 5;
    expect(sellPrice(jacket)).toBe(3); // 10 ÷ 2 × 5/7
    const tent = makeItem(s, 'tent');
    expect(sellPrice(tent)).toBe(2); // a Tier 1 shelter: the full half
    const worn = makeItem(s, 'bandaid', { quality: 1 });
    expect(sellPrice(worn)).toBe(1);
  });

  it('resources sell at the market’s prices; two ×½ ones make a cap', () => {
    const s = station('finn');
    const [high] = s.station!.market.high;
    const [low] = s.station!.market.low;
    expect(resourceSellPrice(s, high!, 3)).toBe(6);
    expect(resourceSellPrice(s, low!, 1)).toBe(0);
    expect(resourceSellPrice(s, low!, 2)).toBe(1);
  });
});

describe('buying and selling', () => {
  it('an item goes to the hiker for the party’s caps; not without the caps or bag room', () => {
    let s = station('finn');
    const offer = s.station!.items[0]!;
    expect(validateAction(s, buy(offer.id))).toBe(`The party needs ${offer.price} caps.`);
    s.caps = 50;
    s = run(s, buy(offer.id));
    expect(s.caps).toBe(50 - offer.price);
    expect(hiker(s, 'ash').inventory.bag.map((i) => i.uid)).toContain(offer.item.uid);
    expect(validateAction(s, buy(offer.id))).toBe('That’s already sold.');

    const full = station('finn');
    full.caps = 50;
    const bag = hiker(full, 'ash').inventory.bag;
    while (bag.length < BALANCE.inventory.bagSlots) bag.push(makeItem(full, 'tent'));
    expect(validateAction(full, buy(full.station!.items[0]!.id))).toBe('Ash’s bag is full.');
  });

  it('a blueprint is learned for good; not one the hiker knows', () => {
    let s = station('wink');
    s.caps = 50;
    const bp = s.station!.blueprints[0]!;
    s = run(s, buy(bp.id));
    expect(knowsBlueprint(hiker(s, 'ash'), bp.itemId)).toBe(true);
    const again = s.station!.blueprints[1]!;
    hiker(s, 'birch').blueprints = [again.itemId];
    expect(validateAction(s, buy(again.id, 'birch'))).toBe(
      `Birch already knows the ${ITEMS[again.itemId]?.name}.`,
    );
  });

  it('selling a bag item or resources fills the purse', () => {
    let s = station('chefBear');
    const item = makeItem(s, 'bandages', { quality: 3 });
    hiker(s, 'ash').inventory.bag.push(item);
    const [high] = s.station!.market.high;
    hiker(s, 'ash').inventory.resources[high!] = 2;
    s = run(
      s,
      { type: 'sell', hikerId: 'ash', itemUid: item.uid },
      { type: 'sell', hikerId: 'ash', resource: high!, count: 2 },
    );
    expect(s.caps).toBe(4 + 4);
    expect(hiker(s, 'ash').inventory.bag).toHaveLength(0);
    expect(hiker(s, 'ash').inventory.resources[high!]).toBeUndefined();
  });

  it('only station steps while it’s open: no ending the phase', () => {
    const s = station('finn');
    expect(validateAction(s, END)).toBe(
      'The party is at the ranger station: Rest & Go to move on.',
    );
  });
});

describe('Rocco’s “Borrowed” Boutique', () => {
  it('logs what was used up or lost, never what was sold', () => {
    let s = fixtureGame();
    const bite = makeItem(s, 'coffee', { quality: 3 });
    bite.bitesLeft = 1;
    hiker(s, 'ash').inventory.bag.push(bite);
    s = run(s, { type: 'eat', hikerId: 'ash', itemUid: bite.uid });
    expect(s.usedOrLost).toEqual({ coffee: 1 });

    const open = station('finn');
    const sold = makeItem(open, 'tent');
    hiker(open, 'ash').inventory.bag.push(sold);
    const after = run(open, { type: 'sell', hikerId: 'ash', itemUid: sold.uid });
    expect(after.usedOrLost).toBeUndefined();
  });

  it('stocks all of the log when it fits, and fills the rest at random', () => {
    const s = station('roccoBoutique', 5, (g) => {
      g.usedOrLost = { coffee: 2, tent: 1 };
    });
    const ids = s.station!.items.map((o) => o.item.itemId);
    expect(ids).toHaveLength(6);
    expect(ids.slice(0, 2).sort()).toEqual(['coffee', 'tent']);
  });

  it('with more than the slots, the least used or lost; ties at random', () => {
    // Seven items lost once (more than the 6 slots), and two lost more often.
    const usedOrLost = {
      coffee: 1,
      tent: 1,
      bandaid: 1,
      scanner: 1,
      flannel: 1,
      jerky: 1,
      hammock: 1,
      paver: 3,
      glasses: 4,
    };
    const picks = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = fixtureGame({ seed });
      s.usedOrLost = usedOrLost;
      const got = fromUsedOrLost(s, 6);
      expect(got).toHaveLength(6);
      expect(got).not.toContain('paver'); // used 3 times
      expect(got).not.toContain('glasses'); // used 4 times
      picks.add([...got].sort().join(','));
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('Rocco’s Random Resale', () => {
  it('everything face-down at its tier’s Quality 3 price, until bought', () => {
    let s = station('roccoResale');
    const v = s.station!;
    expect(v.items.every((o) => o.hidden)).toBe(true);
    expect(v.items.every((o) => o.price === itemPrice(o.item.itemId, 3))).toBe(true);
    expect(v.blueprints.every((b) => b.hidden)).toBe(true);
    expect(v.bundles).toHaveLength(4);
    s.caps = 50;
    const first = v.items[0]!;
    s = run(s, buy(first.id));
    const bought = s.station!.items[0] as ItemOffer;
    expect(bought.hidden).toBeUndefined();
    expect(bought.sold).toBe(true);
    expect(s.log.findLast((e) => e.kind === 'bought')).toMatchObject({
      mystery: true,
      itemId: first.item.itemId,
    });
    expect(s.station!.items[1]!.hidden).toBe(true);
  });
});

describe('specials and the rejoin', () => {
  it('Cement Mixer paves a line in the next biome; Scout Report shows its cards when it starts', () => {
    let s = station('finn');
    s.caps = 50;
    const next = s.station!.next;
    const line = next.lines.find((l) => l.kind === 'normal')!;
    s.station!.special = { kind: 'special', id: 'special', special: 'cementMixer', price: 6 };
    s = run(s, buy('special', 'ash', { lineId: line.id }));
    expect(s.station!.next.lines.find((l) => l.id === line.id)?.kind).toBe('paved');

    let t = station('wink');
    t.caps = 50;
    t.station!.special = { kind: 'special', id: 'special', special: 'scoutReport', price: 6 };
    const tiles = Object.values(t.station!.next.tiles)
      .filter((x) => x.kind === 'normal' && !x.wonder && !x.quiet)
      .slice(0, 3)
      .map((x) => x.id);
    t = run(t, buy('special', 'ash', { tileIds: tiles }), { type: 'restAndGo' });
    expect(tiles.some((id) => t.section.tiles[id]?.revealedCard)).toBe(true);
  });

  it('the rejoin brings an abandoned hiker back, hurt, once per station and twice per run', () => {
    let s = station('drSckhunk');
    hiker(s, 'dot').status = 'abandoned';
    s.caps = 100;
    s = run(s, buy('rejoin', 'dot'));
    expect(hiker(s, 'dot')).toMatchObject({ status: 'checkedIn', injuries: 2 });
    expect(hiker(s, 'dot').stats).toEqual({ energy: 3, appetite: 3, morale: 3 });
    expect(s.caps).toBe(100 - BALANCE.station.rejoin.price);
    hiker(s, 'cedar').status = 'abandoned';
    expect(validateAction(s, buy('rejoin', 'cedar'))).toBe(
      'This station’s Taxi Service has already been used.',
    );
    s.rejoinsUsed = 2;
    s.station!.rejoined = undefined;
    expect(validateAction(s, buy('rejoin', 'cedar'))).toBe('Only 2 hikers can rejoin in one hike.');
  });
});

describe('the Workbench', () => {
  it('crafts one tier higher, with no action, from everyone’s resources', () => {
    let s = station('businessman');
    const ash = hiker(s, 'ash');
    expect(craftTier(s, ash, 'tool')).toBe(2);
    hiker(s, 'birch').inventory.resources = Object.fromEntries(RESOURCES.map((r) => [r.id, 3]));
    s = run(s, { type: 'craft', hikerId: 'ash', itemType: 'tool' });
    expect(s.crafting?.options.every((o) => (ITEMS[o.itemId]?.tier ?? 0) >= 2)).toBe(true);
    s = run(s, { type: 'craftTake', index: 0 });
    expect(hiker(s, 'ash').inventory.bag).toHaveLength(1);
    expect(hiker(s, 'birch').inventory.resources).not.toEqual(
      Object.fromEntries(RESOURCES.map((r) => [r.id, 3])),
    );
  });

  it('a temporary blueprint is kept only by crafting it there', () => {
    let s = station('wink');
    const temp = s.station!.tempBlueprints[0]!;
    expect(canUseBlueprint(s, hiker(s, 'ash'), temp)).toBe(true);
    expect(knowsBlueprint(hiker(s, 'ash'), temp)).toBe(false);
    for (const h of s.hikers) {
      h.inventory.resources = Object.fromEntries(RESOURCES.map((r) => [r.id, 3]));
    }
    s = run(s, {
      type: 'craft',
      hikerId: 'ash',
      itemType: ITEMS[temp]!.type,
      blueprint: temp,
      ...(ITEMS[temp]?.madeWithNode ? { node: 'forest' as const } : {}),
    });
    expect(knowsBlueprint(hiker(s, 'ash'), temp)).toBe(true);
    const other = s.station!.tempBlueprints[1]!;
    s = run(s, { type: 'restAndGo' });
    expect(canUseBlueprint(s, hiker(s, 'birch'), other)).toBe(false);
  });
});

describe('Rest & Go', () => {
  it('a free night with nothing lost, then the next biome’s Trailhead the next morning', () => {
    let s = station('finn');
    const before = s.hikers.map((h) => ({ ...h.stats }));
    hiker(s, 'ash').stats.energy = 5;
    hiker(s, 'ash').boosts = [
      { itemId: 'supplyMap', remaining: 1, unit: 'phases', tileId: 'L', once: true },
    ];
    s.usedCards = ['flies'];
    s = run(s, { type: 'restAndGo' });
    expect(s).toMatchObject({ day: 2, phase: 'morning', sectionIndex: 1, usedCards: [] });
    expect(s.station).toBeUndefined();
    expect(s.section.biome).toBe('temperateRainforest');
    expect(s.section.tier).toBe(2);
    for (const h of s.hikers) {
      expect(h).toMatchObject({ status: 'active', tileId: s.section.trailheadId, acted: false });
    }
    expect(hiker(s, 'ash').stats.energy).toBe(5 + BALANCE.sleep.shelteredEnergy);
    expect(hiker(s, 'birch').stats.appetite).toBe(before[1]!.appetite);
    expect(hiker(s, 'ash').boosts).toBeUndefined();
    expect(s.log.some((e) => e.kind === 'nextSection')).toBe(true);
  });

  it('a hiker carried in, still out cold, starts the next biome passed out', () => {
    let s = station('finn', 5, (g) => {
      hiker(g, 'dot').injuries = BALANCE.injuries.passOutAt;
      hiker(g, 'dot').status = 'passedOut';
      hiker(g, 'ash').carrying = 'dot';
    });
    expect(hiker(s, 'dot').status).toBe('checkedIn');
    s = run(s, { type: 'restAndGo' });
    expect(hiker(s, 'dot')).toMatchObject({
      status: 'passedOut',
      countdown: BALANCE.passOut.countdownNights,
    });
  });

  it('the next biome gets a Wonder the run hasn’t used', () => {
    const s = fixtureGame({ seed: 4 });
    s.section.tiles.M!.wonder = { id: 'crater-lake', decoys: 0 };
    const v = openStation(s);
    const wonders = Object.values(v.next.tiles).flatMap((t) => (t.wonder ? [t.wonder.id] : []));
    expect(wonders).not.toContain('crater-lake');
    expect(s.usedWonders).toEqual(['crater-lake']);
  });
});

describe('saves', () => {
  it('a save mid-visit loads back the same', () => {
    const s = station('bearnes');
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state).toEqual(s);
  });

  it('a step 1 save stopped at a station (just its number) gets a stocked station', () => {
    const s = station('finn');
    const old = JSON.parse(serialize(s));
    old.saveVersion = 11;
    old.station = { checkpoint: 1 };
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.ok && loaded.state.station?.items.length).toBe(6);
  });
});

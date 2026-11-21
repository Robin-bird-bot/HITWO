/**
 * Presents and the holiday hikers (Nov 20 update, holiday-hikers-2, section 7).
 */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ITEMS, TABLE_ITEMS, TIER_3_ITEMS, findableItems } from '../../content/items';
import { craftableItems } from '../../content/items';
import { PRESENT_ID } from '../../content/items/presents';
import { STATION_THEMES } from '../../content/stations';
import { validateAction } from '../applyAction';
import { moveAllCost } from '../costs';
import { abilitiesFor, fireSitByFire } from '../effects';
import { deserialize, serialize } from '../save';
import { fromUsedOrLost, openStation } from '../station/stock';
import { rollTrailShop } from '../station/trail';
import { noteGone } from './gone';
import { rollPresentItem } from './presents';
import { END, fixtureGame, fixtureHiker, hiker, place, run } from '../test/fixtures';
import type { Action, GameState, PresentGrade, ResourceId } from '../types';

const T = BALANCE.traits;
const P = BALANCE.presents;

/** Grammy (Gift Wrapper and her kit), then Birch, Cedar and Dot with these traits. */
function party(
  traits: Partial<Record<'grammy' | 'birch' | 'cedar' | 'dot', string[]>> = {},
  seed = 4,
) {
  const s = fixtureGame({
    seed,
    hikers: [
      fixtureHiker(
        'grammy',
        traits.grammy ?? ['giftWrapper', 'downTheChimney', 'checkingItTwice', 'seasonOfGiving'],
      ),
      fixtureHiker('birch', traits.birch ?? []),
      fixtureHiker('cedar', traits.cedar ?? []),
      fixtureHiker('dot', traits.dot ?? []),
    ],
  });
  for (const h of s.hikers) h.stats.morale = 5;
  return s;
}

const give = (s: GameState, hikerId: string, resources: Partial<Record<ResourceId, number>>) =>
  run(s, { type: 'debug', op: { kind: 'giveResources', hikerId, resources } });

const present = (s: GameState, hikerId: string, grade: PresentGrade = 'plain', colorway = 2) => {
  const next = run(s, { type: 'debug', op: { kind: 'givePresent', hikerId, colorway, grade } });
  const item = hiker(next, hikerId).inventory.bag.at(-1)!;
  return { s: next, uid: item.uid };
};

const presentsOf = (s: GameState, id: string) =>
  hiker(s, id).inventory.bag.filter((i) => i.itemId === PRESENT_ID);

const wrap = (
  hikerId: string,
  recipe: Extract<Action, { type: 'wrapPresent' }>['recipe'],
  extra: Partial<Extract<Action, { type: 'wrapPresent' }>> = {},
): Action => ({ type: 'wrapPresent', hikerId, recipe, ...extra });

/** Ends phases until the next morning. */
const nextDay = (s: GameState) => {
  const day = s.day;
  let out = s;
  while (out.day === day) out = run(out, END);
  return out;
};

describe('Gift Wrapper', () => {
  it('rolls both wish lists when the run starts: 3 and 5 specific resources', () => {
    const lists = hiker(party(), 'grammy').wishLists!;
    expect(lists.small).toHaveLength(P.smallWishList);
    expect(lists.big).toHaveLength(P.bigWishList);
    expect(hiker(party(), 'birch').wishLists).toBeUndefined();
  });

  it('crafts only Presents: no other craft, even at a Workbench', () => {
    const s = give(party(), 'grammy', { metal: 3, wood: 3, stone: 3 });
    expect(validateAction(s, { type: 'craft', hikerId: 'grammy', itemType: 'tool' })).toBe(
      'Grammy only wraps Presents.',
    );
    expect(validateAction(s, wrap('birch', 'sameResource'))).toBe('Birch doesn’t wrap Presents.');
  });

  it('3 of one resource: a plain Present, wrapped by her, in a random wrapping', () => {
    let s = give(party(), 'grammy', { wood: 3 });
    s = run(s, wrap('grammy', 'sameResource'));
    const [p] = presentsOf(s, 'grammy');
    expect(p).toMatchObject({ grade: 'plain', wrappedBy: 'grammy' });
    expect(p?.colorway).toBeGreaterThanOrEqual(1);
    expect(p?.colorway).toBeLessThanOrEqual(P.colorways);
    expect(p?.quality).toBeUndefined();
    expect(hiker(s, 'grammy').inventory.resources.wood).toBeUndefined();
    expect(hiker(s, 'grammy').acted).toBe(true);
    expect(s.log.at(-1)?.kind === 'wrapped' || s.log.some((e) => e.kind === 'wrapped')).toBe(true);
  });

  it('3 of one resource means the same one: 2 Wood and a Moss won’t do', () => {
    const s = give(party(), 'grammy', { wood: 2, moss: 1 });
    expect(validateAction(s, wrap('grammy', 'sameResource'))).toBe('Needs 3 of one resource here.');
  });

  it('5 of one type: any mix of that type, never a mix of types', () => {
    let s = give(party(), 'grammy', { wood: 2, moss: 2, grass: 1, fish: 2 });
    s = run(s, wrap('grammy', 'sameType'));
    expect(presentsOf(s, 'grammy')[0]?.grade).toBe('plain');
    expect(hiker(s, 'grammy').inventory.resources).toEqual({ fish: 2 });

    const mixed = give(party(), 'grammy', { wood: 3, fish: 2 });
    expect(validateAction(mixed, wrap('grammy', 'sameType'))).toBe(
      'Needs 5 resources of one type here.',
    );
    // Spaces filled by hand with a mix are refused too.
    const slots = (['wood', 'wood', 'wood', 'fish', 'fish'] as const).map((resource) => ({
      from: 'grammy',
      resource,
    }));
    const handMixed = give(party(), 'grammy', { wood: 5, fish: 2 });
    expect(validateAction(handMixed, wrap('grammy', 'sameType', { node: 'forest', slots }))).toBe(
      'That resource doesn’t fit that space.',
    );
  });

  it('the wish lists: 3 specific resources make a Tier 2+ Present, 5 a Tier 3 one', () => {
    let s = run(party(), {
      type: 'debug',
      op: {
        kind: 'setWishLists',
        hikerId: 'grammy',
        lists: { small: ['wood', 'wood', 'fish'], big: ['salt', 'salt', 'oil', 'bones', 'clay'] },
      },
    });
    expect(validateAction(s, wrap('grammy', 'smallWish'))).toMatch(/Needs 3 more resources/);
    s = give(s, 'grammy', { wood: 2, fish: 1 });
    s = run(s, wrap('grammy', 'smallWish'));
    expect(presentsOf(s, 'grammy').map((p) => p.grade)).toEqual(['tier2plus']);

    s = run(s, {
      type: 'debug',
      op: {
        kind: 'setWishLists',
        hikerId: 'grammy',
        lists: { small: ['wood', 'wood', 'fish'], big: ['salt', 'salt', 'oil', 'bones', 'clay'] },
      },
    });
    s = give(s, 'grammy', { salt: 2, oil: 1, bones: 1, clay: 1 });
    hiker(s, 'grammy').acted = false;
    s = run(s, wrap('grammy', 'bigWish'));
    expect(presentsOf(s, 'grammy').map((p) => p.grade)).toEqual(['tier2plus', 'tier3']);
  });

  it('both wish lists change after every Present, whichever recipe', () => {
    let s = give(party(), 'grammy', { wood: 3 });
    const before = structuredClone(hiker(s, 'grammy').wishLists);
    s = run(s, wrap('grammy', 'sameResource'));
    const after = hiker(s, 'grammy').wishLists;
    expect(after?.small).not.toEqual(before?.small);
    expect(after?.big).not.toEqual(before?.big);
  });

  it('the wish lists and Presents survive a save and load', () => {
    let s = give(party(), 'grammy', { wood: 3 });
    s = run(s, wrap('grammy', 'sameResource'));
    const loaded = deserialize(serialize(s));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(hiker(loaded.state, 'grammy').wishLists).toEqual(hiker(s, 'grammy').wishLists);
    expect(presentsOf(loaded.state, 'grammy')).toEqual(presentsOf(s, 'grammy'));
  });

  it('she can’t open Presents', () => {
    const { s, uid } = present(party(), 'grammy');
    expect(validateAction(s, { type: 'openPresent', hikerId: 'grammy', itemUid: uid })).toBe(
      'Grammy can’t open her own Presents.',
    );
  });
});

describe('Checking It Twice', () => {
  it('rolls both wish lists again, once per day', () => {
    let s = party();
    const before = structuredClone(hiker(s, 'grammy').wishLists);
    const use: Action = { type: 'useAbility', hikerId: 'grammy', abilityId: 'checkingItTwice' };
    s = run(s, use);
    expect(hiker(s, 'grammy').wishLists?.small).not.toEqual(before?.small);
    expect(hiker(s, 'grammy').wishLists?.big).not.toEqual(before?.big);
    expect(validateAction(s, use)).toBe('Checking It Twice is used up today.');
    s = nextDay(s);
    expect(validateAction(s, use)).toBeNull();
  });
});

describe('never in a random pool', () => {
  it('not among the items any pool draws from', () => {
    expect(ITEMS[PRESENT_ID]?.type).toBe('present');
    expect(TABLE_ITEMS.some((d) => d.type === 'present')).toBe(false);
    expect(TIER_3_ITEMS).not.toContain(PRESENT_ID);
    for (const type of ['tool', 'clothes', 'food', 'shelter', 'trinket'] as const) {
      for (const tier of [1, 2, 3, 4]) {
        expect(findableItems(type, tier).map((d) => d.id)).not.toContain(PRESENT_ID);
        expect(craftableItems(type, tier).map((d) => d.id)).not.toContain(PRESENT_ID);
      }
    }
  });

  it('never stocked: shops, both Rocco shops, bundles, Mystery Items, Merchants and Traders', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = fixtureGame({ seed });
      // A Present used up or lost isn't logged for Rocco, even when someone tries.
      noteGone(s, PRESENT_ID);
      expect(s.usedOrLost?.[PRESENT_ID]).toBeUndefined();
      s.usedOrLost = { [PRESENT_ID]: 3, coffee: 1 };
      expect(fromUsedOrLost(s, 6)).toEqual(['coffee']);
      for (let i = 0; i < STATION_THEMES.length; i++) {
        const v = openStation(s);
        const ids = [
          ...v.items.map((o) => o.item.itemId),
          ...v.bundles.flatMap((b) => (b.item ? [b.item.itemId] : [])),
        ];
        expect(ids, v.themeId).not.toContain(PRESENT_ID);
      }
      for (const feature of ['merchant', 'trader'] as const) {
        const tile = { ...s.section.tiles.L!, feature };
        delete tile.shop;
        rollTrailShop(s, tile);
        const shop = tile.shop!;
        const ids =
          shop.kind === 'trader'
            ? [shop.item.itemId]
            : shop.offers.flatMap((o) => ('item' in o && o.item ? [o.item.itemId] : []));
        expect(ids).not.toContain(PRESENT_ID);
      }
    }
  });

  it('not in the starting resources or the scavenge item cards', () => {
    const s = fixtureGame({ seed: 9 });
    for (const h of s.hikers)
      expect(h.inventory.bag.map((i) => i.itemId)).not.toContain(PRESENT_ID);
  });

  it('stations won’t buy one', () => {
    let s = present(party(), 'birch').s;
    const uid = presentsOf(s, 'birch')[0]!.uid;
    s = run(s, { type: 'debug', op: { kind: 'openStation' } });
    expect(validateAction(s, { type: 'sell', hikerId: 'birch', itemUid: uid })).toBe(
      'The station doesn’t buy Presents.',
    );
  });
});

describe('opening a Present', () => {
  it('costs the hiker’s action and 1 Energy, and puts a random item in their pack', () => {
    const { s, uid } = present(party(), 'birch');
    const before = hiker(s, 'birch').stats.energy;
    const after = run(s, { type: 'openPresent', hikerId: 'birch', itemUid: uid });
    const b = hiker(after, 'birch');
    expect(b.acted).toBe(true);
    expect(b.stats.energy).toBe(before - P.openEnergy);
    expect(presentsOf(after, 'birch')).toHaveLength(0);
    expect(b.inventory.bag).toHaveLength(1);
    expect(ITEMS[b.inventory.bag[0]!.itemId]?.type).not.toBe('present');
    expect(after.lastPresentDay).toBe(after.day);
  });

  it('not without an action, or without Energy', () => {
    const { s, uid } = present(party(), 'birch');
    const open: Action = { type: 'openPresent', hikerId: 'birch', itemUid: uid };
    const acted = structuredClone(s);
    hiker(acted, 'birch').acted = true;
    expect(validateAction(acted, open)).toBe('Birch has already acted this morning.');
    const tired = structuredClone(s);
    hiker(tired, 'birch').stats.energy = 0;
    // At 0 Energy a hiker is Exhausted, which says so first.
    expect(validateAction(tired, open)).toMatch(/Exhausted/);
  });

  /** The tiers of many Presents of a grade, opened in the Meadow (a Tier 1 biome). */
  const tiers = (grade: PresentGrade) => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 150; seed++) {
      const s = party({}, seed);
      expect(s.section.tier).toBe(1);
      seen.add(ITEMS[rollPresentItem(s, hiker(s, 'birch'), grade).itemId]!.tier);
    }
    return seen;
  };

  it('a plain one holds Tier 1, 2 or 3, whatever the biome’s tier', () => {
    expect([...tiers('plain')].sort()).toEqual([1, 2, 3]);
  });

  it('a Tier 2+ one never holds Tier 1; a Tier 3 one always holds Tier 3', () => {
    expect([...tiers('tier2plus')].sort()).toEqual([2, 3]);
    expect([...tiers('tier3')]).toEqual([3]);
  });

  it('its item’s Quality rolls on the plain curve, like a found item', () => {
    const qualities = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = party({}, seed);
      const item = rollPresentItem(s, hiker(s, 'birch'), 'tier3');
      if (item.quality) qualities.add(item.quality);
    }
    expect(qualities.size).toBeGreaterThan(2);
  });
});

describe('Toy Maker and Treat Sniffer', () => {
  /** How many of 400 Tier 3 Presents held this item type, for a hiker with these traits. */
  const share = (traits: string[], type: string) => {
    let n = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const s = party({ birch: traits }, seed);
      if (ITEMS[rollPresentItem(s, hiker(s, 'birch'), 'tier3').itemId]?.type === type) n += 1;
    }
    return n;
  };

  it('Toy Maker: Tools much more often', () => {
    expect(share(['toyMaker'], 'tool')).toBeGreaterThan(share([], 'tool') * 1.6);
  });

  it('Treat Sniffer: Food much more often', () => {
    expect(share(['treatSniffer'], 'food')).toBeGreaterThan(share([], 'food') * 1.6);
  });
});

describe('Choosy', () => {
  it('shows 3 items of the Present’s grade and keeps the one picked', () => {
    const made = present(party({ birch: ['choosy'] }), 'birch', 'tier3');
    let s = made.s;
    const uid = made.uid;
    s = run(s, { type: 'openPresent', hikerId: 'birch', itemUid: uid });
    const pick = s.presentPick!;
    expect(pick.options).toHaveLength(T.choosy.choices);
    expect(pick.options.every((o) => ITEMS[o.itemId]?.tier === 3)).toBe(true);
    // Everything else waits for the pick.
    expect(validateAction(s, END)).toBe('Pick an item from the Present first.');
    const chosen = pick.options[1]!;
    s = run(s, { type: 'presentTake', index: 1 });
    expect(s.presentPick).toBeUndefined();
    expect(hiker(s, 'birch').inventory.bag.map((i) => i.uid)).toEqual([chosen.uid]);
  });
});

describe('Two Sizes Too Small', () => {
  it('she can’t give or trade items, but can give resources and receive items', () => {
    const made = present(party({ birch: ['twoSizesTooSmall'] }), 'birch');
    let s = made.s;
    const uid = made.uid;
    expect(validateAction(s, { type: 'give', fromId: 'birch', toId: 'cedar', itemUid: uid })).toBe(
      'The Grinch doesn’t share.',
    );
    s = give(s, 'birch', { wood: 1 });
    expect(
      validateAction(s, { type: 'give', fromId: 'birch', toId: 'cedar', resource: 'wood' }),
    ).toBeNull();
    const gift = present(s, 'cedar');
    expect(
      validateAction(gift.s, { type: 'give', fromId: 'cedar', toId: 'birch', itemUid: gift.uid }),
    ).toBeNull();
    // She can still drop it.
    expect(validateAction(s, { type: 'dropItem', hikerId: 'birch', itemUid: uid })).toBeNull();
  });
});

describe('the usable holiday traits', () => {
  it('Down the Chimney: a Present to any hiker on the map, once per day', () => {
    const made = present(party(), 'grammy');
    let s = made.s;
    const uid = made.uid;
    place(s, 'birch', 'C');
    const choices = abilitiesFor(s, hiker(s, 'grammy')).find(
      (a) => a.ability.id === 'downTheChimney',
    )?.choices;
    expect(choices?.map((c) => c.label)).toContain('Present to Birch');
    const use = (choice: string): Action => ({
      type: 'useAbility',
      hikerId: 'grammy',
      abilityId: 'downTheChimney',
      choice,
    });
    s = run(s, use(`${uid}>birch`));
    expect(presentsOf(s, 'birch').map((p) => p.uid)).toEqual([uid]);
    const second = present(s, 'grammy');
    expect(validateAction(second.s, use(`${second.uid}>cedar`))).toBe(
      'Down the Chimney is used up today.',
    );
  });

  it('Spare Parts: a Present for 2 resources of her choice', () => {
    const made = present(party({ birch: ['spareParts'] }), 'birch');
    let s = made.s;
    const uid = made.uid;
    const use = (choice: string): Action => ({
      type: 'useAbility',
      hikerId: 'birch',
      abilityId: 'spareParts',
      choice,
    });
    expect(validateAction(s, use(`${uid}|wood`))).toBe('Pick 2 resources.');
    s = run(s, use(`${uid}|salt,salt`));
    expect(hiker(s, 'birch').inventory.resources).toEqual({ salt: T.spareParts.resources });
    expect(presentsOf(s, 'birch')).toHaveLength(0);
    // No limit: another one right away.
    const again = present(s, 'birch');
    expect(validateAction(again.s, use(`${again.uid}|wood,fish`))).toBeNull();
  });

  it('Present Muncher: eats a Present for 0–5 Appetite, never past the maximum', () => {
    const gains = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const made = present(party({ birch: ['presentMuncher'] }, seed), 'birch');
      let s = made.s;
      const uid = made.uid;
      hiker(s, 'birch').stats.appetite = 2;
      s = run(s, {
        type: 'useAbility',
        hikerId: 'birch',
        abilityId: 'presentMuncher',
        choice: uid,
      });
      gains.add(hiker(s, 'birch').stats.appetite - 2);
      expect(presentsOf(s, 'birch')).toHaveLength(0);
    }
    expect(Math.min(...gains)).toBeGreaterThanOrEqual(T.presentMuncher.min);
    expect(Math.max(...gains)).toBeLessThanOrEqual(T.presentMuncher.max);
    expect(gains.size).toBeGreaterThan(3);
    const made = present(party({ birch: ['presentMuncher'] }, 3), 'birch');
    let s = made.s;
    const uid = made.uid;
    hiker(s, 'birch').stats.appetite = 9;
    s = run(s, { type: 'useAbility', hikerId: 'birch', abilityId: 'presentMuncher', choice: uid });
    expect(hiker(s, 'birch').stats.appetite).toBeLessThanOrEqual(BALANCE.stats.max);
  });

  it('Wreck the Halls: smashes a Present for 3–8 Morale, capped at her maximum', () => {
    const gains = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const made = present(party({ birch: ['wreckTheHalls'] }, seed), 'birch', 'tier3');
      let s = made.s;
      const uid = made.uid;
      hiker(s, 'birch').stats.morale = 1;
      s = run(s, { type: 'useAbility', hikerId: 'birch', abilityId: 'wreckTheHalls', choice: uid });
      gains.add(hiker(s, 'birch').stats.morale - 1);
      expect(presentsOf(s, 'birch')).toHaveLength(0);
    }
    expect(Math.min(...gains)).toBeGreaterThanOrEqual(T.wreckTheHalls.min);
    expect(Math.max(...gains)).toBeLessThanOrEqual(T.wreckTheHalls.max);
    const made = present(party({ birch: ['wreckTheHalls'] }), 'birch');
    let s = made.s;
    const uid = made.uid;
    hiker(s, 'birch').stats.morale = 9;
    s = run(s, { type: 'useAbility', hikerId: 'birch', abilityId: 'wreckTheHalls', choice: uid });
    expect(hiker(s, 'birch').stats.morale).toBe(BALANCE.stats.max);
  });
});

describe('the holiday Morale traits', () => {
  it('Holiday Spirit: +1 when a hiker on the tile opens a Present, not elsewhere', () => {
    const made = present(party({ birch: ['holidaySpirit'] }), 'cedar');
    let s = made.s;
    const uid = made.uid;
    s = run(s, { type: 'openPresent', hikerId: 'cedar', itemUid: uid });
    expect(hiker(s, 'birch').stats.morale).toBe(5 + T.holidaySpirit.opened);
    const far = present(s, 'dot');
    place(far.s, 'dot', 'C');
    s = run(far.s, { type: 'openPresent', hikerId: 'dot', itemUid: far.uid });
    expect(hiker(s, 'birch').stats.morale).toBe(5 + T.holidaySpirit.opened);
  });

  it('Holiday Spirit: −1 at the start of a day after nobody opened one', () => {
    const quiet = nextDay(party({ birch: ['holidaySpirit'] }));
    const b = hiker(quiet, 'birch').stats.morale;
    const c = hiker(quiet, 'cedar').stats.morale;
    expect(b - c).toBe(T.holidaySpirit.noneOpened);

    const made = present(party({ birch: ['holidaySpirit'] }), 'dot');
    let s = made.s;
    const uid = made.uid;
    place(s, 'dot', 'C');
    s = nextDay(run(s, { type: 'openPresent', hikerId: 'dot', itemUid: uid }));
    expect(hiker(s, 'birch').stats.morale - hiker(s, 'cedar').stats.morale).toBe(0);
  });

  it('Season of Giving: +1 when someone opens a Present she wrapped', () => {
    let s = give(party(), 'grammy', { wood: 3 });
    s = run(s, wrap('grammy', 'sameResource'));
    const uid = presentsOf(s, 'grammy')[0]!.uid;
    s = run(s, { type: 'give', fromId: 'grammy', toId: 'birch', itemUid: uid });
    const before = hiker(s, 'grammy').stats.morale;
    s = run(s, { type: 'openPresent', hikerId: 'birch', itemUid: uid });
    expect(hiker(s, 'grammy').stats.morale).toBe(before + T.seasonOfGiving.opened);
    // Someone else's Present doesn't count.
    const other = present(s, 'cedar');
    const now = hiker(other.s, 'grammy').stats.morale;
    s = run(other.s, { type: 'openPresent', hikerId: 'cedar', itemUid: other.uid });
    expect(hiker(s, 'grammy').stats.morale).toBe(now);
  });

  it('Season of Giving: −1 at the start of a day after she wrapped none', () => {
    let s = give(party(), 'grammy', { wood: 3 });
    s = nextDay(run(s, wrap('grammy', 'sameResource')));
    expect(hiker(s, 'grammy').stats.morale - hiker(s, 'birch').stats.morale).toBe(0);
    s = nextDay(s);
    expect(hiker(s, 'grammy').stats.morale - hiker(s, 'birch').stats.morale).toBe(
      T.seasonOfGiving.noneWrapped,
    );
  });

  it('Bah Humbug: +1 when she opens a Present, −1 when another hiker here Sits by the Fire', () => {
    const made = present(party({ birch: ['bahHumbug'] }), 'birch');
    let s = made.s;
    const uid = made.uid;
    s = run(s, { type: 'openPresent', hikerId: 'birch', itemUid: uid });
    expect(hiker(s, 'birch').stats.morale).toBe(5 + T.bahHumbug.opened);
    fireSitByFire(s, hiker(s, 'cedar'));
    expect(hiker(s, 'birch').stats.morale).toBe(5 + T.bahHumbug.opened + T.bahHumbug.fire);
    // Her own fire doesn't count.
    fireSitByFire(s, hiker(s, 'birch'));
    expect(hiker(s, 'birch').stats.morale).toBe(5 + T.bahHumbug.opened + T.bahHumbug.fire);
  });
});

describe('Rednose', () => {
  it('moving the group at night: nobody pays the extra night cost', () => {
    const night = (traits: string[]) => {
      let s = party({ birch: traits });
      while (s.phase !== 'night') s = run(s, END);
      return moveAllCost(s, 'birch', 'L', ['cedar', 'dot'])!;
    };
    const plain = night([]);
    const rednose = night(['rednose']);
    const extra = BALANCE.night.moveExtraAppetite;
    expect(rednose[0]!.cost.appetite).toBe(plain[0]!.cost.appetite - extra);
    expect(rednose[1]!.cost.appetite).toBe(plain[1]!.cost.appetite - extra);
    expect(rednose[2]!.cost.appetite).toBe(plain[2]!.cost.appetite - extra);
  });

  it('by day, and moving alone, nothing changes', () => {
    const s = party({ birch: ['rednose'] });
    const p = party();
    expect(moveAllCost(s, 'birch', 'L', ['cedar'])).toEqual(
      moveAllCost(p, 'birch', 'L', ['cedar']),
    );
  });
});

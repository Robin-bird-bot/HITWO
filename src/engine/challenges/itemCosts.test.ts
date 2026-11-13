import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { CARDS } from '../../content/challenges';
import { ITEMS, TIER_3_ITEMS } from '../../content/items';
import { RESOURCES } from '../../content/resources';
import { validateAction } from '../applyAction';
import { makeItem, maxDurabilityOf } from '../items/make';
import { END, fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, ChallengeSection, GameState, Gift, ItemInstance } from '../types';
import { wonderProgress } from '../wonders/wonders';
import { requirementNeed } from './resolve';

/** Ash and Birch on L, with a card of our choosing open there. */
function opened(cardId: string, setup: (s: GameState) => void = () => {}, seed = 3): GameState {
  const s = fixtureGame({ seed, challenges: true });
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  setup(s);
  return run(s, { type: 'debug', op: { kind: 'openChallenge', cardId, tileId: 'L' } });
}

const resolve = (...sections: ChallengeSection[]): Action => ({
  type: 'resolveChallenge',
  sections,
});

/** Puts clothes on a hiker (Quality 3); returns the item. */
function wear(s: GameState, id: string, itemId: string): ItemInstance {
  const item = makeItem(s, itemId, { quality: 3 });
  hiker(s, id).inventory.equipped[ITEMS[itemId]!.slot!] = item;
  return item;
}

function bagTool(s: GameState, id: string, itemId: string): ItemInstance {
  const item = makeItem(s, itemId, { quality: 3 });
  hiker(s, id).inventory.bag.push(item);
  return item;
}

const dur = (from: string, uid: string, count: number, req = 0): Gift => ({
  kind: 'durability',
  req,
  from,
  uid,
  count,
});

describe('paying with clothing durability', () => {
  it('Sharp Wind: 2 durability from what the hiker wears', () => {
    let shirt: ItemInstance | undefined;
    let s = opened('sharp-wind', (g) => {
      shirt = wear(g, 'ash', 'plainShirt');
      wear(g, 'birch', 'flannel');
    });
    const birchFlannel = hiker(s, 'birch').inventory.equipped.body!;
    const before = shirt!.durability!;
    s = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, option: 0, gifts: [dur('ash', shirt!.uid, 2)] },
        { hikerId: 'birch', pay: true, option: 0, gifts: [dur('birch', birchFlannel.uid, 2)] },
      ),
    );
    expect(hiker(s, 'ash').inventory.equipped.body?.durability).toBe(before - 2);
    expect(s.log.find((e) => e.kind === 'challenge')).toMatchObject({
      results: [{ passed: true, paid: { durability: 2 } }, { passed: true }],
    });
  });

  it('only the wearer’s own clothes, and no more than is left', () => {
    let shirt: ItemInstance | undefined;
    const s = opened('sharp-wind', (g) => {
      shirt = wear(g, 'ash', 'plainShirt');
    });
    shirt = hiker(s, 'ash').inventory.equipped.body!;
    expect(
      validateAction(
        s,
        resolve(
          { hikerId: 'ash', pay: false, gifts: [] },
          { hikerId: 'birch', pay: true, option: 0, gifts: [dur('ash', shirt.uid, 2)] },
        ),
      ),
    ).toBe('Something handed in doesn’t fit that space.');
    shirt.durability = 1;
    expect(
      validateAction(
        s,
        resolve(
          { hikerId: 'ash', pay: true, option: 0, gifts: [dur('ash', shirt.uid, 2)] },
          { hikerId: 'birch', pay: false, gifts: [] },
        ),
      ),
    ).toBe('That clothing item doesn’t have 2 durability left.');
  });

  it('an Umbrella doesn’t take a payment: it comes off the item named', () => {
    let shirt: ItemInstance | undefined;
    let s = opened('sharp-wind', (g) => {
      shirt = wear(g, 'ash', 'plainShirt');
      wear(g, 'ash', 'umbrella');
    });
    shirt = hiker(s, 'ash').inventory.equipped.body!;
    const umbrella = hiker(s, 'ash').inventory.equipped.gear!.durability;
    const before = shirt.durability!;
    s = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, option: 0, gifts: [dur('ash', shirt.uid, 2)] },
        { hikerId: 'birch', pay: false, gifts: [] },
      ),
    );
    expect(hiker(s, 'ash').inventory.equipped.body?.durability).toBe(before - 2);
    expect(hiker(s, 'ash').inventory.equipped.gear?.durability).toBe(umbrella);
  });
});

describe('paying with tool uses', () => {
  it('Sticky Sap: 1 use from a tool', () => {
    let s = opened('sticky-sap');
    const shovel = bagTool(s, 'ash', 'shovel');
    const uses = shovel.usesLeft!;
    const use: Gift = { kind: 'toolUse', req: 0, from: 'ash', uid: shovel.uid, count: 1 };
    s = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, option: 0, gifts: [use] },
        { hikerId: 'birch', pay: false, gifts: [] },
      ),
    );
    expect(hiker(s, 'ash').inventory.bag[0]?.usesLeft).toBe(uses - 1);
  });
});

describe('cards that were waiting on items', () => {
  it('Fashion Critic: 1 cap for every 2 durability left, rounded up; failing can cost clothes', () => {
    const s = opened('fashion-critic', (g) => {
      const shirt = wear(g, 'ash', 'plainShirt');
      shirt.durability = 5;
    });
    const card = s.challenge!;
    const req = { kind: 'caps' as const, count: { base: 1, per: 'halfWornDurability' as const } };
    expect(requirementNeed(s, card, req, 'ash')).toBe(3);
    let lost = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let t = opened(
        'fashion-critic',
        (g) => {
          wear(g, 'ash', 'plainShirt').durability = 5;
        },
        seed,
      );
      t = run(t, resolve({ hikerId: 'ash', pay: false, gifts: [] }));
      if (!hiker(t, 'ash').inventory.equipped.body) lost += 1;
    }
    expect(lost).toBeGreaterThan(4); // 50% at 5 durability left
    expect(lost).toBeLessThan(17);
  });

  it('Hypothermia: each durability spent lowers the chance', () => {
    const s = opened('hypothermia', (g) => {
      g.snowy = true;
      wear(g, 'ash', 'plainShirt');
    });
    const shirt = hiker(s, 'ash').inventory.equipped.body!;
    expect(
      validateAction(
        s,
        resolve(
          { hikerId: 'ash', pay: true, gifts: [dur('ash', shirt.uid, 3)] },
          { hikerId: 'birch', pay: true, gifts: [] },
        ),
      ),
    ).toBeNull();
  });

  it('Old Trail Sign: each tool use shows a card on a tile nobody has reached', () => {
    let s = opened('old-trail-sign');
    const scanner = bagTool(s, 'ash', 'scanner');
    const use: Gift = { kind: 'toolUse', req: 0, from: 'ash', uid: scanner.uid, count: 2 };
    s = run(
      s,
      resolve(
        { hikerId: 'ash', pay: true, gifts: [use] },
        { hikerId: 'birch', pay: true, gifts: [] },
      ),
    );
    const shown = Object.values(s.section.tiles).filter(
      (t) => t.revealedCard && !t.revealedCard.hidden,
    );
    expect(shown.length).toBe(2);
    expect(hiker(s, 'ash').inventory.bag[0]?.usesLeft).toBe(scanner.usesLeft! - 2);
  });

  it('Abandoned Ranger Station: now and then a blueprint', () => {
    let found = 0;
    for (let seed = 1; seed <= 30; seed++) {
      let s = opened('abandoned-ranger-station', () => {}, seed);
      const energy: Gift = { kind: 'stat', req: 0, from: 'ash', stat: 'energy', count: 6 };
      s = run(
        s,
        resolve(
          { hikerId: 'ash', pay: true, gifts: [energy] },
          { hikerId: 'birch', pay: true, gifts: [] },
        ),
      );
      if (s.log.some((e) => e.kind === 'blueprintFound')) {
        found += 1;
        expect(hiker(s, 'ash').blueprints?.length).toBeGreaterThan(0);
      }
    }
    expect(found).toBeGreaterThan(3);
  });
});

describe('Trials that were waiting on items', () => {
  function started(cardId: string): GameState {
    const s = opened(cardId, () => {}, 4);
    return run(s, { type: 'acceptTrial' });
  }

  it('Mold Invasion: whoever eats on its tile gets Food Poisoning', () => {
    let s = started('mold-invasion');
    const bite = makeItem(s, 'pelmeni', { quality: 3 });
    hiker(s, 'ash').inventory.bag.push(bite);
    s = run(s, { type: 'eat', hikerId: 'ash', itemUid: bite.uid });
    expect(hiker(s, 'ash').conditions.some((c) => c.id === 'foodPoisoning')).toBe(true);
    expect(hiker(s, 'birch').conditions.some((c) => c.id === 'foodPoisoning')).toBe(false);
  });

  it('Rocco’s Rebuilding Trial: crafting the type it picked earns his rewards', () => {
    let s = started('rocco-raccoons-rebuilding-trial');
    const type = s.trials?.[0]?.itemType;
    expect(type).toBeDefined();
    // Two of every resource, so any type's recipe can be paid.
    hiker(s, 'ash').inventory.resources = Object.fromEntries(RESOURCES.map((r) => [r.id, 2]));
    s = run(s, { type: 'craft', hikerId: 'ash', itemType: type! });
    if (s.crafting) s = run(s, { type: 'craftTake', index: 0 });
    expect(s.trials?.[0]?.done ?? []).toContain('ash');
  });

  it('Bear Country: crafting on its tile starts a Tier II Wildlife challenge there', () => {
    let s = started('bear-country');
    hiker(s, 'ash').inventory.resources = Object.fromEntries(RESOURCES.map((r) => [r.id, 2]));
    s = run(s, { type: 'craft', hikerId: 'ash', itemType: 'tool' });
    if (s.crafting) s = run(s, { type: 'craftTake', index: 0 });
    expect(s.trials).toBeUndefined();
    expect(s.log.findLast((e) => e.kind === 'trial')).toMatchObject({
      outcome: 'failed',
      hikerIds: ['ash'],
    });
    expect(s.challenge).toMatchObject({ tileId: 'L', tier: 2 });
    expect(CARDS[s.challenge!.cardId]?.nodes).toContain('wildlife');
    expect(s.challenge?.hikerIds.sort()).toEqual(['ash', 'birch']);
  });

  it('Bear Country: nobody crafts there by morning, and it passes', () => {
    let s = started('bear-country');
    for (let i = 0; i < 3 && s.trials; i++) s = run(s, END);
    expect(s.trials).toBeUndefined();
    expect(s.log.findLast((e) => e.kind === 'trial')).toMatchObject({ outcome: 'passed' });
  });
});

describe('Wonders that were waiting on items', () => {
  function onM(s: GameState) {
    for (const id of ['ash', 'birch', 'cedar', 'dot']) place(s, id, 'M');
    s.section.tiles.M!.nodes = [];
  }
  const goal = (s: GameState, id: string, index: number, x: number) => {
    s.section.tiles.M!.wonder = { id, decoys: 2, goals: [{ index, x }], tier3: [] };
    return wonderProgress(s, 'M')!.goals[0]!.met;
  };

  it('Fort Rock: clothing durability between the hikers here', () => {
    const s = fixtureGame();
    onM(s);
    expect(goal(s, 'fort-rock', 4, 10)).toBe(false);
    wear(s, 'ash', 'plainShirt'); // 7
    wear(s, 'birch', 'plainShirt'); // 7
    expect(goal(s, 'fort-rock', 4, 10)).toBe(true);
  });

  it('Pittock Mansion: one hiker with 3 clothing items on; Multnomah Falls: 3 crafted of a type', () => {
    const s = fixtureGame();
    onM(s);
    wear(s, 'ash', 'plainShirt');
    wear(s, 'ash', 'glasses');
    expect(goal(s, 'pittock-mansion', 0, 3)).toBe(false);
    wear(s, 'ash', 'joggingShoes');
    expect(goal(s, 'pittock-mansion', 0, 3)).toBe(true);
    s.counters.crafted.ash = { tool: 2 };
    expect(goal(s, 'multnomah-falls', 0, 3)).toBe(false);
    s.counters.crafted.ash = { tool: 3 };
    expect(goal(s, 'multnomah-falls', 0, 3)).toBe(true);
  });

  it('Fort Rock’s reward doubles a worn item’s durability, now and full', () => {
    let s = fixtureGame();
    onM(s);
    s.counters.sheltersPlaced[0] = 3;
    const shirt = wear(s, 'birch', 'plainShirt');
    shirt.durability = 4;
    const full = maxDurabilityOf(shirt);
    s.section.tiles.M!.wonder = {
      id: 'fort-rock',
      decoys: 2,
      goals: [{ index: 1, x: 3 }],
      tier3: [],
    };
    s = run(s, {
      type: 'accomplishWonder',
      tileId: 'M',
      picks: { ash: { reward: 2 }, birch: { reward: 1 }, cedar: { reward: 2 }, dot: { reward: 2 } },
    });
    const after = hiker(s, 'birch').inventory.equipped.body!;
    expect(after.durability).toBe(8);
    expect(after.maxDurability).toBe(full * 2);
  });

  it('Tier III rewards are real Tier III items', () => {
    expect(TIER_3_ITEMS.length).toBeGreaterThan(10);
    for (const id of TIER_3_ITEMS) {
      expect(ITEMS[id]?.tier).toBe(3);
      expect(ITEMS[id]?.placeholder).toBeFalsy();
    }
    expect(BALANCE.items.craft.blueprintFind).toBeGreaterThan(0);
  });
});

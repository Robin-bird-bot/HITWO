import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { ITEMS } from '../../content/items';
import { validateAction } from '../applyAction';
import { addCondition } from '../conditions';
import { deserialize, serialize } from '../save';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, GameState, ItemTypeName, PaidSlot, ResourceId } from '../types';
import { autoPay, basicRecipe, craftSetup, paymentReason } from './craft';
import { freeMoveFor } from './freeMoves';
import { makeItem, fullDurability } from './make';
import { placeShelterOn } from './shelters';

const give = (s: GameState, id: string, res: Partial<Record<ResourceId, number>>) => {
  hiker(s, id).inventory.resources = { ...res };
};

const craft = (hikerId: string, itemType: ItemTypeName, extra: Partial<Action> = {}): Action =>
  ({ type: 'craft', hikerId, itemType, ...extra }) as Action;

/** Ash with what a Tier 1 tool needs: 2 Wood, then Stone and Moss. */
function toolReady(seed = 1): GameState {
  const s = fixtureGame({ seed });
  give(s, 'ash', { wood: 2, stone: 2, moss: 1 });
  return s;
}

describe('recipes', () => {
  it('a basic recipe grows with the tier', () => {
    const s = fixtureGame();
    expect(basicRecipe(s, 'tool', 1)).toEqual([
      { n: 2, ids: ['metal', 'wood'] },
      { n: 3, nodes: ['mountain', 'forest'] },
    ]);
    expect(basicRecipe(s, 'tool', 2).map((p) => p.n)).toEqual([3, 4]);
    expect(basicRecipe(s, 'tool', 3).map((p) => p.n)).toEqual([4, 5]);
    expect(basicRecipe(s, 'shelter', 1)).toEqual([
      { n: 3, ids: ['wood', 'stone'] },
      { n: 3, any: true },
    ]);
  });

  it('trinkets: 5 different resources from the seed, a new set after each trinket', () => {
    const s = fixtureGame({ seed: 4 });
    const first = basicRecipe(s, 'trinket', 1).map((p) => p.ids?.[0]);
    expect(first).toHaveLength(5);
    expect(new Set(first).size).toBe(5);
    expect(basicRecipe(fixtureGame({ seed: 4 }), 'trinket', 1).map((p) => p.ids?.[0])).toEqual(
      first,
    );
    expect(basicRecipe(s, 'trinket', 2)).toHaveLength(6);

    let t = fixtureGame({ seed: 4 });
    give(t, 'ash', Object.fromEntries(first.map((id) => [id, 1])));
    t = run(t, craft('ash', 'trinket'), { type: 'craftTake', index: 0 });
    expect(basicRecipe(t, 'trinket', 1).map((p) => p.ids?.[0])).not.toEqual(first);
  });
});

describe('paying', () => {
  it('fills from the crafter first, then the others on the tile; the key is all one resource', () => {
    const s = fixtureGame();
    give(s, 'ash', { wood: 2, moss: 1 });
    give(s, 'birch', { metal: 3, stone: 2 });
    const slots = autoPay(s, hiker(s, 'ash'), basicRecipe(s, 'tool', 1));
    expect(slots).toEqual([
      { from: 'ash', resource: 'wood' },
      { from: 'ash', resource: 'wood' },
      { from: 'ash', resource: 'moss' },
      { from: 'birch', resource: 'metal' },
      { from: 'birch', resource: 'metal' },
    ]);
  });

  it('leaves a space empty when nothing fits, and says how many more', () => {
    const s = fixtureGame();
    give(s, 'ash', { wood: 2 });
    for (const id of ['birch', 'cedar', 'dot']) give(s, id, {});
    const recipe = basicRecipe(s, 'tool', 1);
    const slots = autoPay(s, hiker(s, 'ash'), recipe);
    expect(slots.filter((x) => !x)).toHaveLength(3);
    expect(paymentReason(s, hiker(s, 'ash'), recipe, slots)).toBe(
      'Needs 3 more resources on this tile.',
    );
  });

  it('refuses a mixed key, more than a hiker has, and hikers on another tile', () => {
    const s = fixtureGame();
    give(s, 'ash', { wood: 1, metal: 1, stone: 3 });
    give(s, 'birch', { stone: 1 });
    const recipe = basicRecipe(s, 'tool', 1);
    const slot = (from: string, resource: ResourceId): PaidSlot => ({ from, resource });
    const stones = [slot('ash', 'stone'), slot('ash', 'stone'), slot('ash', 'stone')];
    expect(
      paymentReason(s, hiker(s, 'ash'), recipe, [
        slot('ash', 'wood'),
        slot('ash', 'metal'),
        ...stones,
      ]),
    ).toBe('The key resource has to be all the same one.');
    expect(
      paymentReason(s, hiker(s, 'ash'), recipe, [
        slot('ash', 'wood'),
        slot('ash', 'wood'),
        ...stones,
      ]),
    ).toBe('Ash doesn’t have that many.');
    // Birch gives from another tile.
    give(s, 'ash', { wood: 2, stone: 2 });
    place(s, 'birch', 'L');
    expect(
      paymentReason(s, hiker(s, 'ash'), recipe, [
        slot('ash', 'wood'),
        slot('ash', 'wood'),
        slot('ash', 'stone'),
        slot('ash', 'stone'),
        slot('birch', 'stone'),
      ]),
    ).toBe('Only hikers on this tile can chip in.');
  });
});

describe('a basic craft', () => {
  it('uses the action, pays, and deals 3 tools to pick from', () => {
    const s = run(toolReady(), craft('ash', 'tool'));
    expect(hiker(s, 'ash').acted).toBe(true);
    expect(hiker(s, 'ash').inventory.resources).toEqual({});
    expect(s.crafting?.options).toHaveLength(BALANCE.items.craft.choices);
    for (const o of s.crafting?.options ?? []) {
      expect(ITEMS[o.itemId]?.type).toBe('tool');
      expect(o.quality).toBeGreaterThanOrEqual(1);
    }
    expect(validateAction(s, { type: 'endPhase' })).toBe(
      'Finish crafting first: pick one of the cards.',
    );
  });

  it('taking one puts it in the bag and teaches its blueprint', () => {
    let s = run(toolReady(), craft('ash', 'tool'));
    const option = s.crafting?.options[1];
    s = run(s, { type: 'craftTake', index: 1 });
    expect(s.crafting).toBeUndefined();
    expect(hiker(s, 'ash').inventory.bag[0]).toMatchObject({
      itemId: option?.itemId,
      quality: option?.quality,
    });
    expect(hiker(s, 'ash').blueprints).toEqual([option?.itemId]);
    expect(s.counters.crafted.ash).toEqual({ tool: 1 });
    expect(s.log.at(-1)).toMatchObject({ kind: 'crafted', learned: true, blueprint: false });
  });

  it('now and then a card is a tier higher; never "Not crafted" items', () => {
    let higher = 0;
    let cards = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = run(toolReady(seed), craft('ash', 'tool'));
      for (const o of s.crafting?.options ?? []) {
        cards += 1;
        if ((ITEMS[o.itemId]?.tier ?? 1) > 1) higher += 1;
        expect(ITEMS[o.itemId]?.notCrafted).toBeFalsy();
      }
    }
    expect(higher / cards).toBeGreaterThan(0.03);
    expect(higher / cards).toBeLessThan(0.2);
  });

  it('needs room in the bag, and Inept hikers can’t craft', () => {
    const s = toolReady();
    hiker(s, 'ash').inventory.bag = Array.from({ length: 4 }, () => makeItem(s, 'pelmeni'));
    expect(validateAction(s, craft('ash', 'tool'))).toBe(
      'Ash’s bag is full. Make room for what they craft first.',
    );
    const t = toolReady();
    addCondition(t, hiker(t, 'ash'), 'inept', 1, 'days', 'test');
    expect(validateAction(t, craft('ash', 'tool'))).toBe('Ash is Inept and can’t craft.');
  });
});

describe('blueprints', () => {
  it('a known blueprint makes exactly that item, no pick', () => {
    let s = fixtureGame();
    give(s, 'ash', { metal: 2, wood: 2, stone: 2 });
    expect(validateAction(s, craft('ash', 'tool', { blueprint: 'shovel' }))).toBe(
      'Ash doesn’t know that blueprint.',
    );
    s = run(s, { type: 'debug', op: { kind: 'learnBlueprint', hikerId: 'ash', itemId: 'shovel' } });
    s = run(s, craft('ash', 'tool', { blueprint: 'shovel' }));
    expect(s.crafting).toBeUndefined();
    expect(hiker(s, 'ash').inventory.bag[0]?.itemId).toBe('shovel');
    expect(s.log.at(-1)).toMatchObject({ kind: 'crafted', blueprint: true });
  });

  it('only up to the crafter’s tier for that type', () => {
    let s = fixtureGame();
    give(s, 'ash', { metal: 3, flint: 1, bones: 1, oil: 1, wood: 1, stone: 2 });
    s = run(s, {
      type: 'debug',
      op: { kind: 'learnBlueprint', hikerId: 'ash', itemId: 'swissArmyKnife' },
    });
    expect(validateAction(s, craft('ash', 'tool', { blueprint: 'swissArmyKnife' }))).toContain(
      'needs Tier III',
    );
    s = run(s, {
      type: 'debug',
      op: { kind: 'setCraftTier', hikerId: 'ash', itemType: 'tool', tier: 3 },
    });
    expect(validateAction(s, craft('ash', 'tool', { blueprint: 'swissArmyKnife' }))).toBeNull();
  });

  it('Birkenstocks: the crafter picks their node', () => {
    let s = fixtureGame();
    give(s, 'ash', { wood: 2, fur: 1, moss: 3 });
    s = run(s, {
      type: 'debug',
      op: { kind: 'learnBlueprint', hikerId: 'ash', itemId: 'birkenstocks' },
    });
    expect(validateAction(s, craft('ash', 'clothes', { blueprint: 'birkenstocks' }))).toBe(
      'Pick a node for the Birkenstocks.',
    );
    s = run(s, craft('ash', 'clothes', { blueprint: 'birkenstocks', node: 'river' }));
    expect(hiker(s, 'ash').inventory.bag[0]?.node).toBe('river');
  });
});

describe('what changes a craft', () => {
  it('Luck from Morale, Lucky and being a Dog; Tunnel Vision deals fewer cards', () => {
    const s = fixtureGame();
    const ash = hiker(s, 'ash');
    const base = craftSetup(s, ash, 'tool').luck; // Morale 10
    addCondition(s, ash, 'lucky', 1, 'days', 'test');
    expect(craftSetup(s, ash, 'tool').luck).toBe(base + 1);
    ash.family = 'dog';
    expect(craftSetup(s, ash, 'tool').luck).toBe(base + 1 + BALANCE.items.craft.dogLuck);
    addCondition(s, ash, 'tunnelVision', 1, 'days', 'test');
    expect(craftSetup(s, ash, 'tool').cards).toBe(BALANCE.items.craft.choices - 1);
  });

  it('a Tailgate adds Quality to food crafted on its tile; a Lodge to tools and clothes', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    placeShelterOn(s, 'L', 'tailgate');
    expect(craftSetup(s, hiker(s, 'ash'), 'food').quality).toBe(1);
    expect(craftSetup(s, hiker(s, 'ash'), 'tool').quality).toBe(0);
    placeShelterOn(s, 'L', 'lodge');
    expect(craftSetup(s, hiker(s, 'ash'), 'tool').quality).toBe(1);
  });

  it('Engineering Vest: crafted clothes last longer', () => {
    let s = fixtureGame();
    give(s, 'ash', { moss: 3, fur: 1, metal: 1, oil: 1 });
    hiker(s, 'ash').inventory.equipped.body = makeItem(s, 'engineeringVest', { quality: 3 });
    s = run(s, {
      type: 'debug',
      op: { kind: 'learnBlueprint', hikerId: 'ash', itemId: 'plainShirt' },
    });
    s = run(s, craft('ash', 'clothes', { blueprint: 'plainShirt' }));
    const shirt = hiker(s, 'ash').inventory.bag[0];
    expect(shirt?.durability).toBe(fullDurability(ITEMS.plainShirt!, shirt?.quality) + 1);
  });

  it('Work Boots: a free move after crafting', () => {
    let s = toolReady();
    hiker(s, 'ash').inventory.equipped.feet = makeItem(s, 'workBoots', { quality: 3 });
    s = run(s, craft('ash', 'tool'), { type: 'craftTake', index: 0 });
    expect(freeMoveFor(s, hiker(s, 'ash'))).toMatchObject({ itemId: 'workBoots', discount: 1 });
    expect(validateAction(s, { type: 'move', hikerId: 'ash', toTileId: 'L' })).toBeNull();
  });
});

describe('teaching', () => {
  function taught(): GameState {
    const s = fixtureGame();
    hiker(s, 'ash').blueprints = ['shovel', 'wheelbarrow'];
    return s;
  }

  it('costs the teacher 4, 6 or 8 Morale by tier', () => {
    let s = taught();
    s = run(s, { type: 'teach', hikerId: 'ash', toId: 'birch', itemId: 'shovel' });
    expect(hiker(s, 'birch').blueprints).toEqual(['shovel']);
    expect(hiker(s, 'ash').stats.morale).toBe(6);
    expect(hiker(s, 'ash').acted).toBe(false);
    s = run(s, { type: 'teach', hikerId: 'ash', toId: 'cedar', itemId: 'wheelbarrow' });
    expect(hiker(s, 'ash').stats.morale).toBe(0);
  });

  it('refuses a hiker who knows it, one on another tile, and a teacher without the Morale', () => {
    let s = taught();
    s = run(s, { type: 'teach', hikerId: 'ash', toId: 'birch', itemId: 'shovel' });
    expect(
      validateAction(s, { type: 'teach', hikerId: 'ash', toId: 'birch', itemId: 'shovel' }),
    ).toBe('Birch already knows the Shovel.');
    place(s, 'cedar', 'L');
    expect(
      validateAction(s, { type: 'teach', hikerId: 'ash', toId: 'cedar', itemId: 'shovel' }),
    ).toBe('Cedar isn’t on this tile.');
    hiker(s, 'ash').stats.morale = 5;
    expect(
      validateAction(s, { type: 'teach', hikerId: 'ash', toId: 'dot', itemId: 'wheelbarrow' }),
    ).toBe('Ash needs 6 Morale to teach the Wheelbarrow.');
  });
});

describe('saves', () => {
  it('an open craft survives a save and load', () => {
    const s = run(toolReady(), craft('ash', 'tool'));
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state).toEqual(s);
  });
});

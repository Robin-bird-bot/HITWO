import { describe, expect, it } from 'vitest';
import { validateAction } from '../applyAction';
import { addCondition, hasCondition } from '../conditions';
import { makeItem, fullDurability } from './make';
import type { Quality } from './quality';
import { safeFrom } from '../night/nightEvents';
import { scavengeSetup } from '../scavenge/setup';
import { addInjury, changeStat } from '../stats';
import { ITEMS } from '../../content/items';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { Action, GameState } from '../types';

/** Puts a tool in a hiker's bag at a Quality; returns its uid. */
function tool(s: GameState, id: string, itemId: string, quality: Quality = 3): string {
  const item = makeItem(s, itemId, { quality });
  hiker(s, id).inventory.bag.push(item);
  return item.uid;
}

const use = (
  hikerId: string,
  itemUid: string,
  targetId = hikerId,
  extra: { conditionId?: string; choice?: string } = {},
): Action => ({ type: 'useItem', hikerId, itemUid, targetId, ...extra });

const SCAVENGE = (hikerId: string): Action => ({ type: 'scavenge', hikerId });

/** Takes card i of the open scavenge, picking Wood or the first item when it asks. */
function takeAny(s: GameState, i: number): Action {
  const c = s.scavenge?.cards[i];
  return {
    type: 'scavengeTake',
    card: i,
    ...(c?.pick ? { picks: Array.from({ length: c.pick.count }, () => 'wood' as const) } : {}),
    ...(c?.items?.length ? { item: c.items[0] } : {}),
  };
}

/** Everyone on tile M (one Forest node). */
function onM(seed = 1): GameState {
  const s = fixtureGame({ seed });
  for (const id of ['ash', 'birch', 'cedar', 'dot']) place(s, id, 'M');
  return s;
}

describe('using tools', () => {
  it('Clumsy hikers can’t use tools', () => {
    const s = onM();
    addCondition(s, hiker(s, 'ash'), 'clumsy', 1, 'days', 'test');
    changeStat(s, hiker(s, 'ash'), 'morale', -3, 'test');
    expect(validateAction(s, use('ash', tool(s, 'ash', 'stuffedAnimal')))).toBe(
      'Ash is Clumsy and can’t use tools.',
    );
  });

  it('a tool with uses left stays; the last use is gone', () => {
    let s = onM();
    changeStat(s, hiker(s, 'ash'), 'morale', -6, 'test');
    const uid = tool(s, 'ash', 'stuffedAnimal'); // 2 uses, +2 Morale at Quality 3
    s = run(s, use('ash', uid));
    expect(hiker(s, 'ash').stats.morale).toBe(6);
    expect(hiker(s, 'ash').inventory.bag[0]?.usesLeft).toBe(1);
    s = run(s, use('ash', uid));
    expect(hiker(s, 'ash').inventory.bag).toEqual([]);
  });

  it('Ukulele: everyone on the tile gains Morale, and it’s used from the user', () => {
    let s = onM();
    for (const h of s.hikers) changeStat(s, h, 'morale', -5, 'test');
    const uid = tool(s, 'ash', 'ukulele');
    expect(validateAction(s, use('ash', uid, 'birch'))).toBe(
      'Ukulele works for everyone on the tile at once.',
    );
    s = run(s, use('ash', uid));
    expect(s.hikers.map((h) => h.stats.morale)).toEqual([7, 7, 7, 7]);
    expect(s.log.find((e) => e.kind === 'used')).toMatchObject({ everyone: true });
  });

  it('Healing Spray cures every negative condition on the tile', () => {
    let s = onM();
    addCondition(s, hiker(s, 'birch'), 'sleepy', 1, 'days', 'test');
    addCondition(s, hiker(s, 'cedar'), 'bored', 1, 'days', 'test');
    s = run(s, use('ash', tool(s, 'ash', 'healingSpray')));
    expect(hasCondition(hiker(s, 'birch'), 'sleepy')).toBe(false);
    expect(hasCondition(hiker(s, 'cedar'), 'bored')).toBe(false);
  });

  it('Hello Kitty Bandaid cures the picked condition and gives Morale', () => {
    let s = onM();
    const b = hiker(s, 'birch');
    addCondition(s, b, 'sleepy', 1, 'days', 'test');
    addCondition(s, b, 'bored', 1, 'days', 'test'); // Morale 10 → 8
    const uid = tool(s, 'ash', 'helloKittyBandaid');
    expect(validateAction(s, use('ash', uid, 'birch'))).toBe('Pick which condition to cure.');
    s = run(s, use('ash', uid, 'birch', { conditionId: 'sleepy' }));
    expect(hasCondition(hiker(s, 'birch'), 'sleepy')).toBe(false);
    expect(hasCondition(hiker(s, 'birch'), 'bored')).toBe(true);
    expect(hiker(s, 'birch').stats.morale).toBe(10);
  });

  it('Survival Kit fills the picked stat', () => {
    let s = onM();
    place(s, 'birch', 'M', { energy: 3 });
    const uid = tool(s, 'ash', 'survivalKit');
    expect(validateAction(s, use('ash', uid, 'birch'))).toBe('Pick a stat to fill.');
    expect(validateAction(s, use('ash', uid, 'birch', { choice: 'morale' }))).toBe(
      'Birch’s Morale is already full.',
    );
    s = run(s, use('ash', uid, 'birch', { choice: 'energy' }));
    expect(hiker(s, 'birch').stats.energy).toBe(10);
  });

  it('Liberal Policy evens out each stat, rounded down', () => {
    let s = fixtureGame();
    place(s, 'ash', 'M', { appetite: 10, energy: 2, morale: 5 });
    place(s, 'birch', 'M', { appetite: 3, energy: 9, morale: 6 });
    s = run(s, use('ash', tool(s, 'ash', 'liberalPolicy')));
    for (const id of ['ash', 'birch']) {
      expect(hiker(s, id).stats).toEqual({ appetite: 6, energy: 5, morale: 5 });
    }
  });

  it('Clothing Patch mends one item, up to its full durability', () => {
    let s = onM();
    const shirt = makeItem(s, 'plainShirt', { quality: 3 });
    const full = fullDurability(ITEMS.plainShirt!, 3);
    shirt.durability = full - 1;
    hiker(s, 'ash').inventory.equipped.body = shirt;
    const uid = tool(s, 'ash', 'clothingPatch');
    expect(validateAction(s, use('ash', uid))).toBe('Pick a clothing item.');
    s = run(s, use('ash', uid, 'ash', { choice: shirt.uid }));
    expect(hiker(s, 'ash').inventory.equipped.body?.durability).toBe(full);
    expect(
      validateAction(s, use('ash', tool(s, 'ash', 'clothingPatch'), 'ash', { choice: shirt.uid })),
    ).toBe('That clothing item is already like new.');
  });

  it('Fertilizer raises the Abundance of a node here; refused when it’s full', () => {
    let s = onM();
    s.abundance.forest = 5;
    s = run(s, use('ash', tool(s, 'ash', 'fertilizer'))); // +2 at Quality 3
    expect(s.abundance.forest).toBe(7);
    s.abundance.forest = 10;
    expect(validateAction(s, use('ash', tool(s, 'ash', 'fertilizer')))).toBe(
      'Every node here is already at full Abundance.',
    );
  });

  it('Planter adds the picked node, up to 3 on a tile', () => {
    let s = onM();
    const uid = tool(s, 'ash', 'planter');
    s = run(s, use('ash', uid, 'ash', { choice: 'river' }));
    expect(s.section.tiles.M?.nodes.map((n) => n.type)).toEqual(['forest', 'river']);
    s.section.tiles.M?.nodes.push({ type: 'river', revealed: true });
    expect(
      validateAction(s, use('ash', tool(s, 'ash', 'planter'), 'ash', { choice: 'river' })),
    ).toBe('That node can’t be added here.');
  });

  it('a resource pack gives random resources of its node', () => {
    let s = onM();
    s = run(s, use('ash', tool(s, 'ash', 'forestPack'))); // 4 at Quality 3
    const got = hiker(s, 'ash').inventory.resources;
    expect(Object.values(got).reduce<number>((n, c) => n + (c ?? 0), 0)).toBe(4);
    expect(Object.keys(got).every((r) => ['wood', 'moss', 'mushroom', 'grass'].includes(r))).toBe(
      true,
    );
  });

  it('Star: no negative conditions, injuries or stat losses this phase', () => {
    let s = onM();
    s = run(s, use('ash', tool(s, 'ash', 'star')));
    const a = hiker(s, 'ash');
    addCondition(s, a, 'sleepy', 1, 'days', 'test');
    addInjury(s, a, 'test');
    changeStat(s, a, 'morale', -4, 'test');
    expect(a).toMatchObject({ injuries: 0, stats: { morale: 10, energy: 10 } });
    expect(hasCondition(a, 'sleepy')).toBe(false);
    s = run(s, END);
    changeStat(s, hiker(s, 'ash'), 'morale', -4, 'test');
    expect(hiker(s, 'ash').stats.morale).toBe(6);
  });

  it('Bear Spray keeps its hiker safe from night events for its nights', () => {
    let s = onM();
    s = run(s, use('ash', tool(s, 'ash', 'bearSpray'))); // 2 nights at Quality 3
    s = toNight(s);
    expect(safeFrom(s, hiker(s, 'ash'))).toEqual({ why: 'item', item: 'bearSpray' });
    expect(safeFrom(s, hiker(s, 'birch'))).toBeUndefined();
    s = run(s, END); // camp: one night counted
    expect(hiker(s, 'ash').boosts?.[0]?.remaining).toBe(1);
    s = toNight(s);
    s = run(s, END);
    expect(hiker(s, 'ash').boosts).toBeUndefined();
  });

  it('Camping Lamp keeps watch over this tile and the ones next to it, tonight', () => {
    let s = onM();
    place(s, 'dot', 'L'); // next to M, and not a campsite
    s = run(s, use('ash', tool(s, 'ash', 'campingLamp')));
    expect(validateAction(s, use('ash', tool(s, 'ash', 'campingLamp')))).toBe(
      'A Camping Lamp is already lit here tonight.',
    );
    s = toNight(s);
    expect(safeFrom(s, hiker(s, 'dot'))).toEqual({ why: 'lamp' });
    s = run(s, END);
    expect(s.section.tiles.M?.lampTonight).toBeUndefined();
  });

  it('Walkie-Talkie: trade with anyone, anywhere, this phase', () => {
    let s = onM();
    place(s, 'birch', 'R');
    hiker(s, 'ash').inventory.resources.wood = 1;
    const give: Action = { type: 'give', fromId: 'ash', toId: 'birch', resource: 'wood' };
    expect(validateAction(s, give)).toBe('Birch isn’t on this tile.');
    s = run(s, use('ash', tool(s, 'ash', 'walkieTalkie')));
    expect(validateAction(s, give)).toBeNull();
    s = run(s, END);
    expect(validateAction(s, give)).toBe('Birch isn’t on this tile.');
  });
});

describe('scavenging tools', () => {
  it('Shovel: scavenging costs no Appetite this phase', () => {
    let s = onM();
    s = run(s, use('ash', tool(s, 'ash', 'shovel')), SCAVENGE('ash'), {
      type: 'scavengeFlip',
      cards: [0],
    });
    s = run(s, takeAny(s, 0));
    expect(hiker(s, 'ash').stats.appetite).toBe(10);
  });

  it('a scavenging tool is refused once the hiker has acted', () => {
    const s = onM();
    hiker(s, 'ash').acted = true;
    expect(validateAction(s, use('ash', tool(s, 'ash', 'trowel')))).toBe(
      'Ash has already acted this morning.',
    );
  });

  it('Trowel and Treasure Map change the deal; they’re gone next phase', () => {
    let s = onM();
    const before = scavengeSetup(s, hiker(s, 'ash'));
    s = run(s, use('ash', tool(s, 'ash', 'trowel')), use('ash', tool(s, 'ash', 'treasureMap')));
    const setup = scavengeSetup(s, hiker(s, 'ash'));
    expect(setup.count).toBe(before.count + 1);
    expect(setup.luck).toBe(before.luck + 2);
    expect(setup.bonuses.map((b) => b.source)).toEqual(
      expect.arrayContaining(['Trowel', 'Treasure Map']),
    );
    s = run(s, END);
    expect(scavengeSetup(s, hiker(s, 'ash')).count).toBe(before.count);
  });

  it('Wheelbarrow: every hiker on the tile sees an extra card', () => {
    let s = onM();
    s = run(s, use('ash', tool(s, 'ash', 'wheelbarrow')));
    expect(scavengeSetup(s, hiker(s, 'birch')).count).toBe(4);
    place(s, 'cedar', 'L');
    expect(scavengeSetup(s, hiker(s, 'cedar')).count).toBe(3);
  });

  it('Woodcutting Axe needs a Forest node, and makes Forest cards likelier', () => {
    let s = fixtureGame(); // on the trailhead: no nodes
    expect(validateAction(s, use('ash', tool(s, 'ash', 'woodcuttingAxe')))).toBe(
      'This tile has no Forest node.',
    );
    s = onM();
    s = run(s, use('ash', tool(s, 'ash', 'woodcuttingAxe')));
    expect(scavengeSetup(s, hiker(s, 'ash')).nodeWeight).toEqual({ forest: 3 });
  });

  it('Swiss Army Knife favors the picked resource, which needs its node here', () => {
    let s = onM();
    const uid = tool(s, 'ash', 'swissArmyKnife');
    expect(validateAction(s, use('ash', uid, 'ash', { choice: 'fish' }))).toBe(
      'This tile has no node for that resource.',
    );
    s = run(s, use('ash', uid, 'ash', { choice: 'wood' }));
    expect(scavengeSetup(s, hiker(s, 'ash')).resourceWeight).toEqual({ wood: 3 });
  });

  it('Supply Map: the next scavenge here has a Choice card for a node here, then it’s gone', () => {
    let s = onM();
    s = run(s, use('ash', tool(s, 'ash', 'supplyMap')), END);
    // It waits past the end of the phase.
    s = run(s, SCAVENGE('ash'));
    const cards = s.scavenge?.cards ?? [];
    expect(cards).toHaveLength(4);
    expect(cards[3]).toMatchObject({ type: 'choice', node: 'forest' });
    expect(hiker(s, 'ash').boosts).toBeUndefined();
  });

  it('Sack: keep another card, with no more Appetite, then Done', () => {
    let s = onM(3);
    s = run(s, use('ash', tool(s, 'ash', 'sack')), SCAVENGE('ash'), {
      type: 'scavengeFlip',
      cards: [0, 1, 2],
    });
    s = run(s, takeAny(s, 0));
    expect(s.scavenge?.took).toBe(1);
    expect(s.scavenge?.cards[0]?.taken).toBe(true);
    expect(hiker(s, 'ash').stats.appetite).toBe(9);
    expect(validateAction(s, takeAny(s, 0))).toBe('That card is already taken.');
    s = run(s, takeAny(s, 1));
    expect(s.scavenge).toBeUndefined();
    expect(hiker(s, 'ash').stats.appetite).toBe(9);
    expect(s.log.filter((e) => e.kind === 'scavenge')).toHaveLength(2);
  });

  it('Sack: Done after the first card closes the window', () => {
    let s = onM(3);
    s = run(s, use('ash', tool(s, 'ash', 'sack')), SCAVENGE('ash'), {
      type: 'scavengeFlip',
      cards: [0],
    });
    s = run(s, takeAny(s, 0));
    expect(validateAction(s, { type: 'scavengeCancel' })).toBeNull();
    s = run(s, { type: 'scavengeCancel' });
    expect(s.scavenge).toBeUndefined();
    expect(hiker(s, 'ash').acted).toBe(true);
  });
});

describe('saves', () => {
  it('boosts, lamps and a Sack’s open scavenge survive a save and load', async () => {
    const { serialize, deserialize } = await import('../save');
    let s = onM(3);
    s = run(
      s,
      use('birch', tool(s, 'birch', 'bearSpray')),
      use('birch', tool(s, 'birch', 'campingLamp')),
      use('ash', tool(s, 'ash', 'wheelbarrow')),
      use('ash', tool(s, 'ash', 'sack')),
      SCAVENGE('ash'),
      { type: 'scavengeFlip', cards: [0, 1] },
    );
    s = run(s, takeAny(s, 0));
    const loaded = deserialize(serialize(s));
    expect(loaded.ok && loaded.state).toEqual(s);
  });
});

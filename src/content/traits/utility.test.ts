import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../../engine/applyAction';
import { addCondition, hasCondition } from '../../engine/conditions';
import { teachCost } from '../../engine/actions/craft';
import { fireCraft, fireSitByFire } from '../../engine/effects';
import { craftSetup, craftTier } from '../../engine/items/craft';
import { makeItem } from '../../engine/items/make';
import { scavengeCost, scavengeSetup } from '../../engine/scavenge/setup';
import { buyPrice, saleCaps } from '../../engine/station/prices';
import {
  END,
  fixtureGame,
  fixtureHiker,
  hiker,
  place,
  run,
  toNight,
} from '../../engine/test/fixtures';
import type { Action, GameState, ResourceId, ScavengeCard } from '../../engine/types';

type Who = 'ash' | 'birch' | 'cedar' | 'dot';

/** Ash, Birch, Cedar and Dot on tile L (a Forest tile) with these traits, in the morning. */
function party(traits: Partial<Record<Who, string[]>>, seed = 3): GameState {
  const s = fixtureGame({
    seed,
    hikers: (['ash', 'birch', 'cedar', 'dot'] as const).map((id) => fixtureHiker(id, traits[id])),
  });
  for (const id of ['ash', 'birch', 'cedar', 'dot']) place(s, id, 'L', { morale: 5 });
  return s;
}

const ash = (s: GameState) => hiker(s, 'ash');
const use = (abilityId: string, choice?: string, hikerId = 'ash'): Action => ({
  type: 'useAbility',
  hikerId,
  abilityId,
  ...(choice ? { choice } : {}),
});

/** Lays a chosen card face up as the first card of an open scavenge, then takes it. */
function scavengeWith(
  s: GameState,
  card: Partial<ScavengeCard> & Pick<ScavengeCard, 'type'>,
  id = 'ash',
) {
  const open = run(s, { type: 'scavenge', hikerId: id });
  if (!open.scavenge) throw new Error('no deal');
  open.scavenge.cards[0] = { rarity: 'common', node: 'forest', ...card, flipped: true };
  return run(open, { type: 'scavengeTake', card: 0 });
}
const wood = { type: 'resource' as const, resources: ['wood' as ResourceId] };

/** How many of `seeds` runs something happens in. */
const times = (seeds: number, f: (seed: number) => boolean) =>
  Array.from({ length: seeds }, (_, i) => f(i + 1)).filter(Boolean).length;

describe('crafting Luck: Collaborative, Focused, Closer, Lovingly Made', () => {
  const luck = (s: GameState) => craftSetup(s, ash(s), 'tool').luck;

  it('Collaborative with others on the tile, Focused alone', () => {
    const s = party({ ash: ['collaborative'], birch: ['focused'] });
    expect(luck(s)).toBe(1);
    place(s, 'ash', 'M');
    expect(luck(s)).toBe(0);
    place(s, 'birch', 'R');
    expect(craftSetup(s, hiker(s, 'birch'), 'tool').luck).toBe(1);
  });

  it('Closer: +1 Luck as the last to act this phase', () => {
    const s = party({ ash: ['closer'] });
    expect(luck(s)).toBe(0);
    for (const id of ['birch', 'cedar', 'dot']) hiker(s, id).acted = true;
    expect(luck(s)).toBe(1);
    expect(scavengeSetup(s, ash(s)).luck).toBe(1);
  });

  it('Lovingly Made: +1 Luck at 8 or more Morale', () => {
    const s = party({ ash: ['lovinglyMade'] });
    expect(luck(s)).toBe(0);
    // Morale 8 gives its own Luck too; Lovingly Made adds 1 more.
    place(s, 'ash', 'L', { morale: 8 });
    place(s, 'birch', 'L', { morale: 8 });
    expect(luck(s) - craftSetup(s, hiker(s, 'birch'), 'tool').luck).toBeCloseTo(1);
  });
});

describe('Eco-conscious', () => {
  it('the first scavenge each day drains 1 less Abundance', () => {
    let s = party({ ash: ['ecoConscious'] });
    const start = s.abundance;
    s = scavengeWith(s, wood);
    expect(s.abundance).toBe(start); // 1 − 1
    s = scavengeWith(run(s, END), wood);
    expect(s.abundance).toBe(start - 1);
  });
});

describe('Squirrely and Fortunate', () => {
  it('Squirrely: acorn caps cards are likelier; Fortunate: +1 Luck', () => {
    const s = party({ ash: ['squirrely'], birch: ['fortunate'] });
    expect(scavengeSetup(s, ash(s)).typeWeight?.caps).toBe(BALANCE.traits.squirrely.capsWeight);
    expect(scavengeSetup(s, hiker(s, 'birch')).luck).toBe(1);
  });
});

describe('Nocturnal', () => {
  it('a night without sleep costs Appetite instead of Energy', () => {
    const s = run(toNight(party({ ash: ['nocturnal'] })), END);
    expect(ash(s).stats).toMatchObject({ energy: 10, appetite: 8 });
    expect(hiker(s, 'birch').stats).toMatchObject({ energy: 8, appetite: 10 });
  });
});

describe('Lead Stomach and Destroyer', () => {
  it('Lead Stomach eats 2 resources (the most plentiful) for 1 Appetite', () => {
    let s = party({ ash: ['leadStomach'] });
    ash(s).inventory.resources = { wood: 3, stone: 1 };
    place(s, 'ash', 'L', { appetite: 5 });
    s = run(s, use('leadStomach'));
    expect(ash(s).inventory.resources).toEqual({ wood: 1, stone: 1 });
    expect(ash(s).stats.appetite).toBe(6);
    s = run(s, use('leadStomach'));
    expect(validateAction(s, use('leadStomach'))).toBe('Needs 2 resources to eat.');
  });

  it('Destroyer spends 3 resources for 1 of a stat', () => {
    let s = party({ ash: ['destroyer'] });
    ash(s).inventory.resources = { wood: 2, stone: 2 };
    place(s, 'ash', 'L', { energy: 5 });
    s = run(s, use('destroyer', 'energy'));
    expect(ash(s).stats.energy).toBe(6);
    expect(
      Object.values(ash(s).inventory.resources).reduce<number>((n, c) => n + (c ?? 0), 0),
    ).toBe(1);
  });
});

describe('selling and buying: Charismatic, Non-Non-Profit, Frugal, Thrifty', () => {
  it('flat amounts first, then percentages (the doc’s example: 10 → 12 → 18)', () => {
    const s = party({
      ash: ['charismatic', 'nonNonProfit'],
      birch: ['charismatic'],
      cedar: ['nonNonProfit'],
    });
    expect(saleCaps(s, ash(s), 10)).toBe(18);
    expect(saleCaps(s, hiker(s, 'birch'), 10)).toBe(12);
    expect(saleCaps(s, hiker(s, 'cedar'), 10)).toBe(15);
    expect(saleCaps(s, hiker(s, 'dot'), 10)).toBe(10);
  });

  it('Frugal pays 1 cap less, never below 0', () => {
    const s = party({ ash: ['frugal'] });
    expect(buyPrice(s, ash(s), 8)).toBe(7);
    expect(buyPrice(s, ash(s), 0)).toBe(0);
    expect(buyPrice(s, hiker(s, 'birch'), 8)).toBe(8);
  });

  it('Frugal at the station: the buyer pays less', () => {
    let s = run(party({ ash: ['frugal'] }), { type: 'debug', op: { kind: 'openStation' } });
    s.caps = 50;
    const offer = s.station?.items.find((o) => o.price > 0);
    if (!offer) return;
    s = run(s, { type: 'buy', offerId: offer.id, hikerId: 'ash' });
    expect(s.caps).toBe(50 - (offer.price - 1));
  });

  it('Thrifty: 1 random item at each shop is free', () => {
    const plain = run(party({}), { type: 'debug', op: { kind: 'openStation' } });
    expect(plain.station?.items.some((o) => o.free)).toBe(false);
    const s = run(party({ ash: ['thrifty'] }), { type: 'debug', op: { kind: 'openStation' } });
    const free = s.station?.items.filter((o) => o.free) ?? [];
    expect(free).toHaveLength(1);
    expect(free[0]?.price).toBe(0);
  });
});

describe('[Color] Thumb', () => {
  it('on a tile with its node: +1 card scavenging, and Tend restores 1 more', () => {
    let s = party({ ash: ['thumb:forest'], birch: ['thumb:river'] });
    expect(scavengeSetup(s, ash(s)).count).toBe(BALANCE.scavenge.cards + 1);
    expect(scavengeSetup(s, hiker(s, 'birch')).count).toBe(BALANCE.scavenge.cards);
    s.abundance = 10;
    s = run(s, { type: 'tend', hikerId: 'ash' });
    expect(s.abundance).toBe(10 + BALANCE.abundance.tend + 1);
  });
});

describe('Day Napper', () => {
  it('can sleep in the day; a nap isn’t the night’s sleep', () => {
    let s = party({ ash: ['dayNapper'] });
    place(s, 'ash', 'L', { energy: 5 });
    expect(validateAction(s, { type: 'sleep', hikerId: 'birch' })).toBe('Hikers sleep at night.');
    s = run(s, { type: 'sleep', hikerId: 'ash' });
    expect(ash(s)).toMatchObject({
      acted: true,
      slept: false,
      stats: { energy: 5 + BALANCE.sleep.energy },
    });
  });
});

describe('Singer (waits on Sit by the Fire)', () => {
  it('everyone on the tile gains 1 Morale when they sit by the fire', () => {
    const s = party({ ash: ['singer'] });
    place(s, 'dot', 'M', { morale: 5 });
    fireSitByFire(s, ash(s));
    expect(['ash', 'birch', 'cedar', 'dot'].map((id) => hiker(s, id).stats.morale)).toEqual([
      6, 6, 6, 5,
    ]);
  });
});

describe('what a crafted item gets: Chef, Careful Hands, Talented, Savvy', () => {
  const crafted = (
    traits: string[],
    itemId: string,
    type: 'food' | 'tool' | 'clothes',
    seed: number,
  ) => {
    const s = party({ ash: traits }, seed);
    const item = makeItem(s, itemId, { quality: 3 });
    ash(s).inventory.bag.push(item);
    fireCraft(s, ash(s), itemId, type, { item, paid: ['wood', 'stone'] });
    return { s, item };
  };

  it('Chef: crafted food sometimes gives 1 more Appetite', () => {
    const n = times(
      60,
      (seed) => crafted(['chef'], 'pelmeni', 'food', seed).item.appetiteMod === 1,
    );
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(30);
  });

  it('Careful Hands: crafted clothes get 0–3 more days', () => {
    const plain = crafted([], 'plainShirt', 'clothes', 1).item.durability ?? 0;
    const extras = Array.from(
      { length: 40 },
      (_, i) =>
        (crafted(['carefulHands'], 'plainShirt', 'clothes', i + 1).item.durability ?? 0) - plain,
    );
    expect(Math.min(...extras)).toBe(0);
    expect(Math.max(...extras)).toBe(3);
  });

  it('Talented: +1 to the main number (Appetite, uses, durability)', () => {
    expect(crafted(['talented'], 'pelmeni', 'food', 1).item.appetiteMod).toBe(1);
    const shovel = makeItem(party({}), 'shovel', { quality: 3 });
    expect(crafted(['talented'], 'shovel', 'tool', 1).item.usesLeft).toBe(
      (shovel.usesLeft ?? 0) + 1,
    );
    const shirt = crafted([], 'plainShirt', 'clothes', 1).item.durability ?? 0;
    expect(crafted(['talented'], 'plainShirt', 'clothes', 1).item.durability).toBe(shirt + 1);
  });

  it('Savvy: sometimes 1 of the spent resources comes back', () => {
    const n = times(60, (seed) => {
      const { s } = crafted(['savvy'], 'shovel', 'tool', seed);
      return (ash(s).inventory.resources.wood ?? 0) + (ash(s).inventory.resources.stone ?? 0) === 1;
    });
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(30);
  });
});

describe('crafting: Handy, Proficient, Artisan and Master', () => {
  it('Handy +1 card, Proficient +2', () => {
    const s = party({ ash: ['handy'], birch: ['proficient'] });
    const base = craftSetup(s, hiker(s, 'cedar'), 'tool').cards;
    expect(craftSetup(s, ash(s), 'tool').cards).toBe(base + 1);
    expect(craftSetup(s, hiker(s, 'birch'), 'tool').cards).toBe(base + 2);
  });

  it('Artisan crafts its type at Tier 2, Master at Tier 3', () => {
    const s = party({ ash: ['artisanCook'], birch: ['masterTailor'] });
    expect(craftTier(s, ash(s), 'food')).toBe(2);
    expect(craftTier(s, ash(s), 'tool')).toBe(1);
    expect(craftTier(s, hiker(s, 'birch'), 'clothes')).toBe(3);
  });
});

describe('Teacher', () => {
  it('teaching costs half the Morale', () => {
    const s = party({ ash: ['teacher'] });
    expect(teachCost(s, ash(s), 'shovel')).toBe(teachCost(s, hiker(s, 'birch'), 'shovel') / 2);
  });
});

describe('Pockets and Generous', () => {
  it('Pockets: after scavenging, sometimes a resource of its node', () => {
    const n = times(60, (seed) =>
      scavengeWith(party({ ash: ['pockets:river'] }, seed), wood).log.some(
        (e) => e.kind === 'gained' && e.cause === 'Wet Pockets',
      ),
    );
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(30);
  });

  it('Generous: someone else on the tile gets a resource from the same node', () => {
    const s = scavengeWith(party({ ash: ['generous'] }), wood);
    const gift = s.log.find((e) => e.kind === 'gained' && e.cause === 'Generous');
    expect(gift && gift.kind === 'gained' && gift.hikerId).not.toBe('ash');
    expect(
      gift &&
        gift.kind === 'gained' &&
        ['wood', 'moss', 'mushroom', 'grass'].includes(gift.resources[0] ?? ''),
    ).toBe(true);
  });
});

describe('Eagle Eye and Pirate', () => {
  it('Eagle Eye also draws from the revealed nodes next door', () => {
    const s = party({ ash: ['eagleEye'] });
    s.section.tiles.M!.nodes = [{ type: 'river', revealed: true }];
    expect(scavengeSetup(s, ash(s)).nodes.map((n) => n.type)).toContain('river');
    expect(scavengeSetup(s, hiker(s, 'birch')).nodes.map((n) => n.type)).not.toContain('river');
  });

  it('Pirate: scavenging alone costs no Appetite', () => {
    const s = party({ ash: ['pirate'] });
    expect(scavengeCost(s, ash(s))).toBe(1);
    place(s, 'ash', 'M');
    expect(scavengeCost(s, ash(s))).toBe(0);
  });
});

describe('Therapist and Liberal', () => {
  it('Therapist: 1 Morale shortens every negative condition on the tile by a day', () => {
    let s = party({ ash: ['therapist'] });
    addCondition(s, hiker(s, 'birch'), 'bored', 2, 'days', 'test');
    addCondition(s, hiker(s, 'cedar'), 'sleepy', 1, 'days', 'test');
    s = run(s, use('therapist'));
    expect(hiker(s, 'birch').conditions).toMatchObject([{ id: 'bored', remaining: 1 }]);
    expect(hasCondition(hiker(s, 'cedar'), 'sleepy')).toBe(false);
    expect(ash(s).stats.morale).toBe(4);
    expect(validateAction(s, use('therapist'))).toBe('Therapist is used up today.');
  });

  it('Liberal: 1 Energy evens out the tile’s Morale', () => {
    let s = party({ ash: ['liberal'] });
    place(s, 'birch', 'L', { morale: 9 });
    place(s, 'cedar', 'L', { morale: 1 });
    place(s, 'dot', 'L', { morale: 5 });
    s = run(s, use('liberal'));
    expect(['ash', 'birch', 'cedar', 'dot'].map((id) => hiker(s, id).stats.morale)).toEqual([
      5, 5, 5, 5,
    ]);
    expect(ash(s).stats.energy).toBe(9);
  });
});

describe('Dream Alchemist', () => {
  it('at night, some resources turn into others (the count stays)', () => {
    const changed = times(20, (seed) => {
      const s = party({ ash: ['dreamAlchemist'] }, seed);
      ash(s).inventory.resources = { wood: 10 };
      const after = run(toNight(s), END);
      const res = ash(after).inventory.resources;
      expect(Object.values(res).reduce<number>((n, c) => n + (c ?? 0), 0)).toBe(10);
      return (res.wood ?? 0) < 10;
    });
    expect(changed).toBeGreaterThan(5);
  });
});

describe('German Efficiency', () => {
  it('using a tool also gives a random resource', () => {
    let s = party({ ash: ['germanEfficiency'] });
    const toy = makeItem(s, 'stuffedAnimal', { quality: 3 });
    ash(s).inventory.bag.push(toy);
    s = run(s, { type: 'useItem', hikerId: 'ash', itemUid: toy.uid, targetId: 'ash' });
    expect(s.log.some((e) => e.kind === 'gained' && e.cause === 'German Efficiency')).toBe(true);
  });
});

describe('Alchemist', () => {
  it('turns 2 of a resource into 1 other resource of the same node', () => {
    let s = party({ ash: ['alchemist'] });
    ash(s).inventory.resources = { wood: 2, stone: 1 };
    s = run(s, use('alchemist', 'wood'));
    const res = ash(s).inventory.resources;
    expect(res.wood).toBeUndefined();
    const got = Object.keys(res).filter((r) => r !== 'stone');
    expect(got).toHaveLength(1);
    expect(['moss', 'mushroom', 'grass']).toContain(got[0]);
    expect(validateAction(s, use('alchemist', 'stone'))).toMatch(/^Choose|nothing/);
  });
});

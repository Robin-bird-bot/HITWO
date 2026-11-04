import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { deserialize, serialize } from '../save';
import { END, fixtureGame, fixtureHiker, hiker, place, run, toNight } from '../test/fixtures';
import type { GameState, ScavengeCard } from '../types';

/** Ash on tile L (one Forest node) in the morning. */
function onForest(): GameState {
  const s = fixtureGame({ seed: 5 });
  place(s, 'ash', 'L');
  return s;
}

const deal = (s: GameState, id = 'ash') => run(s, { type: 'scavenge', hikerId: id });

/** Test setup only: lays a chosen card face up as the first card of an open scavenge. */
function withCard(
  s: GameState,
  card: Partial<ScavengeCard> & Pick<ScavengeCard, 'type'>,
): GameState {
  const open = deal(s);
  const first = open.scavenge?.cards[0];
  if (!open.scavenge || !first) throw new Error('no deal');
  open.scavenge.cards[0] = { rarity: 'common', node: 'forest', ...card, flipped: true };
  return open;
}

describe('scavenging: dealing', () => {
  it('deals 3 cards face down and charges nothing yet', () => {
    const s = deal(onForest());
    expect(s.scavenge?.cards).toHaveLength(3);
    expect(s.scavenge?.cards.every((c) => !c.flipped)).toBe(true);
    expect(hiker(s, 'ash').stats.appetite).toBe(10);
    expect(hiker(s, 'ash').acted).toBe(false);
  });

  it('gives a Dog 1 extra card, and says so in the bonuses', () => {
    const s = fixtureGame({ hikers: [{ ...fixtureHiker('rex'), family: 'dog' }] });
    place(s, 'rex', 'L');
    const open = deal(s, 'rex');
    expect(open.scavenge?.cards).toHaveLength(4);
    expect(open.scavenge?.bonuses.map((b) => b.label)).toContain(
      'Dog: 1 extra card to choose from',
    );
  });

  it.each([
    [8, 1, 'Luck +1 from high Morale (8)'],
    [5, 0, null],
    [3, -1, 'Luck −1 from low Morale (3)'],
  ])('at Morale %i deals at Luck %i', (morale, luck, label) => {
    const s = onForest();
    place(s, 'ash', 'L', { morale });
    const open = deal(s);
    expect(open.scavenge?.luck).toBe(luck);
    const labels = open.scavenge?.bonuses.map((b) => b.label) ?? [];
    if (label) expect(labels).toContain(label);
    else expect(labels.some((l) => l.includes('Morale'))).toBe(false);
  });

  it('"Not now" before flipping costs nothing and deals the same cards again', () => {
    const s = onForest();
    const first = deal(s);
    const cancelled = run(first, { type: 'scavengeCancel' });
    expect(cancelled.scavenge).toBeUndefined();
    expect(cancelled.rng).toEqual(s.rng);
    expect(deal(cancelled).scavenge?.cards).toEqual(first.scavenge?.cards);
  });

  it('can’t back out once a card is flipped', () => {
    const s = run(deal(onForest()), { type: 'scavengeFlip', cards: [1] });
    expect(s.scavenge?.cards[1]?.flipped).toBe(true);
    expect(validateAction(s, { type: 'scavengeCancel' })).toMatch(/flipped/);
  });

  it('waits for a card before anything else happens', () => {
    const s = deal(onForest());
    expect(validateAction(s, END)).toBe('Finish scavenging first.');
    expect(validateAction(s, { type: 'move', hikerId: 'birch', toTileId: 'L' })).toBe(
      'Finish scavenging first.',
    );
    expect(validateAction(s, { type: 'scavenge', hikerId: 'birch' })).toBe(
      'Finish scavenging first.',
    );
  });

  it('survives a save and reload mid-draw', () => {
    const s = run(deal(onForest()), { type: 'scavengeFlip', cards: [0, 2] });
    expect(deserialize(serialize(s))).toEqual({ ok: true, state: s });
  });
});

describe('scavenging: who can and where', () => {
  it.each([
    [5, /Hungry/],
    [2, /Famished/],
  ])('is blocked at Appetite %i', (appetite, reason) => {
    const s = onForest();
    place(s, 'ash', 'L', { appetite });
    expect(validateAction(s, { type: 'scavenge', hikerId: 'ash' })).toMatch(reason);
  });

  it('is blocked on a tile with no nodes', () => {
    expect(validateAction(fixtureGame(), { type: 'scavenge', hikerId: 'ash' })).toMatch(
      /nothing to scavenge/,
    );
  });

  it('is blocked when every node on the tile is empty (Wyatt, Nov 4)', () => {
    const s = onForest();
    s.abundance.forest = 0;
    expect(validateAction(s, { type: 'scavenge', hikerId: 'ash' })).toBe(
      'Nothing left to find here. Tend it or move on.',
    );
  });

  it('is blocked when the hiker’s resources are full', () => {
    const s = onForest();
    hiker(s, 'ash').inventory.resources = { wood: BALANCE.inventory.resourceLimit };
    expect(validateAction(s, { type: 'scavenge', hikerId: 'ash' })).toMatch(/resources are full/);
  });

  it('is blocked after the hiker has acted', () => {
    const s = run(onForest(), { type: 'move', hikerId: 'ash', toTileId: 'M' });
    expect(validateAction(s, { type: 'scavenge', hikerId: 'ash' })).toMatch(/already acted/);
  });
});

describe('scavenging: taking a card', () => {
  it('needs the card flipped first', () => {
    expect(validateAction(deal(onForest()), { type: 'scavengeTake', card: 0 })).toBe(
      'Flip that card first.',
    );
  });

  it('pays 1 Appetite, uses the phase, gives the card and drains its node', () => {
    const s = withCard(onForest(), { type: 'x2', resources: ['wood', 'wood'] });
    const after = run(s, { type: 'scavengeTake', card: 0 });
    const ash = hiker(after, 'ash');
    expect(ash.stats.appetite).toBe(9);
    expect(ash.acted).toBe(true);
    expect(ash.inventory.resources.wood).toBe(2);
    expect(after.abundance.forest).toBe(BALANCE.abundance.start - 2);
    expect(after.scavenge).toBeUndefined();
    expect(after.scavengedToday).toEqual([{ hikerId: 'ash', tileId: 'L', nodes: ['forest'] }]);
    expect(after.log.find((e) => e.kind === 'scavenge')).toMatchObject({
      hikerId: 'ash',
      card: 'x2',
      resources: ['wood', 'wood'],
    });
  });

  it('costs 1 extra Appetite at night', () => {
    const night = toNight(onForest());
    const s = withCard(night, { type: 'resource', resources: ['moss'] });
    expect(hiker(run(s, { type: 'scavengeTake', card: 0 }), 'ash').stats.appetite).toBe(
      hiker(s, 'ash').stats.appetite - 2,
    );
  });

  it('checks Choice picks, and gives two of the pick on Choice ×2', () => {
    const s = withCard(onForest(), {
      type: 'choiceX2',
      pick: { count: 1, from: 'forest', each: 2 },
    });
    expect(validateAction(s, { type: 'scavengeTake', card: 0 })).toBe('Pick a resource first.');
    expect(validateAction(s, { type: 'scavengeTake', card: 0, picks: ['fish'] })).toMatch(
      /isn’t on this card/,
    );
    const after = run(s, { type: 'scavengeTake', card: 0, picks: ['grass'] });
    expect(hiker(after, 'ash').inventory.resources.grass).toBe(2);
    expect(after.abundance.forest).toBe(BALANCE.abundance.start - 2);
  });

  it('lets Pair of the Wild pick any two of all 16, the same or different', () => {
    const s = withCard(onForest(), {
      type: 'pairOfTheWild',
      pick: { count: 2, from: 'all', each: 1 },
    });
    expect(validateAction(s, { type: 'scavengeTake', card: 0, picks: ['salt'] })).toBe(
      'Pick 2 resources first.',
    );
    const after = run(s, { type: 'scavengeTake', card: 0, picks: ['salt', 'salt'] });
    expect(hiker(after, 'ash').inventory.resources.salt).toBe(2);
  });

  it('gives what fits when the card is bigger than the room left', () => {
    const s = onForest();
    hiker(s, 'ash').inventory.resources = { moss: BALANCE.inventory.resourceLimit - 1 };
    const open = withCard(s, { type: 'x3', resources: ['wood', 'wood', 'wood'] });
    const after = run(open, { type: 'scavengeTake', card: 0 });
    expect(hiker(after, 'ash').inventory.resources.wood).toBe(1);
    expect(after.log.find((e) => e.kind === 'scavenge')).toMatchObject({ left: 2 });
  });

  it('adds acorn caps to the party purse', () => {
    const after = run(withCard(onForest(), { type: 'caps', caps: 3 }), {
      type: 'scavengeTake',
      card: 0,
    });
    expect(after.caps).toBe(3);
  });

  it('puts a found item in the bag, and refuses when the bag is full', () => {
    const s = withCard(onForest(), { type: 'toolFind', items: ['medkit'] });
    const after = run(s, { type: 'scavengeTake', card: 0 });
    expect(hiker(after, 'ash').inventory.bag.map((i) => i.itemId)).toEqual(['medkit']);

    const full = withCard(onForest(), { type: 'toolFind', items: ['medkit'] });
    hiker(full, 'ash').inventory.bag = Array.from(
      { length: BALANCE.inventory.bagSlots },
      (_, i) => ({
        uid: `x${i}`,
        itemId: 'phone',
      }),
    );
    expect(validateAction(full, { type: 'scavengeTake', card: 0 })).toMatch(/bag is full/);
  });

  it('makes a Choice item card pick one of its items', () => {
    const s = withCard(onForest(), { type: 'choiceFood', items: ['energyDrink', 'dogFood'] });
    expect(validateAction(s, { type: 'scavengeTake', card: 0 })).toBe('Pick an item first.');
    expect(validateAction(s, { type: 'scavengeTake', card: 0, item: 'ring' })).toMatch(
      /isn’t on this card/,
    );
    const after = run(s, { type: 'scavengeTake', card: 0, item: 'dogFood' });
    expect(hiker(after, 'ash').inventory.bag.map((i) => i.itemId)).toEqual(['dogFood']);
  });

  it('drains both nodes for Mixed, and 1 extra from a Bounty node', () => {
    const mixed = run(
      withCard(onForest(), { type: 'mixed', node2: 'river', resources: ['wood', 'fish'] }),
      { type: 'scavengeTake', card: 0 },
    );
    expect(mixed.abundance.forest).toBe(BALANCE.abundance.start - 1);
    expect(mixed.abundance.river).toBe(BALANCE.abundance.start - 1);

    const bounty = run(
      withCard(onForest(), { type: 'resource', bounty: true, resources: ['wood'] }),
      {
        type: 'scavengeTake',
        card: 0,
      },
    );
    expect(bounty.abundance.forest).toBe(BALANCE.abundance.start - 2);
  });

  it('never drains a meter below 0', () => {
    const s = onForest();
    s.abundance.forest = 1;
    const after = run(withCard(s, { type: 'x3', resources: ['wood', 'wood', 'wood'] }), {
      type: 'scavengeTake',
      card: 0,
    });
    expect(after.abundance.forest).toBe(0);
  });

  it('forgets today’s scavenges the next morning', () => {
    let s = run(withCard(onForest(), { type: 'resource', resources: ['wood'] }), {
      type: 'scavengeTake',
      card: 0,
    });
    expect(s.scavengedToday).toHaveLength(1);
    s = run(s, END, END, END);
    expect(s.day).toBe(2);
    expect(s.scavengedToday).toEqual([]);
  });

  it('gives the same game for the same seed and actions', () => {
    const play = () => {
      const open = run(deal(onForest()), { type: 'scavengeFlip', cards: [0, 1, 2] });
      // Take the first card that needs no picks.
      const card = open.scavenge?.cards.findIndex((c) => !c.pick && !c.items) ?? -1;
      return card < 0 ? open : run(open, { type: 'scavengeTake', card });
    };
    expect(play()).toEqual(play());
  });
});

describe('save version 2', () => {
  it('fills in Abundance and today’s scavenges for a version 1 save', () => {
    const v1 = structuredClone(fixtureGame()) as Partial<GameState>;
    delete v1.abundance;
    delete v1.scavengedToday;
    const loaded = deserialize(JSON.stringify({ ...v1, saveVersion: 1 }));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state.abundance).toEqual({ forest: 8, river: 8, wildlife: 8, mountain: 8 });
      expect(loaded.state.scavengedToday).toEqual([]);
    }
  });
});

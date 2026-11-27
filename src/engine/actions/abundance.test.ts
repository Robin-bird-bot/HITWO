import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { SCAVENGE_CARDS } from '../../content';
import { emptyChance } from '../abundance';
import { validateAction } from '../applyAction';
import { deserialize, serialize } from '../save';
import { seedRng } from '../rng';
import { dealCards, isResourceCard } from '../scavenge/deal';
import { scavengeSetup } from '../scavenge/setup';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { GameState, ScavengeCardType, TileNode } from '../types';

const A = BALANCE.abundance;

/** Ash on tile L (one Forest node) in the morning. */
function onForest(): GameState {
  const s = fixtureGame({ seed: 9 });
  place(s, 'ash', 'L');
  return s;
}

/** Deals one forced card to Ash, flips it and takes it. */
function takeForced(s: GameState, type: ScavengeCardType): GameState {
  s.debugDeal = [type];
  let open = run(s, { type: 'scavenge', hikerId: 'ash' });
  open = run(open, { type: 'scavengeFlip', cards: [0] });
  const card = open.scavenge?.cards[0];
  const picks = card?.pick ? Array.from({ length: card.pick.count }, () => 'wood') : undefined;
  return run(open, {
    type: 'scavengeTake',
    card: 0,
    ...(picks ? { picks } : {}),
  });
}

describe('one Abundance bar for the biome', () => {
  it('starts each biome at the start value', () => {
    expect(fixtureGame().abundance).toBe(A.start);
  });

  it('recovers every night, whoever scavenged, and never past full', () => {
    const s = onForest();
    s.abundance = 5;
    s.scavengedToday = [{ hikerId: 'ash', tileId: 'L', nodes: ['forest'] }];
    const next = run(toNight(s), END);
    expect(next.day).toBe(2);
    expect(next.abundance).toBe(5 + A.nightRecovery);
    expect(next.log.find((e) => e.kind === 'recovered')).toMatchObject({ from: 5, to: 6 });
    const full = onForest();
    full.abundance = A.max;
    expect(run(toNight(full), END).abundance).toBe(A.max);
  });

  it.each([
    ['resource', 1],
    ['x2', 2],
    ['x3', 2],
    ['pair', 2],
    ['trio', 2],
  ] as const)('taking a %s card drains %i', (type, drain) => {
    const s = onForest();
    s.abundance = 10;
    const after = takeForced(s, type);
    expect(after.abundance).toBe(10 - drain);
  });

  it('a Bounty node drains 1 more', () => {
    const s = onForest();
    s.abundance = 10;
    const node = s.section.tiles.L?.nodes[0] as TileNode;
    node.bounty = true;
    expect(takeForced(s, 'resource').abundance).toBe(10 - 1 - A.bountyExtraDrain);
  });

  it('never drops below 0', () => {
    const s = onForest();
    s.abundance = 1;
    expect(takeForced(s, 'x2').abundance).toBe(0);
  });

  it('the old low-Abundance effects are gone: same card count and Luck', () => {
    const s = onForest();
    place(s, 'ash', 'L', { morale: 5 });
    s.abundance = 0;
    const setup = scavengeSetup(s, hiker(s, 'ash'));
    expect(setup.count).toBe(BALANCE.scavenge.cards);
    expect(setup.luck).toBe(0);
    expect(setup.bonuses.some((b) => /Abundance/.test(b.label))).toBe(false);
  });
});

describe('Empty cards', () => {
  it.each([
    [0, A.emptyChance.atZero],
    [10, (A.emptyChance.atZero + A.emptyChance.atFull) / 2],
    [20, A.emptyChance.atFull],
  ])('at Abundance %i the chance is %d', (level, chance) => {
    expect(emptyChance(level)).toBeCloseTo(chance, 10);
  });

  it('Luck changes it by a tenth of itself for each point, both ways (Wyatt, Nov 14)', () => {
    const base = emptyChance(0);
    expect(emptyChance(0, 5)).toBeCloseTo(base / 2, 10);
    expect(emptyChance(0, 1)).toBeCloseTo(base * 0.9, 10);
    expect(emptyChance(0, -5)).toBeCloseTo(base * 1.5, 10);
    expect(emptyChance(20, -2)).toBeCloseTo(A.emptyChance.atFull * 1.2, 10);
    // Never below 0 or above 1.
    expect(emptyChance(0, 20)).toBe(0);
    expect(emptyChance(0, -20)).toBeLessThanOrEqual(1);
  });

  it('a lucky scavenger is dealt fewer Empty cards', () => {
    const share = (luck: number) => {
      const cards = dealCards(seedRng(11), { nodes, abundance: 0, luck, count: 4000 });
      const resource = cards.filter((c) => isResourceCard(c.type));
      return resource.filter((c) => c.empty).length / resource.length;
    };
    expect(share(5)).toBeLessThan(share(0) - 0.1);
    expect(share(-5)).toBeGreaterThan(share(0) + 0.1);
  });

  const nodes: TileNode[] = [
    { type: 'forest', revealed: true },
    { type: 'river', revealed: true },
    { type: 'caps', revealed: true },
  ];

  it('about that share of resource cards come up Empty; caps and item cards never do', () => {
    for (const level of [0, 20]) {
      const cards = dealCards(seedRng(7), { nodes, abundance: level, luck: 5, count: 4000 });
      const resource = cards.filter((c) => isResourceCard(c.type));
      const others = cards.filter((c) => !isResourceCard(c.type));
      const share = resource.filter((c) => c.empty).length / resource.length;
      expect(share).toBeGreaterThan(emptyChance(level, 5) - 0.03);
      expect(share).toBeLessThan(emptyChance(level, 5) + 0.03);
      expect(others.length).toBeGreaterThan(0);
      expect(others.some((c) => c.empty)).toBe(false);
    }
  });

  it('caps and every item card type are never resource cards', () => {
    for (const def of Object.values(SCAVENGE_CARDS)) {
      expect(isResourceCard(def.id)).toBe(def.id !== 'caps' && !def.itemType);
    }
  });

  it('taking an Empty card gives nothing, but costs the scavenge and drains', () => {
    const s = onForest();
    s.abundance = 10;
    let open = run(s, { type: 'scavenge', hikerId: 'ash' });
    open = run(open, { type: 'scavengeFlip', cards: [0] });
    const card = open.scavenge?.cards[0];
    if (!open.scavenge || !card) throw new Error('no deal');
    // A Choice card that came up Empty: nothing to pick.
    open.scavenge.cards[0] = { ...card, type: 'choice', empty: true };
    expect(validateAction(open, { type: 'scavengeTake', card: 0 })).toBeNull();
    const after = run(open, { type: 'scavengeTake', card: 0 });
    expect(hiker(after, 'ash').inventory.resources).toEqual({});
    expect(hiker(after, 'ash').stats.energy).toBe(10 - BALANCE.scavenge.energy);
    expect(hiker(after, 'ash').stats.appetite).toBe(10);
    expect(after.abundance).toBe(10 - SCAVENGE_CARDS.choice.drain);
    expect(after.log.findLast((e) => e.kind === 'scavenge')).toMatchObject({ empty: true });
  });

  it('the same seed gives the same Empty cards', () => {
    const deal = () =>
      dealCards(seedRng(3), { nodes, abundance: 4, luck: 0, count: 50 }).map((c) => !!c.empty);
    expect(deal()).toEqual(deal());
  });
});

describe('Appetite: no more overnight loss', () => {
  it('a night at camp costs no Appetite', () => {
    const s = onForest();
    const next = run(toNight(s), END);
    expect(hiker(next, 'ash').stats.appetite).toBe(hiker(s, 'ash').stats.appetite);
  });
});

describe('Tend', () => {
  it('raises Abundance, costs 1 Energy and no Appetite, and uses the phase (29, section 1)', () => {
    const s = onForest();
    s.abundance = 3;
    const after = run(s, { type: 'tend', hikerId: 'ash' });
    expect(after.abundance).toBe(3 + A.tend);
    expect(hiker(after, 'ash').acted).toBe(true);
    expect(hiker(after, 'ash').stats.energy).toBe(10 - A.tendEnergy);
    expect(hiker(after, 'ash').stats.appetite).toBe(10);
    expect(after.log.find((e) => e.kind === 'tend')).toMatchObject({ from: 3, to: 5 });
  });

  it('never goes above full', () => {
    const s = onForest();
    s.abundance = A.max - 1;
    expect(run(s, { type: 'tend', hikerId: 'ash' }).abundance).toBe(A.max);
  });

  it('says why it can’t', () => {
    const s = onForest();
    s.abundance = A.max;
    expect(validateAction(s, { type: 'tend', hikerId: 'ash' })).toMatch(/already full/);
    expect(validateAction(fixtureGame(), { type: 'tend', hikerId: 'ash' })).toMatch(
      /nothing to tend/,
    );
    const night = toNight(onForest());
    expect(validateAction(night, { type: 'tend', hikerId: 'ash' })).toBe(
      'Tending is a daytime action.',
    );
  });
});

describe('giving and returning to nature', () => {
  function together(): GameState {
    const s = onForest();
    place(s, 'birch', 'L');
    hiker(s, 'ash').inventory.resources = { wood: 2 };
    hiker(s, 'ash').inventory.bag = [{ uid: 'r1', itemId: 'ring' }];
    return s;
  }

  it('hands a resource to a hiker on the same tile, as a free action', () => {
    const after = run(together(), { type: 'give', fromId: 'ash', toId: 'birch', resource: 'wood' });
    expect(hiker(after, 'ash').inventory.resources).toEqual({ wood: 1 });
    expect(hiker(after, 'birch').inventory.resources).toEqual({ wood: 1 });
    expect(hiker(after, 'ash').acted).toBe(false);
    expect(after.log.at(-1)).toMatchObject({
      kind: 'give',
      fromId: 'ash',
      toId: 'birch',
      resource: 'wood',
    });
  });

  it('hands a bag item over', () => {
    const after = run(together(), { type: 'give', fromId: 'ash', toId: 'birch', itemUid: 'r1' });
    expect(hiker(after, 'ash').inventory.bag).toEqual([]);
    expect(hiker(after, 'birch').inventory.bag).toEqual([{ uid: 'r1', itemId: 'ring' }]);
  });

  it('says why it can’t', () => {
    const s = together();
    expect(
      validateAction(s, { type: 'give', fromId: 'ash', toId: 'cedar', resource: 'wood' }),
    ).toMatch(/isn’t on this tile/);
    expect(
      validateAction(s, { type: 'give', fromId: 'ash', toId: 'birch', resource: 'fish' }),
    ).toMatch(/doesn’t have that/);
    hiker(s, 'birch').inventory.resources = { moss: BALANCE.inventory.resourceLimit };
    expect(
      validateAction(s, { type: 'give', fromId: 'ash', toId: 'birch', resource: 'wood' }),
    ).toMatch(/resources are full/);
  });

  it('returns a resource to nature, +1 Abundance, as a free action', () => {
    const s = together();
    s.abundance = 4;
    const after = run(s, { type: 'returnToNature', hikerId: 'ash', resource: 'wood' });
    expect(hiker(after, 'ash').inventory.resources).toEqual({ wood: 1 });
    expect(after.abundance).toBe(4 + A.returnToNature);
    expect(hiker(after, 'ash').acted).toBe(false);
  });
});

describe('saves from before the one bar (v13 → v14)', () => {
  function v13(meters: Record<string, number>, trials?: unknown[]): string {
    const old = JSON.parse(serialize(fixtureGame())) as Record<string, unknown>;
    old.saveVersion = 13;
    old.abundance = meters;
    if (trials) old.trials = trials;
    return JSON.stringify(old);
  }

  it('averages the four meters (0–10) into the bar (0–20)', () => {
    const loaded = deserialize(v13({ forest: 10, river: 6, wildlife: 4, mountain: 8 }));
    expect(loaded.ok && loaded.state.abundance).toBe(14);
    const low = deserialize(v13({ forest: 0, river: 1, wildlife: 0, mountain: 0 }));
    expect(low.ok && low.state.abundance).toBe(1);
  });

  it('an Overfished Trial already running counts its rise from the new bar', () => {
    const trial = {
      uid: 'trial-1',
      cardId: 'overfished',
      tileId: 'L',
      hikers: ['ash'],
      rolls: { x: { level: 5 }, y: {}, includes: {}, luck: 0 },
      startedAt: 0,
      endsAt: 6,
      row: 1,
      startRows: { ash: 1 },
      done: [],
      penalized: [],
    };
    const loaded = deserialize(v13({ forest: 5, river: 5, wildlife: 5, mountain: 5 }, [trial]));
    if (!loaded.ok) throw new Error('load failed');
    expect(loaded.state.abundance).toBe(10);
    expect(loaded.state.trials?.[0]).toMatchObject({
      startAbundance: 10,
      rolls: { x: { gain: 3 } },
    });
  });
});

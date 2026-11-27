/**
 * The Nov 26 evening challenge reset (docs/design/24-challenges-reset.md,
 * sections 1 to 3; 25-challenges-on-the-map.md, sections 4 and 6): the new
 * costs pay and refuse correctly, the punishments take what they say, and
 * the backup rule turns what's missing into Energy (and below 0, an injury).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { P, PX, listed, opt, res } from '../../content/cardBuilders';
import { CARDS } from '../../content/challenges';
import { validateAction } from '../applyAction';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, ChallengeSection, GameState, Gift, ResourceId } from '../types';
import { applyEffects } from './applyEffects';
import { rangeAt } from './rolls';
import type { CardDef, ChallengeDef, Effect } from './types';

/** Test-only cards for costs no card in the list uses (Big stacks, Mixed bag). */
const EXTRA: ChallengeDef[] = [
  listed({
    name: 'Test Big Stacks',
    art: false,
    tier: 1,
    nodes: 'any',
    scope: 'each',
    cost: [opt(res(1, undefined, { bigStacks: true }))],
    costText: ['Spend 1 of every resource you have 3 or more of.'],
    penalty: [P.energy],
    penaltyText: ['If failed: lose {x} Energy.'],
  }),
  listed({
    name: 'Test Mixed Bag',
    art: false,
    tier: 1,
    nodes: 'any',
    scope: 'each',
    cost: [opt(res(2, undefined, { mixedBag: true }))],
    costText: ['Spend 1 from each of 2 different categories.'],
    penalty: [P.energy],
    penaltyText: ['If failed: lose {x} Energy.'],
  }),
];
beforeAll(() => {
  for (const c of EXTRA) (CARDS as Record<string, CardDef>)[c.id] = c;
});
afterAll(() => {
  for (const c of EXTRA) delete (CARDS as Record<string, CardDef>)[c.id];
});

/** Ash (and Birch) on L with these packs, and a card open there. */
function opened(
  cardId: string,
  packs: { ash?: Partial<Record<ResourceId, number>>; birch?: Partial<Record<ResourceId, number>> },
  tier?: number,
): GameState {
  const s = fixtureGame({ seed: 3, challenges: true });
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  hiker(s, 'ash').inventory.resources = { ...(packs.ash ?? {}) };
  hiker(s, 'birch').inventory.resources = { ...(packs.birch ?? {}) };
  return run(s, {
    type: 'debug',
    op: { kind: 'openChallenge', cardId, tileId: 'L', ...(tier ? { tier } : {}) },
  });
}

const gift = (from: string, resource: string, count = 1): Gift => ({
  kind: 'resource',
  req: 0,
  from,
  resource,
  count,
});
const pays = (hikerId: string, ...gifts: Gift[]): ChallengeSection => ({
  hikerId,
  pay: true,
  option: 0,
  gifts,
});
const fails = (hikerId: string): ChallengeSection => ({ hikerId, pay: false, gifts: [] });
const resolve = (...sections: ChallengeSection[]): Action => ({
  type: 'resolveChallenge',
  sections,
});
/** Why an each-hiker card's resolve is refused (Birch takes the punishment). */
const why = (s: GameState, ...gifts: Gift[]) =>
  validateAction(s, resolve(pays('ash', ...gifts), fails('birch')));

describe('the new costs (24-challenges-reset.md, section 3)', () => {
  it('your most: X of the resource the hiker has the most of', () => {
    const s = opened('blisters', { ash: { fish: 3, wood: 1 }, birch: { wood: 2 } });
    expect(why(s, gift('ash', 'wood'))).toMatch(/doesn’t fit/);
    expect(why(s, gift('ash', 'fish'))).toBeNull();
    // Others can chip in the judged hiker's most.
    expect(why(s, gift('birch', 'fish'))).toMatch(/doesn’t have/);
    const after = run(s, resolve(pays('ash', gift('ash', 'fish')), fails('birch')));
    expect(hiker(after, 'ash').inventory.resources.fish).toBe(2);
  });

  it('your most on a party card: the party’s most on this tile, 1 for each hiker here', () => {
    const s = opened('thirsty-trail', { ash: { fish: 2, wood: 1 }, birch: { fish: 1, salt: 2 } });
    const party = (...gifts: Gift[]) => validateAction(s, resolve({ pay: true, option: 0, gifts }));
    expect(party(gift('birch', 'salt', 2))).toMatch(/doesn’t fit/);
    expect(party(gift('ash', 'fish'), gift('birch', 'fish'))).toBeNull();
  });

  it('singles: every resource the hiker has exactly 1 of (at least 1)', () => {
    const s = opened('black-cat', { ash: { wood: 1, clay: 1, fish: 3 }, birch: { fish: 2 } });
    expect(why(s, gift('ash', 'wood'))).toMatch(/1 more/);
    expect(why(s, gift('ash', 'fish'))).toMatch(/doesn’t fit/);
    expect(why(s, gift('ash', 'wood'), gift('ash', 'clay'))).toBeNull();
    // Birch has no singles: nothing fits, so this way can't be paid.
    expect(validateAction(s, resolve(fails('ash'), pays('birch', gift('birch', 'fish'))))).toMatch(
      /doesn’t fit/,
    );
  });

  it('big stacks: 1 of every resource the hiker has 3 or more of', () => {
    const s = opened('test-big-stacks', { ash: { wood: 3, fish: 4, clay: 2 } });
    expect(why(s, gift('ash', 'clay'))).toMatch(/doesn’t fit/);
    expect(why(s, gift('ash', 'wood', 2))).toMatch(/different/);
    expect(why(s, gift('ash', 'wood'), gift('ash', 'fish'))).toBeNull();
  });

  it('a matching set, and variety: 1 each of X different resources', () => {
    const s = opened('snagged-pack', { ash: { wood: 3, clay: 1 } });
    const n = s.challenge!.rolls.x.n!;
    expect(n).toBe(2);
    expect(why(s, gift('ash', 'wood', 2))).toMatch(/different/);
    expect(why(s, gift('ash', 'wood'), gift('ash', 'clay'))).toBeNull();
  });

  it('mixed bag: 1 from each of X different categories (Wood and Metal count for either of theirs)', () => {
    const s = opened('test-mixed-bag', { ash: { wood: 1, metal: 1, stone: 1, clay: 1 } });
    // Wood (Fire) and Metal (Building): fine.
    expect(why(s, gift('ash', 'wood'), gift('ash', 'metal'))).toBeNull();
    // Stone and Clay are both only Building.
    expect(why(s, gift('ash', 'stone'), gift('ash', 'clay'))).toMatch(/different category/);
  });

  it('picked from your packs: Fox picks resources the hikers here carry', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = opened('fox-with-a-specific-taste', {
        ash: { wood: 2, shell: 1 },
        birch: { fish: 1, salt: 1 },
      });
      for (const id of s.challenge!.rolls.options ?? [])
        expect(['wood', 'shell', 'fish', 'salt']).toContain(id);
      expect(s.challenge!.rolls.options).toHaveLength(3);
      void seed;
    }
  });

  it('a category: any mix of its resources', () => {
    const s = opened('rolled-ankle', { ash: { moss: 1, fur: 1, wood: 2 } });
    expect(why(s, gift('ash', 'wood', 2))).toMatch(/doesn’t fit/);
    expect(why(s, gift('ash', 'moss'), gift('ash', 'fur'))).toBeNull();
  });
});

describe('the punishments and the backup rule (24-challenges-reset.md, section 2)', () => {
  const card = { name: 'Test' };
  /** Applies a punishment to Ash at a tier, with the backup rule. */
  function punish(
    effects: Effect[],
    pack: Partial<Record<ResourceId, number>>,
    { tier = 1, x = 2, energy = 5, backup = 2 } = {},
  ) {
    const s = fixtureGame({ seed: 1 });
    const ash = hiker(s, 'ash');
    ash.inventory.resources = { ...pack };
    ash.stats.energy = energy;
    const injured = new Set<string>();
    applyEffects(
      s,
      {
        card,
        tileId: ash.tileId,
        targets: [ash],
        onTile: [ash],
        rolls: { x: { x, backup }, y: {}, includes: {}, luck: 0 },
        tier,
        backup: { energy: backup, injured },
      },
      effects,
    );
    return { ash: hiker(s, 'ash'), injured };
  }

  it('the punishment table: X by tier, and Tiers IV and V scale Tier III up', () => {
    const x = PX();
    expect(rangeAt(x, 1, 1)).toEqual([1, 2]);
    expect(rangeAt(x, 1, 2)).toEqual([2, 3]);
    expect(rangeAt(x, 1, 3)).toEqual([3, 4]);
    const T = BALANCE.challenges.tierScale;
    expect(rangeAt(x, 1, 4)).toEqual([Math.round(3 * T), Math.round(4 * T)]);
    // A cost number scales from the card's "From" tier.
    expect(rangeAt({ roll: 'x', range: [2, 2] }, 2, 3)).toEqual([3, 3]);
  });

  it('a category: X of it; what isn’t there costs 1 Energy each', () => {
    const r = punish([P.category('food')], { fish: 1, wood: 3 });
    expect(r.ash.inventory.resources.fish).toBeUndefined();
    expect(r.ash.inventory.resources.wood).toBe(3);
    expect(r.ash.stats.energy).toBe(4);
  });

  it('a hiker with none of a category pays Energy instead', () => {
    const r = punish([P.category('food')], { wood: 3 }, { x: 3 });
    expect(r.ash.stats.energy).toBe(2);
  });

  it('singles, big stacks, your most (half, rounded up; all of it from Tier III)', () => {
    expect(punish([P.singles], { wood: 1, clay: 1, fish: 3 }).ash.inventory.resources).toEqual({
      fish: 3,
    });
    expect(punish([P.bigStacks], { wood: 3, fish: 5, clay: 2 }).ash.inventory.resources).toEqual({
      wood: 2,
      fish: 4,
      clay: 2,
    });
    expect(punish([P.most], { fish: 5, wood: 2 }).ash.inventory.resources).toEqual({
      fish: 2,
      wood: 2,
    });
    expect(punish([P.most], { fish: 5, wood: 2 }, { tier: 3 }).ash.inventory.resources).toEqual({
      wood: 2,
    });
  });

  it('a punishment that takes nothing at all costs X Energy for the tier', () => {
    expect(punish([P.singles], { fish: 3 }, { backup: 3 }).ash.stats.energy).toBe(2);
    expect(punish([P.most], {}, { backup: 2 }).ash.stats.energy).toBe(3);
  });

  it('going below 0 Energy is 1 injury instead, once per challenge', () => {
    // Energy 1, lose 4: one injury (the game lifts their stats after it);
    // then 4 more for resources they don't have: no second injury.
    const r = punish([P.energy, P.random, P.energy], {}, { x: 4, energy: 1 });
    expect(r.ash.injuries).toBe(1);
    expect(r.injured.has('ash')).toBe(true);
    expect(r.ash.stats.energy).toBeGreaterThanOrEqual(1);
  });

  it('a cost card’s punishment uses the backup rule when it’s resolved', () => {
    // Snagged Pack: lose X random resources; Ash has none.
    const s = opened('snagged-pack', { birch: { wood: 1, clay: 1 } });
    const x = s.challenge!.rolls.x.x!;
    const before = hiker(s, 'ash').stats.energy;
    const after = run(
      s,
      resolve(fails('ash'), pays('birch', gift('birch', 'wood'), gift('birch', 'clay'))),
    );
    expect(hiker(after, 'ash').stats.energy).toBe(Math.max(0, before - x));
  });
});

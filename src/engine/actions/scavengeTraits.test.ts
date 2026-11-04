import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { scavengeSetup } from '../scavenge/setup';
import { fixtureGame, fixtureHiker, hiker, place, run } from '../test/fixtures';
import type { GameState, ScavengeCard } from '../types';

/** Ash (with the given traits) and Birch on tile L, a Forest tile, in the morning. */
function withTraits(...traits: string[]): GameState {
  const s = fixtureGame({
    seed: 3,
    hikers: [fixtureHiker('ash', traits), fixtureHiker('birch'), fixtureHiker('cedar')],
  });
  place(s, 'ash', 'L', { morale: 5 });
  place(s, 'birch', 'L', { morale: 5 });
  return s;
}

const setupOf = (s: GameState, id = 'ash') => scavengeSetup(s, hiker(s, id));

/** Test setup only: lays a chosen card face up as the first card of an open scavenge. */
function openWith(
  s: GameState,
  card: Partial<ScavengeCard> & Pick<ScavengeCard, 'type'>,
  id = 'ash',
) {
  const open = run(s, { type: 'scavenge', hikerId: id });
  if (!open.scavenge) throw new Error('no deal');
  open.scavenge.cards[0] = { rarity: 'common', node: 'forest', ...card, flipped: true };
  return open;
}

describe('scavenging traits', () => {
  it('Forager sees 1 extra card', () => {
    expect(setupOf(withTraits('forager')).count).toBe(BALANCE.scavenge.cards + 1);
    expect(
      run(withTraits('forager'), { type: 'scavenge', hikerId: 'ash' }).scavenge?.cards,
    ).toHaveLength(4);
  });

  it('a Finder makes its node likelier, and a Hound much likelier with more ×2 results', () => {
    expect(setupOf(withTraits('riverFinder')).nodeWeight).toEqual({ river: 1.5 });
    const hound = setupOf(withTraits('rockHound'));
    expect(hound.nodeWeight).toEqual({ mountain: 3 });
    expect(hound.nodeTypeWeight).toEqual({ mountain: { x2: 2, wildX2: 2 } });
    expect(hound.bonuses[0]?.label).toBe(
      'Rock Hound: Mountain cards and ×2 results are much likelier',
    );
  });

  it('Archaeologist makes Item finds likelier', () => {
    expect(setupOf(withTraits('archaeologist')).typeWeight).toMatchObject({
      toolFind: 2,
      trinketFind: 2,
    });
  });

  it('Copydog takes 1 free extra for each hiker who scavenged here earlier today', () => {
    let s = withTraits('copydog');
    s = run(openWith(s, { type: 'resource', resources: ['moss'] }, 'birch'), {
      type: 'scavengeTake',
      card: 0,
    });
    expect(setupOf(s).bonusOffers).toEqual([{ source: 'Copydog', count: 1, appetiteEach: 0 }]);
    expect(setupOf(s).bonuses.at(-1)?.label).toBe(
      'Copydog: +1 bonus resource (Birch scavenged here today)',
    );

    const forestBefore = s.abundance.forest;
    const after = run(openWith(s, { type: 'resource', resources: ['wood'] }), {
      type: 'scavengeTake',
      card: 0,
    });
    expect(hiker(after, 'ash').inventory.resources.wood).toBe(2);
    expect(hiker(after, 'ash').stats.appetite).toBe(9);
    // The card's drain plus 1 for the bonus resource.
    expect(after.abundance.forest).toBe(forestBefore - 2);
    expect(after.log.find((e) => e.kind === 'scavenge' && e.hikerId === 'ash')).toMatchObject({
      bonus: 1,
    });
  });

  it('Copier’s extras are optional and cost 1 Appetite each', () => {
    let s = withTraits('copier');
    s = run(openWith(s, { type: 'resource', resources: ['moss'] }, 'birch'), {
      type: 'scavengeTake',
      card: 0,
    });
    const without = run(openWith(s, { type: 'resource', resources: ['wood'] }), {
      type: 'scavengeTake',
      card: 0,
    });
    expect(hiker(without, 'ash').inventory.resources.wood).toBe(1);
    expect(hiker(without, 'ash').stats.appetite).toBe(9);
    const withBonus = run(openWith(s, { type: 'resource', resources: ['wood'] }), {
      type: 'scavengeTake',
      card: 0,
      bonus: 1,
    });
    expect(hiker(withBonus, 'ash').inventory.resources.wood).toBe(2);
    expect(hiker(withBonus, 'ash').stats.appetite).toBe(8);
  });

  it('gives no bonus on a card without resources', () => {
    let s = withTraits('copydog');
    s = run(openWith(s, { type: 'resource', resources: ['moss'] }, 'birch'), {
      type: 'scavengeTake',
      card: 0,
    });
    const after = run(openWith(s, { type: 'caps', caps: 2 }), { type: 'scavengeTake', card: 0 });
    expect(after.caps).toBe(2);
    expect(hiker(after, 'ash').inventory.resources).toEqual({});
  });
});

describe('Gambler', () => {
  it('rerolls one flipped card a day, face up', () => {
    const open = run(
      withTraits('gambler'),
      { type: 'scavenge', hikerId: 'ash' },
      { type: 'scavengeFlip', cards: [0] },
    );
    const before = open.scavenge?.cards[0];
    const after = run(open, { type: 'scavengeReroll', card: 0 });
    const card = after.scavenge?.cards[0];
    expect(card?.flipped).toBe(true);
    expect(after.rng).not.toEqual(open.rng);
    expect(after.log.at(-1)).toMatchObject({ kind: 'ability', abilityId: 'gambler' });
    expect(card).toBeDefined();
    expect(before).toBeDefined();

    const again = run(after, { type: 'scavengeFlip', cards: [1] });
    expect(validateAction(again, { type: 'scavengeReroll', card: 1 })).toBe(
      'Gambler is used up today.',
    );
  });

  it('needs the card flipped, and the trait', () => {
    const open = run(withTraits('gambler'), { type: 'scavenge', hikerId: 'ash' });
    expect(validateAction(open, { type: 'scavengeReroll', card: 0 })).toBe('Flip that card first.');
    const plain = run(
      withTraits(),
      { type: 'scavenge', hikerId: 'ash' },
      { type: 'scavengeFlip', cards: [0] },
    );
    expect(validateAction(plain, { type: 'scavengeReroll', card: 0 })).toBe(
      'Nobody here can reroll a card.',
    );
  });

  it('isn’t used from the Abilities panel', () => {
    expect(
      validateAction(withTraits('gambler'), {
        type: 'useAbility',
        hikerId: 'ash',
        abilityId: 'gambler',
      }),
    ).toMatch(/scavenge window/);
  });
});

describe('debug tools for scavenging', () => {
  it('puts a trait in a slot', () => {
    const s = run(withTraits('leader'), {
      type: 'debug',
      op: { kind: 'setTrait', hikerId: 'ash', slot: 0, traitId: 'forager' },
    });
    expect(hiker(s, 'ash').slots[0]?.traitId).toBe('forager');
  });

  it('makes the next deal start with chosen card types, once', () => {
    let s = run(withTraits(), {
      type: 'debug',
      op: { kind: 'nextDeal', types: ['choiceX2', 'caps'] },
    });
    s = run(s, { type: 'scavenge', hikerId: 'ash' });
    expect(s.scavenge?.cards.slice(0, 2).map((c) => c.type)).toEqual(['choiceX2', 'caps']);
    expect(s.debugDeal).toBeUndefined();
  });
});

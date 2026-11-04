import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { scavengeSetup } from '../scavenge/setup';
import { END, fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { GameState } from '../types';

const START = BALANCE.abundance.start;

/** Ash on tile L (one Forest node) in the morning. */
function onForest(): GameState {
  const s = fixtureGame({ seed: 9 });
  place(s, 'ash', 'L');
  return s;
}

describe('Abundance overnight', () => {
  it('recovers every node nobody scavenged today, and not one that was', () => {
    const s = onForest();
    s.abundance = { forest: 5, river: 5, wildlife: 5, mountain: 10 };
    s.scavengedToday = [{ hikerId: 'ash', tileId: 'L', nodes: ['forest'] }];
    const next = run(toNight(s), END);
    expect(next.day).toBe(2);
    expect(next.abundance).toEqual({ forest: 5, river: 6, wildlife: 6, mountain: 10 });
    expect(next.log.find((e) => e.kind === 'recovered')).toMatchObject({
      nodes: ['river', 'wildlife'],
    });
  });
});

describe('low Abundance when scavenging', () => {
  it('warns about each low node on the tile', () => {
    const s = onForest();
    place(s, 'ash', 'L', { morale: 5 });
    s.section.tiles.L?.nodes.push({ type: 'river', revealed: true });
    s.abundance.river = BALANCE.abundance.lowAt;
    const setup = scavengeSetup(s, hiker(s, 'ash'));
    expect(setup.bonuses.map((b) => b.label)).toEqual([
      'River Abundance is low: fewer River cards',
    ]);
    expect(setup.count).toBe(BALANCE.scavenge.cards);
  });

  it('deals 1 fewer card and takes 1 Luck when everything here is low', () => {
    const s = onForest();
    place(s, 'ash', 'L', { morale: 5 });
    s.abundance.forest = 2;
    const setup = scavengeSetup(s, hiker(s, 'ash'));
    expect(setup.count).toBe(BALANCE.scavenge.cards - 1);
    expect(setup.luck).toBe(-1);
    expect(setup.bonuses.at(-1)?.label).toMatch(/running low/);
  });
});

describe('Tend', () => {
  it('restores a node on the tile and uses the phase', () => {
    const s = onForest();
    s.abundance.forest = 3;
    const after = run(s, { type: 'tend', hikerId: 'ash', node: 'forest' });
    expect(after.abundance.forest).toBe(3 + BALANCE.abundance.tend);
    expect(hiker(after, 'ash').acted).toBe(true);
    expect(after.log.at(-1)).toMatchObject({ kind: 'tend', node: 'forest', from: 3, to: 5 });
  });

  it('never goes above full', () => {
    const s = onForest();
    s.abundance.forest = BALANCE.abundance.max - 1;
    expect(run(s, { type: 'tend', hikerId: 'ash', node: 'forest' }).abundance.forest).toBe(
      BALANCE.abundance.max,
    );
  });

  it('says why it can’t', () => {
    const s = onForest();
    expect(validateAction(s, { type: 'tend', hikerId: 'ash', node: 'river' })).toMatch(
      /no River node/,
    );
    s.abundance.forest = BALANCE.abundance.max;
    expect(validateAction(s, { type: 'tend', hikerId: 'ash', node: 'forest' })).toMatch(
      /already full/,
    );
    expect(validateAction(fixtureGame(), { type: 'tend', hikerId: 'ash', node: 'forest' })).toMatch(
      /nothing to tend/,
    );
    const night = toNight(onForest());
    expect(validateAction(night, { type: 'tend', hikerId: 'ash', node: 'forest' })).toBe(
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

  it('returns a resource to nature, +1 to its node, as a free action', () => {
    const s = together();
    s.abundance.forest = 4;
    const after = run(s, { type: 'returnToNature', hikerId: 'ash', resource: 'wood' });
    expect(hiker(after, 'ash').inventory.resources).toEqual({ wood: 1 });
    expect(after.abundance.forest).toBe(5);
    expect(hiker(after, 'ash').acted).toBe(false);
  });

  it('starts every meter at the start value', () => {
    expect(fixtureGame().abundance).toEqual({
      forest: START,
      river: START,
      wildlife: START,
      mountain: START,
    });
  });
});

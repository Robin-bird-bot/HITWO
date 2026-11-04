import { describe, expect, it } from 'vitest';
import { moveAllCost, moveCost } from '../engine/costs';
import { bagSlots } from '../engine/inventory';
import { createGame } from '../engine/newGame';
import { fixtureGame, fixtureHiker, hiker, place, toNight } from '../engine/test/fixtures';
import type { Family } from '../engine/types';
import { STARTING_PARTY } from './characters';

const as = (id: string, family: Family, traits: string[] = []) => ({
  ...fixtureHiker(id, traits),
  family,
});

const party = () =>
  fixtureGame({
    hikers: [
      as('cat', 'cat'),
      as('human', 'human'),
      as('dog', 'dog', ['leader']),
      as('kit', 'cat'),
    ],
  });

describe('Cats move for free', () => {
  it('pay no Appetite to move alone, even on muddy lines or at night', () => {
    const s = party();
    expect(moveCost(s, 'cat', 'L')).toEqual({ appetite: 0, energy: 0, morale: 0 });
    place(s, 'cat', 'L');
    expect(moveCost(s, 'cat', 'M')).toEqual({ appetite: 0, energy: 0, morale: 0 });
    const night = toNight(party());
    expect(moveCost(night, 'cat', 'L')?.appetite).toBe(0);
  });

  it('still pay Energy and Morale extras', () => {
    const s = party();
    expect(moveCost(s, 'cat', 'M')).toEqual({ appetite: 0, energy: 1, morale: 0 });
    place(s, 'cat', 'M');
    expect(moveCost(s, 'cat', 'R')).toEqual({ appetite: 0, energy: 0, morale: 1 });
  });

  it('cost nothing extra to bring along', () => {
    const s = party();
    expect(moveAllCost(s, 'human', 'L', ['cat'])).toEqual([
      { hikerId: 'human', cost: { appetite: 1, energy: 0, morale: 0 } },
      { hikerId: 'cat', cost: { appetite: 0, energy: 0, morale: 0 } },
    ]);
  });

  it('still pay for the non-Cats they lead (Wyatt, Nov 3)', () => {
    const s = party();
    const costs = moveAllCost(s, 'cat', 'L', ['human', 'kit']);
    // Own crossing free, +1 for the human, +0 for the other Cat.
    expect(costs?.[0]).toEqual({ hikerId: 'cat', cost: { appetite: 1, energy: 0, morale: 0 } });
  });

  it('stack with Leader on the mover', () => {
    const s = party();
    // Dog leader: 1 own + 1 human + 0 cat − 1 Leader = 1.
    expect(moveAllCost(s, 'dog', 'L', ['human', 'cat'])?.[0]?.cost.appetite).toBe(1);
  });
});

describe('bag slots', () => {
  const game = createGame({ seed: 3, hikers: STARTING_PARTY });

  it('are 4 for a Human', () => {
    expect(bagSlots(game, hiker(game, 'hiker-1'))).toEqual({ base: 4, fromItems: [], total: 4 });
  });

  it('are 3 for a Cat', () => {
    expect(bagSlots(game, hiker(game, 'hiker-4')).total).toBe(3);
  });

  it('add 2 from a Backpack, marked with where they came from', () => {
    expect(bagSlots(game, hiker(game, 'hiker-2'))).toEqual({
      base: 4,
      fromItems: [{ itemUid: 'hiker-2-backpack', itemId: 'backpack', name: 'Backpack', count: 2 }],
      total: 6,
    });
  });
});

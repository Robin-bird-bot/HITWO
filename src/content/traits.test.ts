import { describe, expect, it } from 'vitest';
import { validateAction } from '../engine/applyAction';
import { moveAllCost } from '../engine/costs';
import { abilitiesFor } from '../engine/effects';
import { END, fixtureGame, fixtureHiker, hiker, place, run } from '../engine/test/fixtures';
import type { Action } from '../engine/types';

const party = (traitsByHiker: Record<string, string[]>) =>
  fixtureGame({
    hikers: ['ash', 'birch', 'cedar', 'dot'].map((id) => fixtureHiker(id, traitsByHiker[id] ?? [])),
  });

const stoic = (choice?: string): Action => ({
  type: 'useAbility',
  hikerId: 'ash',
  abilityId: 'stoic',
  ...(choice ? { choice } : {}),
});

describe('Leader', () => {
  it('makes moving the group cost 1 less Appetite', () => {
    const s = party({ ash: ['leader'] });
    expect(moveAllCost(s, 'ash', 'L', ['birch', 'cedar', 'dot'])?.[0]?.cost.appetite).toBe(3);
  });

  it('only helps when the Leader is the mover', () => {
    const s = party({ birch: ['leader'] });
    expect(moveAllCost(s, 'ash', 'L', ['birch'])?.[0]?.cost.appetite).toBe(2);
  });

  it('doesn’t change a plain move', () => {
    const s = run(party({ ash: ['leader'] }), { type: 'move', hikerId: 'ash', toTileId: 'L' });
    expect(hiker(s, 'ash').stats.appetite).toBe(9);
  });
});

describe('Stoic', () => {
  it('shows in the Abilities panel with its uses left', () => {
    const s = party({ ash: ['stoic'] });
    expect(abilitiesFor(s, hiker(s, 'ash')).map((a) => [a.ability.id, a.usesLeft])).toEqual([
      ['stoic', 1],
    ]);
    expect(abilitiesFor(s, hiker(s, 'birch'))).toEqual([]);
  });

  it('spends 2 Morale for 1 Energy or 1 Appetite, as a free action', () => {
    const s = party({ ash: ['stoic'] });
    place(s, 'ash', 'T', { energy: 6, morale: 8 });
    const after = run(s, stoic('energy'));
    const h = hiker(after, 'ash');
    expect(h.stats).toEqual({ energy: 7, appetite: 10, morale: 6 });
    expect(h.acted).toBe(false);
  });

  it('can be used once per day, and again the next day', () => {
    let s = party({ ash: ['stoic'] });
    place(s, 'ash', 'T', { appetite: 6 });
    s = run(s, stoic('appetite'));
    expect(validateAction(s, stoic('appetite'))).toBe('Stoic is used up today.');
    s = run(s, END);
    expect(validateAction(s, stoic('appetite'))).toBe('Stoic is used up today.');
    s = run(s, END, END);
    expect(s.day).toBe(2);
    expect(validateAction(s, stoic('appetite'))).toBeNull();
  });

  it('needs a choice and enough Morale', () => {
    const s = party({ ash: ['stoic'] });
    expect(validateAction(s, stoic())).toBe('Choose +1 Energy or +1 Appetite.');
    place(s, 'ash', 'T', { morale: 1 });
    expect(validateAction(s, stoic('energy'))).toBe('Needs 2 Morale.');
  });

  it('can spend Morale down to 0, which stops there with no injury (Wyatt, Nov 5)', () => {
    const s = party({ ash: ['stoic'] });
    place(s, 'ash', 'T', { energy: 4, morale: 2 });
    const h = hiker(run(s, stoic('energy')), 'ash');
    expect(h.injuries).toBe(0);
    expect(h.stats).toEqual({ energy: 5, appetite: 10, morale: 0 });
  });

  it('isn’t available to hikers without the trait', () => {
    const s = party({ ash: ['stoic'] });
    expect(
      validateAction(s, {
        type: 'useAbility',
        hikerId: 'birch',
        abilityId: 'stoic',
        choice: 'energy',
      }),
    ).toBe('Birch doesn’t have that ability.');
  });
});

describe('Extrinsic', () => {
  it('gains 1 Morale at the start of the day when sharing a tile', () => {
    const s = party({ ash: ['extrinsic'] });
    place(s, 'ash', 'T', { morale: 6 });
    const next = run(s, END, END, END);
    expect(hiker(next, 'ash').stats.morale).toBe(7);
  });

  it('loses 1 Morale at the start of the day when alone', () => {
    const s = party({ ash: ['extrinsic'] });
    place(s, 'ash', 'L', { morale: 6 });
    const next = run(s, END, END, END);
    expect(hiker(next, 'ash').stats.morale).toBe(5);
  });

  it('counts only active hikers as company', () => {
    const s = party({ ash: ['extrinsic'] });
    place(s, 'ash', 'L', { morale: 6 });
    place(s, 'birch', 'L');
    hiker(s, 'birch').status = 'passedOut';
    const next = run(s, END, END, END);
    expect(hiker(next, 'ash').stats.morale).toBe(5);
  });
});

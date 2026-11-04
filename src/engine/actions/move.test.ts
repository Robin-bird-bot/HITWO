import { describe, expect, it } from 'vitest';
import { validateAction } from '../applyAction';
import { moveAllCost, moveCost } from '../costs';
import { fixtureGame, hiker, place, run, toNight } from '../test/fixtures';
import type { Action } from '../types';

const move = (hikerId: string, toTileId: string): Action => ({ type: 'move', hikerId, toTileId });
const moveAll = (hikerId: string, toTileId: string, bring: string[]): Action => ({
  type: 'moveAll',
  hikerId,
  toTileId,
  bring,
});

describe('move costs by line', () => {
  it.each([
    ['normal', 'T', 'L', { appetite: 1, energy: 0, morale: 0 }],
    ['paved', 'T', 'R', { appetite: 0, energy: 0, morale: 0 }],
    ['steep', 'T', 'M', { appetite: 1, energy: 1, morale: 0 }],
    ['muddy', 'L', 'M', { appetite: 2, energy: 0, morale: 0 }],
    ['rough', 'M', 'R', { appetite: 1, energy: 0, morale: 1 }],
  ])('%s line', (_kind, from, to, expected) => {
    const s = fixtureGame();
    place(s, 'ash', from);
    expect(moveCost(s, 'ash', to)).toEqual(expected);
  });

  it('adds 1 Appetite at night', () => {
    const s = toNight(fixtureGame());
    expect(moveCost(s, 'ash', 'L')).toEqual({ appetite: 2, energy: 0, morale: 0 });
    expect(moveCost(s, 'ash', 'R')).toEqual({ appetite: 1, energy: 0, morale: 0 });
  });

  it('charges the hiker and moves them', () => {
    const s = run(fixtureGame(), move('ash', 'M'));
    const h = hiker(s, 'ash');
    expect(h.tileId).toBe('M');
    expect(h.stats).toEqual({ energy: 9, appetite: 9, morale: 10 });
    expect(h.acted).toBe(true);
  });
});

describe('move rules', () => {
  it('needs a line between the tiles', () => {
    expect(validateAction(fixtureGame(), move('ash', 'C'))).toBe(
      'That tile isn’t connected to this one.',
    );
  });

  it('allows one action per phase', () => {
    const s = run(fixtureGame(), move('ash', 'L'));
    expect(validateAction(s, move('ash', 'T'))).toBe('Ash has already acted this morning.');
  });

  it('stops Famished hikers', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 2 });
    expect(validateAction(s, move('ash', 'L'))).toMatch(/^Famished/);
  });

  it('lets Hungry (not Famished) hikers move alone', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 4 });
    expect(validateAction(s, move('ash', 'L'))).toBeNull();
  });

  it('stops Exhausted hikers in the day', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 3 });
    expect(validateAction(s, move('ash', 'L'))).toMatch(/^Exhausted/);
  });

  it('lets Fatigued hikers move in the day but only sleep at night', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 6 });
    expect(validateAction(s, move('ash', 'L'))).toBeNull();
    const night = toNight(s);
    expect(validateAction(night, move('ash', 'L'))).toMatch(/^Fatigued/);
    expect(validateAction(night, { type: 'sleep', hikerId: 'ash' })).toBeNull();
  });

  it('stops passed-out hikers', () => {
    const s = fixtureGame();
    hiker(s, 'ash').status = 'passedOut';
    expect(validateAction(s, move('ash', 'L'))).toBe('Ash has passed out.');
  });

  it('allows a cost that takes a stat to 0, and the hiker takes the injury', () => {
    const s = fixtureGame();
    place(s, 'ash', 'M', { morale: 1 });
    const after = run(s, move('ash', 'R')); // rough: +1 Morale
    const h = hiker(after, 'ash');
    expect(h.injuries).toBe(1);
    expect(h.stats.morale).toBe(5);
  });
});

describe('Move All', () => {
  it('costs the mover 1 + 1 per hiker brought: bringing 3 costs 4', () => {
    const s = fixtureGame();
    const costs = moveAllCost(s, 'ash', 'L', ['birch', 'cedar', 'dot']);
    expect(costs?.[0]).toEqual({ hikerId: 'ash', cost: { appetite: 4, energy: 0, morale: 0 } });
    for (const c of costs?.slice(1) ?? []) {
      expect(c.cost).toEqual({ appetite: 0, energy: 0, morale: 0 });
    }
  });

  it('makes every hiker who crosses pay their own line extra', () => {
    const steep = moveAllCost(fixtureGame(), 'ash', 'M', ['birch']);
    expect(steep).toEqual([
      { hikerId: 'ash', cost: { appetite: 2, energy: 1, morale: 0 } },
      { hikerId: 'birch', cost: { appetite: 0, energy: 1, morale: 0 } },
    ]);

    const s = fixtureGame();
    place(s, 'ash', 'L');
    place(s, 'birch', 'L');
    expect(moveAllCost(s, 'ash', 'M', ['birch'])).toEqual([
      { hikerId: 'ash', cost: { appetite: 3, energy: 0, morale: 0 } },
      { hikerId: 'birch', cost: { appetite: 1, energy: 0, morale: 0 } },
    ]);

    place(s, 'ash', 'M');
    place(s, 'birch', 'M');
    expect(moveAllCost(s, 'ash', 'R', ['birch'])).toEqual([
      { hikerId: 'ash', cost: { appetite: 2, energy: 0, morale: 1 } },
      { hikerId: 'birch', cost: { appetite: 0, energy: 0, morale: 1 } },
    ]);
  });

  it('makes every hiker who crosses pay the night extra', () => {
    const s = toNight(fixtureGame());
    expect(moveAllCost(s, 'ash', 'L', ['birch'])).toEqual([
      { hikerId: 'ash', cost: { appetite: 3, energy: 0, morale: 0 } },
      { hikerId: 'birch', cost: { appetite: 1, energy: 0, morale: 0 } },
    ]);
  });

  it('on a paved line, charges only the per-hiker cost (TODO(wyatt) in balance.ts)', () => {
    expect(moveAllCost(fixtureGame(), 'ash', 'R', ['birch'])?.[0]?.cost.appetite).toBe(1);
  });

  it('moves everyone and uses their actions', () => {
    const s = run(fixtureGame(), moveAll('ash', 'L', ['birch', 'cedar']));
    for (const id of ['ash', 'birch', 'cedar']) {
      expect(hiker(s, id).tileId).toBe('L');
      expect(hiker(s, id).acted).toBe(true);
    }
    expect(hiker(s, 'dot').tileId).toBe('T');
    expect(hiker(s, 'ash').stats.appetite).toBe(7);
    expect(hiker(s, 'birch').stats.appetite).toBe(10);
  });

  it('stops a Hungry mover', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 5 });
    expect(validateAction(s, moveAll('ash', 'L', ['birch']))).toMatch(/^Hungry/);
  });

  it('needs at least one hiker to bring', () => {
    expect(validateAction(fixtureGame(), moveAll('ash', 'L', []))).toBe(
      'Pick at least one hiker to bring along.',
    );
  });

  it('only brings hikers on the same tile who haven’t acted', () => {
    const s = fixtureGame();
    place(s, 'birch', 'L');
    expect(validateAction(s, moveAll('ash', 'L', ['birch']))).toBe('Birch isn’t on this tile.');

    const acted = run(fixtureGame(), move('birch', 'L'), move('cedar', 'L'));
    place(acted, 'ash', 'L');
    expect(validateAction(acted, moveAll('ash', 'T', ['birch']))).toBe(
      'Birch has already acted this morning.',
    );
  });

  it('can bring Hungry and Famished hikers, but not Exhausted ones in the day', () => {
    const s = fixtureGame();
    place(s, 'birch', 'T', { appetite: 2 });
    expect(validateAction(s, moveAll('ash', 'L', ['birch']))).toBeNull();
    place(s, 'birch', 'T', { appetite: 10, energy: 3 });
    expect(validateAction(s, moveAll('ash', 'L', ['birch']))).toMatch(
      /^Birch can’t come along\. Exhausted/,
    );
  });
});

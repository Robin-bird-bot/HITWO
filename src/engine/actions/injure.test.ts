import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { validateAction } from '../applyAction';
import { addInjury } from '../stats';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action } from '../types';
import { withRetiredCards } from '../test/retiredChallenges';

// The engine's mechanics are tested on the cards they were written for (retired Nov 26).
withRetiredCards();

const injure = (hikerId: string): Action => ({ type: 'submitToInjury', hikerId });
const LINE = BALANCE.injuries.raiseStatsBelowTo;

describe('submit to injury (Wyatt, Nov 14)', () => {
  it('gives one injury and raises every stat below the line, like any injury', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 2, appetite: 1, morale: 8 });
    const after = run(s, injure('ash'));
    const ash = hiker(after, 'ash');
    expect(ash.injuries).toBe(1);
    expect(ash.stats).toEqual({ energy: LINE, appetite: LINE, morale: 8 });
    expect(after.log.at(-3)).toMatchObject({ kind: 'injury', cause: 'their choice' });
  });

  it('is a free action: the hiker can still act this phase', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 1 });
    const after = run(s, injure('ash'));
    expect(hiker(after, 'ash').acted).toBe(false);
    // Famished at 1, they couldn't move; now they can.
    expect(validateAction(s, { type: 'move', hikerId: 'ash', toTileId: 'L' })).toMatch(/Famished/);
    expect(validateAction(after, { type: 'move', hikerId: 'ash', toTileId: 'L' })).toBeNull();
  });

  it('the third injury passes the hiker out', () => {
    const s = fixtureGame();
    hiker(s, 'ash').injuries = BALANCE.injuries.passOutAt - 1;
    const after = run(s, injure('ash'));
    expect(hiker(after, 'ash').status).toBe('passedOut');
    expect(validateAction(after, injure('ash'))).toBe('Ash can’t do that right now.');
  });

  it('isn’t stopped by something that blocks injuries, since the hiker chose it', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T');
    const star = run(s, {
      type: 'debug',
      op: { kind: 'giveItem', hikerId: 'ash', itemId: 'star', quality: 3 },
    });
    const item = hiker(star, 'ash').inventory.bag.find((i) => i.itemId === 'star');
    expect(item).toBeDefined();
    const lit = run(star, {
      type: 'useItem',
      hikerId: 'ash',
      itemUid: item?.uid ?? '',
      targetId: 'ash',
    });
    // The Star stops an injury from anything else…
    const other = structuredClone(lit);
    addInjury(other, hiker(other, 'ash'), 'a fall');
    expect(hiker(other, 'ash').injuries).toBe(0);
    // …but not one the hiker chose.
    const after = run(lit, injure('ash'));
    expect(hiker(after, 'ash').injuries).toBe(1);
  });

  it('waits while a challenge is open', () => {
    const s = fixtureGame({ challenges: true });
    place(s, 'ash', 'L');
    const open = run(s, {
      type: 'debug',
      op: { kind: 'openChallenge', cardId: 'freeagle', tileId: 'L' },
    });
    expect(validateAction(open, injure('ash'))).toBe('Finish the challenge first.');
  });
});

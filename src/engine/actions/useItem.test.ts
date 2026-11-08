import { describe, expect, it } from 'vitest';
import { validateAction } from '../applyAction';
import { addCondition, hasCondition } from '../conditions';
import { addInjury } from '../stats';
import { END, fixtureGame, hiker, place, run } from '../test/fixtures';
import type { Action, GameState } from '../types';

/** Puts an item in a hiker's bag; returns its uid. */
function give(s: GameState, id: string, itemId: string): string {
  const uid = `t-${itemId}-${hiker(s, id).inventory.bag.length}`;
  hiker(s, id).inventory.bag.push({ uid, itemId });
  return uid;
}

const use = (hikerId: string, itemUid: string, targetId: string, conditionId?: string): Action => ({
  type: 'useItem',
  hikerId,
  itemUid,
  targetId,
  ...(conditionId ? { conditionId } : {}),
});

function knockOut(s: GameState, id: string) {
  for (let i = 0; i < 3; i++) addInjury(s, hiker(s, id), 'test');
}

describe('Bandages', () => {
  it('wake a passed-out hiker on the same tile, and are used up', () => {
    let s = fixtureGame();
    knockOut(s, 'birch');
    const uid = give(s, 'ash', 'bandages');
    s = run(s, use('ash', uid, 'birch'));
    expect(hiker(s, 'birch')).toMatchObject({ status: 'active', injuries: 2 });
    expect(hiker(s, 'ash').inventory.bag).toEqual([]);
    expect(hiker(s, 'ash').acted).toBe(false); // a free action
    expect(s.log.slice(-3).map((e) => e.kind)).toEqual(['used', 'healed', 'woke']);
  });

  it('cure Bleeding, so it never turns into an injury', () => {
    let s = fixtureGame();
    addCondition(s, hiker(s, 'ash'), 'bleeding', 1, 'phases', 'test');
    s = run(s, use('ash', give(s, 'ash', 'bandages'), 'ash'), END, END);
    expect(hasCondition(hiker(s, 'ash'), 'bleeding')).toBe(false);
    expect(hiker(s, 'ash').injuries).toBe(0);
  });

  it('are refused when there’s nothing to cure, and kept', () => {
    const s = fixtureGame();
    const uid = give(s, 'ash', 'bandages');
    expect(validateAction(s, use('ash', uid, 'birch'))).toBe(
      'Bandages wouldn’t help Birch right now.',
    );
  });
});

describe('Crutches', () => {
  it('holds off an injury for 3 days, then it comes back', () => {
    let s = fixtureGame();
    addInjury(s, hiker(s, 'ash'), 'test');
    addInjury(s, hiker(s, 'ash'), 'test');
    s = run(s, use('birch', give(s, 'birch', 'crutches'), 'ash'));
    expect(hiker(s, 'ash').injuries).toBe(1);
    expect(hiker(s, 'ash').conditions.find((c) => c.id === 'splinted')).toMatchObject({
      remaining: 3,
      unit: 'days',
    });
    for (let day = 0; day < 3; day++) s = run(s, END, END, END);
    expect(hiker(s, 'ash').injuries).toBe(2);
    expect(hasCondition(hiker(s, 'ash'), 'splinted')).toBe(false);
  });

  it('only one at a time', () => {
    let s = fixtureGame();
    addInjury(s, hiker(s, 'ash'), 'test');
    addInjury(s, hiker(s, 'ash'), 'test');
    s = run(s, use('ash', give(s, 'ash', 'crutches'), 'ash'));
    expect(validateAction(s, use('ash', give(s, 'ash', 'crutches'), 'ash'))).toBe(
      'Ash is already On Crutches.',
    );
  });
});

describe('Medkit and Bandaid', () => {
  it('a Medkit cures the one condition there is, and an injury', () => {
    let s = fixtureGame();
    addInjury(s, hiker(s, 'ash'), 'test');
    addCondition(s, hiker(s, 'ash'), 'sluggish', 2, 'days', 'test');
    s = run(s, use('ash', give(s, 'ash', 'medkit'), 'ash'));
    expect(hiker(s, 'ash').injuries).toBe(0);
    expect(hasCondition(hiker(s, 'ash'), 'sluggish')).toBe(false);
  });

  it('asks which condition when there are several, and only negative ones', () => {
    let s = fixtureGame();
    addCondition(s, hiker(s, 'ash'), 'sluggish', 2, 'days', 'test');
    addCondition(s, hiker(s, 'ash'), 'strained', 2, 'days', 'test');
    addCondition(s, hiker(s, 'ash'), 'lucky', 2, 'days', 'test');
    const uid = give(s, 'ash', 'bandaid');
    expect(validateAction(s, use('ash', uid, 'ash'))).toBe('Pick which condition to cure.');
    expect(validateAction(s, use('ash', uid, 'ash', 'lucky'))).toBe(
      'Ash doesn’t have that condition.',
    );
    s = run(s, use('ash', uid, 'ash', 'strained'));
    expect(
      hiker(s, 'ash')
        .conditions.map((c) => c.id)
        .sort(),
    ).toEqual(['lucky', 'sluggish']);
  });

  it('Bandaid cures a condition but doesn’t wake anyone', () => {
    let s = fixtureGame();
    knockOut(s, 'birch');
    const uid = give(s, 'ash', 'bandaid');
    expect(validateAction(s, use('ash', uid, 'birch'))).toBe(
      'Bandaid wouldn’t help Birch right now.',
    );
    addCondition(s, hiker(s, 'birch'), 'sluggish', 2, 'days', 'test');
    s = run(s, use('ash', uid, 'birch'));
    expect(hiker(s, 'birch').status).toBe('passedOut');
    expect(hasCondition(hiker(s, 'birch'), 'sluggish')).toBe(false);
  });
});

describe('who can use what', () => {
  it('only on hikers on the same tile', () => {
    const s = fixtureGame();
    addInjury(s, hiker(s, 'birch'), 'test');
    place(s, 'birch', 'L');
    expect(validateAction(s, use('ash', give(s, 'ash', 'bandages'), 'birch'))).toBe(
      'Birch isn’t on this tile.',
    );
  });

  it('not by a passed-out hiker, and not on one who left', () => {
    const s = fixtureGame();
    knockOut(s, 'ash');
    expect(validateAction(s, use('ash', give(s, 'ash', 'bandages'), 'ash'))).toBe(
      'Ash has passed out.',
    );
    hiker(s, 'cedar').status = 'abandoned';
    hiker(s, 'cedar').injuries = 1;
    expect(validateAction(s, use('birch', give(s, 'birch', 'bandages'), 'cedar'))).toBe(
      'That hiker isn’t on the trail.',
    );
  });

  it('items without a use can’t be used yet', () => {
    const s = fixtureGame();
    expect(validateAction(s, use('ash', give(s, 'ash', 'phone'), 'ash'))).toBe(
      'Phone can’t be used yet.',
    );
  });

  it('the debug panel can give any item', () => {
    const s = run(fixtureGame(), {
      type: 'debug',
      op: { kind: 'giveItem', hikerId: 'ash', itemId: 'crutches' },
    });
    expect(hiker(s, 'ash').inventory.bag.map((i) => i.itemId)).toEqual(['crutches']);
  });
});

import { describe, expect, it } from 'vitest';
import { validateAction } from '../applyAction';
import { isHikeOver } from '../health';
import { addInjury } from '../stats';
import { fixtureGame, hiker, place, run } from '../test/fixtures';
import type { GameState } from '../types';

function knockOut(s: GameState, id: string) {
  for (let i = 0; i < 3; i++) addInjury(s, hiker(s, id), 'test');
}

describe('taking things from a passed-out hiker', () => {
  it('an active hiker on the same tile can take a resource or an item', () => {
    let s = fixtureGame();
    knockOut(s, 'birch');
    hiker(s, 'birch').inventory.resources = { wood: 2 };
    hiker(s, 'birch').inventory.bag = [{ uid: 'b1', itemId: 'medkit' }];
    s = run(
      s,
      { type: 'give', fromId: 'birch', toId: 'ash', resource: 'wood' },
      { type: 'give', fromId: 'birch', toId: 'ash', itemUid: 'b1' },
    );
    expect(hiker(s, 'ash').inventory.resources.wood).toBe(1);
    expect(hiker(s, 'ash').inventory.bag.map((i) => i.itemId)).toEqual(['medkit']);
    expect(hiker(s, 'ash').acted).toBe(false);
    expect(s.log.at(-1)).toMatchObject({ kind: 'give', fromId: 'birch', toId: 'ash', taken: true });
  });

  it('not from another tile, and not by another passed-out hiker', () => {
    const s = fixtureGame();
    knockOut(s, 'birch');
    knockOut(s, 'cedar');
    hiker(s, 'birch').inventory.resources = { wood: 1 };
    expect(
      validateAction(s, { type: 'give', fromId: 'birch', toId: 'cedar', resource: 'wood' }),
    ).toBe('Cedar has passed out.');
    place(s, 'ash', 'L');
    expect(
      validateAction(s, { type: 'give', fromId: 'birch', toId: 'ash', resource: 'wood' }),
    ).toBe('Ash isn’t on this tile.');
  });
});

describe('abandoning by choice', () => {
  it('any hiker, any time: they leave with what they carry', () => {
    let s = fixtureGame();
    hiker(s, 'ash').inventory.resources = { wood: 2 };
    s = run(s, { type: 'abandon', hikerId: 'ash' });
    expect(hiker(s, 'ash').status).toBe('abandoned');
    expect(hiker(s, 'ash').inventory.resources).toEqual({ wood: 2 });
    expect(s.log.at(-1)).toMatchObject({ kind: 'abandoned', hikerId: 'ash', why: 'choice' });
    expect(validateAction(s, { type: 'abandon', hikerId: 'ash' })).toBe(
      'Ash has already left the hike.',
    );
  });

  it('a passed-out hiker too, which ends their carry', () => {
    let s = fixtureGame();
    knockOut(s, 'birch');
    s = run(s, { type: 'pickUp', carrierId: 'ash', hikerId: 'birch' });
    s = run(s, { type: 'abandon', hikerId: 'birch' });
    expect(hiker(s, 'birch').status).toBe('abandoned');
    expect(hiker(s, 'ash').carrying).toBeUndefined();
  });

  it('abandoning the last hiker who can act ends the hike', () => {
    let s = fixtureGame();
    knockOut(s, 'birch');
    for (const id of ['cedar', 'dot']) s = run(s, { type: 'abandon', hikerId: id });
    expect(isHikeOver(s)).toBe(false);
    s = run(s, { type: 'abandon', hikerId: 'ash' });
    expect(isHikeOver(s)).toBe(true);
    expect(s.log.at(-1)).toMatchObject({ kind: 'hikeOver', day: 1 });
  });
});

import { describe, expect, it } from 'vitest';
import { applyAction } from '../../engine';
import { fixtureGame, hiker, place } from '../../engine/test/fixtures';
import { bringChoices, popupAction } from '../game/movePlan';
import { canDragHiker, hikerDropTiles } from './dropRules';

describe('dragging a hiker (Nov 14 update)', () => {
  it('lights up only the connected tiles the hiker can move to', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    // L connects to T, M and the checkpoint C; R isn't connected.
    expect([...hikerDropTiles(s, 'ash')].sort()).toEqual(['C', 'M', 'T']);
  });

  it('lights up nothing once the hiker has acted, or when they can’t be picked up', () => {
    const s = fixtureGame();
    place(s, 'ash', 'L');
    hiker(s, 'ash').acted = true;
    expect(hikerDropTiles(s, 'ash').size).toBe(0);
    hiker(s, 'birch').status = 'passedOut';
    expect(canDragHiker(hiker(s, 'birch'))).toBe(false);
    expect(hikerDropTiles(s, 'birch').size).toBe(0);
    expect(canDragHiker(hiker(s, 'cedar'))).toBe(true);
  });

  it('an Exhausted hiker (who can only sleep) lights up nothing', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 1 });
    expect(hikerDropTiles(s, 'ash').size).toBe(0);
  });
});

describe('the move pop-up', () => {
  it('lists the others on the tile, and why one can’t come', () => {
    const s = fixtureGame();
    for (const id of ['ash', 'birch', 'cedar']) place(s, id, 'L');
    hiker(s, 'cedar').acted = true;
    const choices = bringChoices(s, hiker(s, 'ash'), 'M');
    expect(choices.map((c) => [c.hiker.id, c.reason === null])).toEqual([
      ['birch', true],
      ['cedar', false],
    ]);
    expect(choices[1]?.reason).toMatch(/already acted/);
  });

  it('Move all moves only the checked hikers', () => {
    let s = fixtureGame();
    for (const id of ['ash', 'birch', 'cedar']) place(s, id, 'L');
    s = applyAction(s, popupAction(hiker(s, 'ash'), 'M', ['birch']));
    expect(hiker(s, 'ash').tileId).toBe('M');
    expect(hiker(s, 'birch').tileId).toBe('M');
    expect(hiker(s, 'cedar').tileId).toBe('L');
    expect(hiker(s, 'cedar').acted).toBe(false);
  });

  it('Move moves the hiker alone', () => {
    let s = fixtureGame();
    for (const id of ['ash', 'birch']) place(s, id, 'L');
    s = applyAction(s, popupAction(hiker(s, 'ash'), 'M', null));
    expect(hiker(s, 'ash').tileId).toBe('M');
    expect(hiker(s, 'birch').tileId).toBe('L');
  });
});

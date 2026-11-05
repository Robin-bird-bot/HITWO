import { describe, expect, it } from 'vitest';
import { validateAction } from './applyAction';
import { addCondition } from './conditions';
import { blockedByStatus } from './status';
import { END, fixtureGame, hiker, run, toNight } from './test/fixtures';

describe('condition timing (Phase 5)', () => {
  it('lasts the next full phase when given "1 phase"', () => {
    const s = fixtureGame();
    addCondition(s, hiker(s, 'ash'), 'frozen', 1, 'phases', 'test');
    const afternoon = run(s, END);
    expect(hiker(afternoon, 'ash').conditions).toMatchObject([{ id: 'frozen', remaining: 1 }]);
    const night = run(afternoon, END);
    expect(hiker(night, 'ash').conditions).toEqual([]);
    expect(night.log.some((e) => e.kind === 'conditionEnded')).toBe(true);
  });

  it('ticks day and night conditions at camp', () => {
    const s = fixtureGame();
    addCondition(s, hiker(s, 'ash'), 'strained', 2, 'days', 'test');
    const day2 = run(toNight(s), END);
    expect(hiker(day2, 'ash').conditions).toMatchObject([{ id: 'strained', remaining: 1 }]);
  });

  it('starts the follow-on condition when one ends (Hangry, then Nauseous)', () => {
    const s = fixtureGame();
    addCondition(s, hiker(s, 'ash'), 'hangry', 1, 'phases', 'test', {
      then: { id: 'nauseous', remaining: 2, unit: 'days' },
    });
    const later = run(s, END, END);
    expect(hiker(later, 'ash').conditions).toMatchObject([
      { id: 'nauseous', remaining: 2, unit: 'days' },
    ]);
  });

  it('keeps the longer time when the same condition lands again', () => {
    const s = fixtureGame();
    const ash = hiker(s, 'ash');
    addCondition(s, ash, 'bored', 1, 'days', 'test');
    addCondition(s, ash, 'bored', 3, 'days', 'test');
    addCondition(s, ash, 'bored', 2, 'days', 'test');
    expect(ash.conditions).toMatchObject([{ id: 'bored', remaining: 3 }]);
  });

  it('turns Wet into Soaked when Wet lands again, for the longer time (Wyatt, Nov 5)', () => {
    const s = fixtureGame();
    const ash = hiker(s, 'ash');
    addCondition(s, ash, 'wet', 2, 'days', 'test');
    addCondition(s, ash, 'wet', 1, 'days', 'test');
    expect(ash.conditions).toMatchObject([{ id: 'soaked', remaining: 6, unit: 'phases' }]);
  });
});

describe('Frozen', () => {
  it('stops moving, and being brought along, and shows red', () => {
    const s = fixtureGame();
    addCondition(s, hiker(s, 'ash'), 'frozen', 2, 'phases', 'test');
    const move = { type: 'move', hikerId: 'ash', toTileId: 'L' } as const;
    expect(validateAction(s, move)).toBe('Frozen: can’t move for 2 more phases.');
    expect(blockedByStatus(s, move)).toMatch(/^Frozen/);
    expect(
      validateAction(s, { type: 'moveAll', hikerId: 'birch', toTileId: 'L', bring: ['ash'] }),
    ).toMatch(/Frozen: can’t be moved/);
    expect(validateAction(s, { type: 'move', hikerId: 'birch', toTileId: 'L' })).toBeNull();
  });
});

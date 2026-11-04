import { describe, expect, it } from 'vitest';
import { changeStat } from './stats';
import { fixtureGame, hiker, place } from './test/fixtures';
import { isExhausted, isFamished, isFatigued, isHungry, thresholdStates } from './thresholds';

describe('threshold states', () => {
  it.each([
    [6, false, false],
    [5, true, false],
    [3, true, false],
    [2, true, true],
    [1, true, true],
  ])('Appetite %i: Hungry %s, Famished %s', (appetite, hungry, famished) => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { appetite });
    expect(isHungry(hiker(s, 'ash'))).toBe(hungry);
    expect(isFamished(hiker(s, 'ash'))).toBe(famished);
  });

  it.each([
    [7, false, false],
    [6, true, false],
    [4, true, false],
    [3, true, true],
  ])('Energy %i: Fatigued %s, Exhausted %s', (energy, fatigued, exhausted) => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy });
    expect(isFatigued(hiker(s, 'ash'))).toBe(fatigued);
    expect(isExhausted(hiker(s, 'ash'))).toBe(exhausted);
  });

  it('are worked out from the stats, not stored', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { appetite: 2, energy: 3 });
    expect(thresholdStates(hiker(s, 'ash'))).toEqual([
      'hungry',
      'famished',
      'fatigued',
      'exhausted',
    ]);
    place(s, 'ash', 'T', { appetite: 10, energy: 10 });
    expect(thresholdStates(hiker(s, 'ash'))).toEqual([]);
  });
});

describe('changeStat', () => {
  it('stops gains at 10', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 9 });
    changeStat(s, hiker(s, 'ash'), 'energy', 3, 'test');
    expect(hiker(s, 'ash').stats.energy).toBe(10);
  });

  it('gives an injury at 0 and raises every stat below 5 to 5', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 2, appetite: 1, morale: 7 });
    changeStat(s, hiker(s, 'ash'), 'appetite', -3, 'test');
    const h = hiker(s, 'ash');
    expect(h.injuries).toBe(1);
    expect(h.stats).toEqual({ energy: 5, appetite: 5, morale: 7 });
    expect(h.status).toBe('active');
  });

  it('resolves changes one at a time, so a later drop may stop short of 0', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { energy: 1, appetite: 1 });
    const h = hiker(s, 'ash');
    changeStat(s, h, 'energy', -2, 'no sleep'); // 0 → injury → both stats raised to 5
    changeStat(s, h, 'appetite', -1, 'end of day'); // 5 → 4
    expect(h.injuries).toBe(1);
    expect(h.stats.energy).toBe(5);
    expect(h.stats.appetite).toBe(4);
  });

  it('makes the hiker pass out on the 3rd injury', () => {
    const s = fixtureGame();
    const h = hiker(s, 'ash');
    h.injuries = 2;
    changeStat(s, h, 'morale', -10, 'test');
    expect(h.injuries).toBe(3);
    expect(h.status).toBe('passedOut');
    expect(s.log.map((e) => e.kind)).toContain('passedOut');
  });

  it('logs each change with its cause', () => {
    const s = fixtureGame();
    changeStat(s, hiker(s, 'ash'), 'morale', -1, 'Rough line');
    expect(s.log.at(-1)).toMatchObject({
      kind: 'stat',
      hikerId: 'ash',
      stat: 'morale',
      from: 10,
      to: 9,
      cause: 'Rough line',
      day: 1,
      phase: 'morning',
    });
  });
});

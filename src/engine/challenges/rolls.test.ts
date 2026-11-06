import { describe, expect, it } from 'vitest';
import { CARDS } from '../../content/challenges';
import { seedRng } from '../rng';
import { fixtureGame, hiker, place } from '../test/fixtures';
import { amount, rollCard, rollValue, scaledRange } from './rolls';
import type { RollDef } from './types';

const X = (min: number, max: number, reverse = false): RollDef => ({
  roll: 'x',
  range: [min, max],
  ...(reverse ? { reverse: true as const } : {}),
});

const average = (def: RollDef, luck: number, n = 20000) => {
  const rng = seedRng(17);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += rollValue(rng, def, luck);
  return sum / n;
};

describe('rolling X and Y', () => {
  it('stays in its range, and gives the same rolls for the same seed', () => {
    const a = seedRng(5);
    const b = seedRng(5);
    for (let i = 0; i < 500; i++) {
      const v = rollValue(a, X(2, 4), 0);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(4);
      expect(rollValue(b, X(2, 4), 0)).toBe(v);
    }
  });

  it('is even at Luck 0', () => {
    expect(average(X(1, 3), 0)).toBeCloseTo(2, 1);
  });

  it('leans toward the low (good) end with good Luck, and the high end with bad Luck', () => {
    expect(average(X(1, 3), 2)).toBeLessThan(1.8);
    expect(average(X(1, 3), -2)).toBeGreaterThan(2.2);
  });

  it('leans the other way for a range that runs backwards (Dangerous Current)', () => {
    expect(average(X(8, 12, true), 2)).toBeGreaterThan(10.3);
    expect(average(X(8, 12, true), -2)).toBeLessThan(9.7);
  });

  it('scales by TIER_SCALE one tier up, and shrinks a backwards range', () => {
    expect(scaledRange(X(2, 4), 1.5)).toEqual([3, 6]);
    expect(scaledRange(X(8, 12, true), 1.5)).toEqual([5, 8]);
    expect(scaledRange(X(2, 4), 1)).toEqual([2, 4]);
  });

  it('rolls X once for the card and Y once for each hiker', () => {
    const s = fixtureGame();
    const card = CARDS['split-path'];
    if (!card) throw new Error('no card');
    const rolls = rollCard(seedRng(3), card, s.hikers);
    expect(Object.keys(rolls.x).sort()).toEqual(['energy', 'morale']);
    expect(Object.keys(rolls.y)).toEqual(['ash', 'birch', 'cedar', 'dot']);
    for (const own of Object.values(rolls.y)) expect(Object.keys(own)).toEqual(['days']);
  });

  it('uses the average Luck of the hikers entering for X', () => {
    const s = fixtureGame();
    place(s, 'ash', 'T', { morale: 10 });
    place(s, 'birch', 'T', { morale: 0 });
    const card = CARDS['flies'];
    if (!card) throw new Error('no card');
    expect(rollCard(seedRng(1), card, [hiker(s, 'ash'), hiker(s, 'birch')]).luck).toBe(0);
    expect(rollCard(seedRng(1), card, [hiker(s, 'ash')]).luck).toBe(2);
  });

  it('includes a "(25%)" part about one time in four', () => {
    const card = CARDS['toupee-eagle'];
    if (!card) throw new Error('no card');
    const rng = seedRng(9);
    let included = 0;
    for (let i = 0; i < 4000; i++) if (rollCard(rng, card, []).includes.blind) included += 1;
    expect(included / 4000).toBeGreaterThan(0.22);
    expect(included / 4000).toBeLessThan(0.28);
  });

  it('picks Fox’s resources when revealed', () => {
    const card = CARDS['fox-with-a-specific-taste'];
    if (!card) throw new Error('no card');
    const rolls = rollCard(seedRng(2), card, []);
    expect(rolls.options).toHaveLength(rolls.x.options ?? 0);
  });

  it('reads amounts: fixed, rolled, and per thing on the tile', () => {
    const s = fixtureGame();
    const rolls = { x: { n: 3 }, y: { ash: { days: 2 } }, includes: {}, luck: 0 };
    const ash = hiker(s, 'ash');
    ash.injuries = 2;
    const ctx = { rolls, onTile: s.hikers, hiker: ash };
    expect(amount(4, ctx)).toBe(4);
    expect(amount('n', ctx)).toBe(3);
    expect(amount('days', ctx)).toBe(2);
    expect(amount({ base: 2, per: 'hikerOnTile' }, ctx)).toBe(8);
    expect(
      amount({ base: 1, per: 'twoHikersOnTile' }, { ...ctx, onTile: s.hikers.slice(0, 3) }),
    ).toBe(2);
    expect(amount({ base: 'n', per: 'injury', plus: true }, ctx)).toBe(5);
  });
});

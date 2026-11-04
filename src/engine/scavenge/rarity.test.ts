import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { seedRng } from '../rng';
import { RARITIES, type Rarity } from '../types';
import { clampLuck, moraleLuck, rarityOdds, rollRarity, stepDown } from './rarity';

const row = (luck: number) => {
  const found = BALANCE.scavenge.rarityByLuck.find((r) => r.luck === luck);
  if (!found) throw new Error(`no row for Luck ${luck}`);
  return found.odds;
};

const asPercent = (odds: Record<Rarity, number>) =>
  Object.fromEntries(RARITIES.map((r) => [r, Math.round(odds[r] * 1000) / 10]));

describe('rarity odds', () => {
  it('match the table at Luck 0 and +5 (Wyatt, Nov 4)', () => {
    expect(asPercent(rarityOdds(0))).toEqual(row(0));
    expect(asPercent(rarityOdds(5))).toEqual(row(5));
  });

  it('move a fifth of the way per point of Luck', () => {
    const at2 = rarityOdds(2);
    expect(at2.common).toBeCloseTo(0.65, 5); // 75 → 50, two fifths of the way
    expect(at2.uncommon).toBeCloseTo(0.19, 5);
    expect(at2.mythic).toBeCloseTo(0.007, 5);
  });

  it('push Common up to 85% at Luck −5', () => {
    expect(rarityOdds(-5).common).toBeCloseTo(0.85, 5);
    expect(rarityOdds(-1).common).toBeCloseTo(0.77, 5);
  });

  it('clamp beyond the ends', () => {
    expect(rarityOdds(9)).toEqual(rarityOdds(5));
    expect(rarityOdds(-9)).toEqual(rarityOdds(-5));
    expect(clampLuck(7)).toBe(5);
    expect(clampLuck(-8)).toBe(-5);
  });

  it('always add up to 1', () => {
    for (let luck = -6; luck <= 6; luck++) {
      const total = RARITIES.reduce((sum, r) => sum + rarityOdds(luck)[r], 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it.each([-5, 0, 2, 5])('match over 20,000 seeded rolls at Luck %i', (luck) => {
    const rng = seedRng(1234 + luck);
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
    const N = 20_000;
    for (let i = 0; i < N; i++) counts[rollRarity(rng, luck)]++;
    const odds = rarityOdds(luck);
    for (const r of RARITIES) {
      // Within 4 standard deviations of the expected count.
      const sd = Math.sqrt(N * odds[r] * (1 - odds[r]));
      expect(Math.abs(counts[r] - N * odds[r])).toBeLessThan(4 * sd + 1);
    }
  });

  it('step down one rarity, and Common stays Common', () => {
    expect(stepDown('mythic')).toBe('legendary');
    expect(stepDown('uncommon')).toBe('common');
    expect(stepDown('common')).toBe('common');
  });
});

describe('Luck from Morale (Wyatt, Nov 4: gentle)', () => {
  it.each([
    [10, 1],
    [7, 1],
    [6, 0],
    [4, 0],
    [3, -1],
    [0, -1],
  ])('Morale %i gives Luck %i', (morale, luck) => {
    expect(moraleLuck(morale)).toBe(luck);
  });
});

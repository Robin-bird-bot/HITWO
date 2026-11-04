import { describe, expect, it } from 'vitest';
import { applyModifiers } from './effects';

describe('applyModifiers (stacking order from the traits doc)', () => {
  it('buys a 10-cap item with Frugal (−1) and Thrifty (−50%) for 4', () => {
    const mods = [
      { source: 'Thrifty', percent: -50 },
      { source: 'Frugal', flat: -1 },
    ];
    // Flat first: 10 − 1 = 9, then halved = 4.5, rounded down for a cost.
    expect(applyModifiers(10, mods, 'cost')).toBe(4);
  });

  it('sells a 10-cap item with Charismatic (+2) and Non-Non-Profit (+50%) for 18', () => {
    const mods = [
      { source: 'Non-Non-Profit', percent: 50 },
      { source: 'Charismatic', flat: 2 },
    ];
    expect(applyModifiers(10, mods, 'gain')).toBe(18);
  });

  it('rounds gains up and costs down', () => {
    expect(applyModifiers(3, [{ source: 'x', percent: 50 }], 'gain')).toBe(5);
    expect(applyModifiers(3, [{ source: 'x', percent: 50 }], 'cost')).toBe(4);
  });

  it('never lets a cost go below 0', () => {
    expect(
      applyModifiers(
        1,
        [
          { source: 'Leader', flat: -1 },
          { source: 'Short', flat: -1 },
        ],
        'cost',
      ),
    ).toBe(0);
  });

  it('leaves the base alone with no modifiers', () => {
    expect(applyModifiers(4, [], 'cost')).toBe(4);
    expect(applyModifiers(4, [], 'gain')).toBe(4);
  });

  it('multiplies two percentages in turn (TODO(wyatt) in balance.ts)', () => {
    const mods = [
      { source: 'a', percent: -50 },
      { source: 'b', percent: -50 },
    ];
    expect(applyModifiers(8, mods, 'cost')).toBe(2);
  });
});

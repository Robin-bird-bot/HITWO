import { describe, expect, it } from 'vitest';
import { splitItemNames } from './itemNames';

describe('item names in text', () => {
  it('finds whole names, longest first', () => {
    expect(splitItemNames('Hiker 2 bought the Industrial Fertilizer (5 caps).')).toEqual([
      'Hiker 2 bought the ',
      { itemId: 'industrialFertilizer', name: 'Industrial Fertilizer' },
      ' (5 caps).',
    ]);
  });

  it('finds several, and leaves other words alone', () => {
    const parts = splitItemNames('Ash traded the Trampoline for the Dill Rolls.');
    expect(parts.filter((p) => typeof p !== 'string')).toEqual([
      { itemId: 'trampoline', name: 'Trampoline' },
      { itemId: 'dillRolls', name: 'Dill Rolls' },
    ]);
    expect(splitItemNames('Overnight, Abundance recovered (3 → 4).')).toEqual([
      'Overnight, Abundance recovered (3 → 4).',
    ]);
  });

  it('matches capitals only, and not inside other words', () => {
    expect(splitItemNames('a tent and a Tentacle')).toEqual(['a tent and a Tentacle']);
  });
});

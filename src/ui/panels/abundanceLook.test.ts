import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { abundanceColor, abundanceTip, emptyPercent } from './abundanceLook';

describe('the Abundance bar’s look', () => {
  it('goes green when full, gold at half, red when empty', () => {
    const max = BALANCE.abundance.max;
    expect(abundanceColor(max)).toBe('#7FC29B');
    expect(abundanceColor(max / 2)).toBe('#E9B44C');
    expect(abundanceColor(0)).toBe('#E5624A');
  });

  it('blends between them, and stays inside the range', () => {
    const quarter = abundanceColor(BALANCE.abundance.max / 4);
    expect(quarter).not.toBe('#E5624A');
    expect(quarter).not.toBe('#E9B44C');
    expect(abundanceColor(-5)).toBe('#E5624A');
    expect(abundanceColor(99)).toBe('#7FC29B');
  });

  it('says the Empty-card chance in its tooltip', () => {
    expect(emptyPercent(0)).toBe(40);
    expect(emptyPercent(BALANCE.abundance.max)).toBe(5);
    expect(abundanceTip(10)).toBe(
      'Abundance 10 of 20. Each resource card has a 23% chance to be Empty.',
    );
  });
});

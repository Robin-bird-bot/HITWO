import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../config/balance';
import { clearedShareOf, seedOf, uncovers } from './brush';

/** A cover's pixels with this share of its sampled pixels clear. */
function cover(share: number): Uint8ClampedArray {
  const samples = 100;
  const px = new Uint8ClampedArray(samples * 64);
  for (let k = 0; k < samples; k++) px[k * 64 + 3] = k < share * samples ? 0 : 255;
  return px;
}

describe('the brush reveal (35-ui-overhaul.md, section 5)', () => {
  it('uncovers at half clear, and not before', () => {
    expect(BALANCE.ui.overhaul.brush.clearShare).toBe(0.5);
    expect(clearedShareOf(cover(0.49))).toBeCloseTo(0.49);
    expect(uncovers(clearedShareOf(cover(0.49)))).toBe(false);
    expect(uncovers(clearedShareOf(cover(0.5)))).toBe(true);
    expect(uncovers(clearedShareOf(cover(0)))).toBe(false);
    expect(uncovers(clearedShareOf(cover(1)))).toBe(true);
  });

  it('seeds a tile’s poster the same way every visit', () => {
    expect(seedOf('r3c-1')).toBe(seedOf('r3c-1'));
    expect(seedOf('r3c-1')).not.toBe(seedOf('r2c-2'));
  });
});

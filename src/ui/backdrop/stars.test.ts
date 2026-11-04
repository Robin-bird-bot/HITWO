import { describe, expect, it } from 'vitest';
import { makeStars } from './stars';

describe('night stars', () => {
  it('are the same on every render', () => {
    expect(makeStars()).toEqual(makeStars());
  });

  it('are about 90, in the top half of the sky, with the planned sizes and opacity', () => {
    const stars = makeStars();
    expect(stars).toHaveLength(90);
    for (const s of stars) {
      expect(s.y).toBeLessThanOrEqual(520);
      expect([10, 12, 14, 18, 22]).toContain(s.size);
      expect(s.opacity).toBeGreaterThanOrEqual(0.2);
      expect(s.opacity).toBeLessThanOrEqual(0.95);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { ASSETS, asset } from './assets';

describe('asset()', () => {
  it('builds URLs under the base path', () => {
    const base = import.meta.env.BASE_URL;
    expect(asset('sky/sun.png')).toBe(`${base}assets/sky/sun.png`);
    expect(ASSETS.backgrounds.forestMisty).toBe(`${base}assets/backgrounds/239-forest-misty.webp`);
  });

  it('never produces a double slash', () => {
    for (const url of [asset('sky/sun.png'), ...Object.values(ASSETS).flatMap(Object.values)]) {
      expect(url).not.toMatch(/\/\//);
    }
  });
});

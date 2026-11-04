import { describe, expect, it } from 'vitest';
import { ASSETS, asset } from './assets';

describe('asset()', () => {
  it('builds URLs under the base path', () => {
    const base = import.meta.env.BASE_URL;
    expect(asset('sky/sun.png')).toBe(`${base}assets/sky/sun.png`);
    expect(ASSETS.backgrounds.forestMisty).toBe(`${base}assets/backgrounds/239-forest-misty.webp`);
  });

  it('never produces a double slash', () => {
    const urls = [asset('sky/sun.png'), ...allUrls(ASSETS)];
    expect(urls.length).toBeGreaterThan(50);
    for (const url of urls) expect(url).not.toMatch(/\/\//);
  });
});

/** Every URL in ASSETS, however deeply it's nested. */
function allUrls(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(allUrls);
  return [];
}

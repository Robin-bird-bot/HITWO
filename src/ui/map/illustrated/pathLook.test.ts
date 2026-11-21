import { describe, expect, it } from 'vitest';
import { paintedPlaces } from './land/mask';
import { pathStrokes } from './pathLook';

const main = (kind: Parameters<typeof pathStrokes>[0], walker?: string) =>
  pathStrokes(kind, walker).at(-1)!;

describe('illustrated paths', () => {
  it('a normal path is gray and dashed until someone walks it, then solid in their color', () => {
    expect(main('normal').dash).toBeDefined();
    const walked = main('normal', '#E5624A');
    expect(walked.color).toBe('#E5624A');
    expect(walked.dash).toBeUndefined();
    expect(walked.width).toBeGreaterThan(main('normal').width);
  });

  it('a walked path gets an outline under it', () => {
    expect(pathStrokes('normal', '#E5624A')).toHaveLength(
      pathStrokes('normal', undefined).length + 1,
    );
  });

  it('steep, muddy and rough stay dotted when walked, so their cost still shows', () => {
    for (const kind of ['steep', 'muddy', 'rough'] as const) {
      expect(main(kind).dash).toMatch(/^0\.1 /);
      expect(main(kind, '#7FC29B').dash).toMatch(/^0\.1 /);
    }
  });

  it('paved is solid either way', () => {
    expect(main('paved').dash).toBeUndefined();
    expect(main('paved', '#CDA6EE').dash).toBeUndefined();
  });
});

describe('place names', () => {
  it('show only where the paint covers their spot at least halfway', () => {
    const places = [
      { name: 'Tumalo Pond', x: 10, y: 0 },
      { name: 'Ochoco Lookout', x: 90, y: 0 },
    ];
    const paintAt = (x: number) => (x < 50 ? 0.8 : 0.3);
    expect(paintedPlaces(places, paintAt).map((p) => p.name)).toEqual(['Tumalo Pond']);
  });
});

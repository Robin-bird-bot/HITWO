/**
 * Dodge's hit shapes (docs/design/12-minigames-dodge.md, section 6): each
 * shape against the sprite's hit circle.
 */
import { describe, expect, it } from 'vitest';
import { angleBetween, touches, type Shape } from './shapes';

describe('hit shapes', () => {
  it('a segment counts its thickness', () => {
    const blade: Shape = { kind: 'segment', x1: 0, y1: 0, x2: 100, y2: 0, half: 2 };
    expect(touches(blade, { x: 50, y: 4.9 }, 3)).toBe(true);
    expect(touches(blade, { x: 50, y: 5.1 }, 3)).toBe(false);
    // Past the end, it's round.
    expect(touches(blade, { x: 104, y: 0 }, 3)).toBe(true);
    expect(touches(blade, { x: 106, y: 0 }, 3)).toBe(false);
  });

  it('an ellipse: inside, just touching, and clear', () => {
    const shadow: Shape = { kind: 'ellipse', cx: 0, cy: 0, rx: 30, ry: 20 };
    expect(touches(shadow, { x: 0, y: 0 }, 3)).toBe(true);
    expect(touches(shadow, { x: 32, y: 0 }, 3)).toBe(true);
    expect(touches(shadow, { x: 0, y: 24 }, 3)).toBe(false);
  });

  it('a rectangle, edges and corners', () => {
    const zone: Shape = { kind: 'rect', x: 0, y: 0, w: 40, h: 26 };
    expect(touches(zone, { x: 20, y: 13 }, 3)).toBe(true);
    expect(touches(zone, { x: 42, y: 13 }, 3)).toBe(true);
    expect(touches(zone, { x: 44, y: 13 }, 3)).toBe(false);
    expect(touches(zone, { x: 42.5, y: 28.5 }, 3)).toBe(false);
  });

  it('a ring band with a gap the sprite can slip through', () => {
    // Gap pointing straight down, 26 wide.
    const ring: Shape = { kind: 'ring', cx: 0, cy: 0, r: 50, half: 1, gapAt: Math.PI / 2, gap: 26 };
    expect(touches(ring, { x: 0, y: 50 }, 3)).toBe(false);
    expect(touches(ring, { x: 9, y: 49.2 }, 3)).toBe(false);
    expect(touches(ring, { x: 12, y: 48.5 }, 3)).toBe(true);
    expect(touches(ring, { x: 50, y: 0 }, 3)).toBe(true);
    // Off the band.
    expect(touches(ring, { x: 0, y: -40 }, 3)).toBe(false);
    expect(touches(ring, { x: 0, y: -46 }, 3)).toBe(true);
  });

  it('angles wrap the short way round', () => {
    expect(angleBetween(0, 2 * Math.PI)).toBeCloseTo(0);
    expect(angleBetween(0.1, -0.1)).toBeCloseTo(0.2);
    expect(angleBetween(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });
});

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

  it('an arc band: only within its angle, and round at its ends', () => {
    // Pointing straight down, 40° wide, radius 50.
    const wave: Shape = {
      kind: 'arc',
      cx: 0,
      cy: 0,
      r: 50,
      half: 1,
      at: Math.PI / 2,
      spread: (40 * Math.PI) / 180,
    };
    expect(touches(wave, { x: 0, y: 50 }, 3)).toBe(true);
    expect(touches(wave, { x: 0, y: 53.9 }, 3)).toBe(true);
    expect(touches(wave, { x: 0, y: 55 }, 3)).toBe(false);
    // 20° off straight down is its edge; 30° is clear of it.
    const at = (deg: number) => ({
      x: 50 * Math.cos(((90 - deg) * Math.PI) / 180),
      y: 50 * Math.sin(((90 - deg) * Math.PI) / 180),
    });
    expect(touches(wave, at(19), 3)).toBe(true);
    expect(touches(wave, at(30), 3)).toBe(false);
    // Behind the mouth: nothing.
    expect(touches(wave, { x: 0, y: -50 }, 3)).toBe(false);
  });

  it('a triangle: inside, near an edge, and clear', () => {
    const flame: Shape = {
      kind: 'triangle',
      points: [
        { x: 0, y: 100 },
        { x: 10, y: 100 },
        { x: 5, y: 40 },
      ],
    };
    expect(touches(flame, { x: 5, y: 90 }, 3)).toBe(true);
    expect(touches(flame, { x: 5, y: 38 }, 3)).toBe(true);
    expect(touches(flame, { x: 5, y: 35 }, 3)).toBe(false);
    expect(touches(flame, { x: 14, y: 95 }, 3)).toBe(false);
    expect(touches(flame, { x: 12, y: 98 }, 3)).toBe(true);
  });

  it('angles wrap the short way round', () => {
    expect(angleBetween(0, 2 * Math.PI)).toBeCloseTo(0);
    expect(angleBetween(0.1, -0.1)).toBeCloseTo(0.2);
    expect(angleBetween(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });
});

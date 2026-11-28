/**
 * Incoming Bike!'s shape matcher (docs/design/30-quick-minigames.md,
 * sections 1 and 6): it knows each shape drawn a few different ways, and
 * taps and scribbles are nothing.
 */
import { describe, expect, it } from 'vitest';
import { matchShape, SHAPE_SETS, type Point, type ShapeId } from './shapes';

/** A stroke through these corners, a point every 2 units (as a finger gives them). */
function stroke(...corners: [number, number][]): Point[] {
  const out: Point[] = [];
  for (let k = 1; k < corners.length; k++) {
    const [ax, ay] = corners[k - 1]!;
    const [bx, by] = corners[k]!;
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 2));
    for (let i = 0; i < n; i++)
      out.push({ x: ax + ((bx - ax) * i) / n, y: ay + ((by - ay) * i) / n });
  }
  const [lx, ly] = corners.at(-1)!;
  out.push({ x: lx, y: ly });
  return out;
}

/** A shaky hand: each point nudged a little, the same way every run. */
const shaky = (pts: Point[], by = 1.5): Point[] =>
  pts.map((p, k) => ({ x: p.x + Math.sin(k * 1.7) * by, y: p.y + Math.cos(k * 2.3) * by }));

/** A circle from an angle, clockwise or not. */
function circle(cx: number, cy: number, r: number, from: number, clockwise: boolean): Point[] {
  const out: Point[] = [];
  for (let k = 0; k <= 40; k++) {
    const a = from + (clockwise ? 1 : -1) * (k / 40) * Math.PI * 2 * 0.95;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

const WAYS: Record<ShapeId, Point[][]> = {
  up: [
    stroke([100, 150], [100, 80]),
    stroke([100, 150], [108, 90]),
    shaky(stroke([60, 200], [62, 120])),
  ],
  down: [
    stroke([100, 80], [100, 150]),
    stroke([100, 80], [92, 140]),
    shaky(stroke([40, 40], [44, 100])),
  ],
  left: [
    stroke([160, 100], [90, 100]),
    stroke([160, 100], [100, 110]),
    shaky(stroke([200, 60], [120, 58])),
  ],
  right: [
    stroke([90, 100], [160, 100]),
    stroke([90, 100], [150, 92]),
    shaky(stroke([20, 60], [100, 64])),
  ],
  v: [
    stroke([80, 60], [110, 120], [140, 60]),
    // A round bottom, drawn wide.
    stroke([60, 60], [85, 110], [100, 120], [115, 110], [140, 60]),
    shaky(stroke([80, 60], [100, 100], [120, 60])),
  ],
  caret: [
    stroke([80, 120], [110, 60], [140, 120]),
    stroke([60, 130], [85, 80], [100, 70], [115, 80], [140, 130]),
    shaky(stroke([80, 120], [100, 80], [120, 120])),
  ],
  z: [
    stroke([80, 60], [140, 60], [80, 120], [140, 120]),
    stroke([70, 60], [150, 64], [76, 126], [150, 122]),
    shaky(stroke([80, 60], [130, 60], [80, 100], [130, 100])),
  ],
  loop: [
    circle(120, 100, 30, 0, true),
    circle(120, 100, 30, Math.PI / 2, false),
    shaky(circle(120, 100, 24, Math.PI, true), 1),
  ],
};

describe('the shape matcher', () => {
  it.each(Object.entries(WAYS))('knows %s drawn a few ways', (id, ways) => {
    for (const w of ways) expect(matchShape(w)).toBe(id);
  });

  it('a tap or a tiny flick is nothing', () => {
    expect(matchShape([{ x: 100, y: 100 }])).toBeNull();
    expect(matchShape(stroke([100, 100], [104, 102]))).toBeNull();
  });

  it('only matches the shapes in play: a V before Tier II is nothing', () => {
    const tierOne = SHAPE_SETS[0]!;
    expect(matchShape(WAYS.v[0]!, tierOne)).toBeNull();
    expect(matchShape(WAYS.loop[0]!, tierOne)).toBeNull();
    expect(matchShape(WAYS.up[0]!, tierOne)).toBe('up');
  });

  it('a scribble that is no shape is nothing', () => {
    expect(
      matchShape(stroke([60, 60], [140, 60], [60, 70], [140, 80], [60, 90], [140, 100])),
    ).toBeNull();
  });
});

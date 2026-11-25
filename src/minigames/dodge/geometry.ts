/**
 * Dodge's box and the small geometry its attacks share: the box's walls,
 * points on a wall, how far a line runs before it leaves the box, keeping
 * the sprite inside, and a few seeded picks. Scene units.
 */
import { int, nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { Point } from './shapes';

export interface Box {
  /** Middle and size. */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export type Side = 'left' | 'right' | 'top' | 'bottom';
export const SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom'];
export const OPPOSITE: Readonly<Record<Side, Side>> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

/** Each wall's direction into the box. */
export const INWARD: Readonly<Record<Side, Point>> = {
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
  top: { x: 0, y: 1 },
  bottom: { x: 0, y: -1 },
};

/** The sprite (person.png, 10 × 12): how far its edges are from its middle. */
export const SPRITE_HALF = { w: 5, h: 6 } as const;

export const edges = (b: Box) => ({
  left: b.cx - b.w / 2,
  right: b.cx + b.w / 2,
  top: b.cy - b.h / 2,
  bottom: b.cy + b.h / 2,
});

/** A point on a wall, `along` it from 0 (left or top end) to 1, and `out` units outside it. */
export function onSide(b: Box, side: Side, along: number, out = 0): Point {
  const e = edges(b);
  switch (side) {
    case 'left':
      return { x: e.left - out, y: e.top + along * b.h };
    case 'right':
      return { x: e.right + out, y: e.top + along * b.h };
    case 'top':
      return { x: e.left + along * b.w, y: e.top - out };
    case 'bottom':
      return { x: e.left + along * b.w, y: e.bottom + out };
  }
}

/** How far a line from `p` (inside or on the box) in direction `dir` runs before it leaves the box. */
export function rayToWall(b: Box, p: Point, dir: Point): number {
  const e = edges(b);
  let best = Infinity;
  if (dir.x > 1e-9) best = Math.min(best, (e.right - p.x) / dir.x);
  if (dir.x < -1e-9) best = Math.min(best, (e.left - p.x) / dir.x);
  if (dir.y > 1e-9) best = Math.min(best, (e.bottom - p.y) / dir.y);
  if (dir.y < -1e-9) best = Math.min(best, (e.top - p.y) / dir.y);
  return Number.isFinite(best) ? Math.max(0, best) : 0;
}

/** Keeps the sprite inside the box. */
export function clampToBox(p: Point, box: Box): Point {
  const e = edges(box);
  const minX = e.left + SPRITE_HALF.w;
  const maxX = e.right - SPRITE_HALF.w;
  const minY = e.top + SPRITE_HALF.h;
  const maxY = e.bottom - SPRITE_HALF.h;
  return {
    x: minX > maxX ? box.cx : Math.min(maxX, Math.max(minX, p.x)),
    y: minY > maxY ? box.cy : Math.min(maxY, Math.max(minY, p.y)),
  };
}

/** Turns a direction by an angle (radians, toward down for positive). */
export const rotate = (v: Point, a: number): Point => ({
  x: v.x * Math.cos(a) - v.y * Math.sin(a),
  y: v.x * Math.sin(a) + v.y * Math.cos(a),
});

export const unit = (v: Point): Point => {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
};

export const DEG = Math.PI / 180;

/** A seeded number from a to b. */
export const between = (rng: RngState, a: number, b: number): number =>
  a + nextFloat(rng) * (b - a);

/** A seeded whole number in an inclusive [min, max] pair. */
export const count = (rng: RngState, range: readonly [number, number]): number =>
  int(rng, range[0], range[1]);

/** One of a list, seeded. */
export const oneOf = <T>(rng: RngState, list: readonly T[]): T =>
  list[int(rng, 0, list.length - 1)]!;

/** Heads or tails, seeded. */
export const coin = (rng: RngState, chance = 0.5): boolean => nextFloat(rng) < chance;

/** Where a point is along a path of straight legs after `d` units, and which way it's going. */
export function alongPath(
  path: readonly Point[],
  d: number,
): { at: Point; dir: Point; end: boolean } {
  let left = Math.max(0, d);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dir = unit({ x: b.x - a.x, y: b.y - a.y });
    if (left <= len)
      return { at: { x: a.x + dir.x * left, y: a.y + dir.y * left }, dir, end: false };
    left -= len;
  }
  const last = path.at(-1) ?? { x: 0, y: 0 };
  const prev = path.at(-2) ?? last;
  return { at: { ...last }, dir: unit({ x: last.x - prev.x, y: last.y - prev.y }), end: true };
}

/** A path's length. */
export const pathLength = (path: readonly Point[]): number =>
  path.reduce(
    (sum, p, i) => (i ? sum + Math.hypot(p.x - path[i - 1]!.x, p.y - path[i - 1]!.y) : 0),
    0,
  );

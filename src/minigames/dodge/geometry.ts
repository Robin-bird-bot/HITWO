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

/** The screen, and where the HUDs are: the top one ends here, the bottom one starts here. */
export const SCREEN = { w: 320, h: 240 } as const;
export const HUD = { top: 19, bottom: 209 } as const;

/**
 * Where a warning marker (a "!" or an arrow, `half` from its middle to its
 * edge) goes. Outside the box is best; but if it would overlap a HUD or
 * leave the screen, it goes just inside the nearest box edge instead
 * (`inside`, drawn on a light background).
 */
export function markSpot(p: Point, box: Box, half = 3.5): Point & { inside: boolean } {
  const clear =
    p.x - half >= 0 && p.x + half <= SCREEN.w && p.y - half >= HUD.top && p.y + half <= HUD.bottom;
  if (clear) return { x: p.x, y: p.y, inside: false };
  const e = edges(box);
  const m = half + 1;
  return {
    x: Math.min(e.right - m, Math.max(e.left + m, p.x)),
    y: Math.min(e.bottom - m, Math.max(e.top + m, p.y)),
    inside: true,
  };
}

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

/**
 * Where a line from `p` going `dir` (unit) is inside the box: the distances
 * along it where it comes in and goes out, or none if it misses.
 */
export function throughBox(b: Box, p: Point, dir: Point): { tIn: number; tOut: number } | null {
  const e = edges(b);
  let tIn = -Infinity;
  let tOut = Infinity;
  const axes: [number, number, number, number][] = [
    [p.x, dir.x, e.left, e.right],
    [p.y, dir.y, e.top, e.bottom],
  ];
  for (const [at, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (at < lo || at > hi) return null;
      continue;
    }
    let t1 = (lo - at) / d;
    let t2 = (hi - at) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tIn = Math.max(tIn, t1);
    tOut = Math.min(tOut, t2);
  }
  return tIn <= tOut && tOut > 0 ? { tIn: Math.max(0, tIn), tOut } : null;
}

/** A point inside the box at least `margin` from every wall, seeded. */
export function spotIn(rng: RngState, b: Box, margin: number): Point {
  const e = edges(b);
  const mx = Math.min(margin, b.w / 2);
  const my = Math.min(margin, b.h / 2);
  return {
    x: e.left + mx + nextFloat(rng) * Math.max(0, b.w - 2 * mx),
    y: e.top + my + nextFloat(rng) * Math.max(0, b.h - 2 * my),
  };
}

/** The distance between two points. */
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Where a line from `start` going `dir` (unit) first crosses into the box,
 * and the wall it crosses there; `out` units outside that wall is where its
 * warning goes. A line that misses the box warns at the nearest wall point.
 */
export function entryMark(b: Box, start: Point, dir: Point, out = 5): Point {
  const e = edges(b);
  let tIn = -Infinity;
  let tOut = Infinity;
  let wall: Side = 'left';
  const slab = (p: number, d: number, lo: number, hi: number, loSide: Side, hiSide: Side) => {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) tIn = Infinity;
      return;
    }
    let t1 = (lo - p) / d;
    let t2 = (hi - p) / d;
    let s1 = loSide;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      s1 = hiSide;
    }
    if (t1 > tIn) {
      tIn = t1;
      wall = s1;
    }
    tOut = Math.min(tOut, t2);
  };
  slab(start.x, dir.x, e.left, e.right, 'left', 'right');
  slab(start.y, dir.y, e.top, e.bottom, 'top', 'bottom');
  if (tIn > tOut || !Number.isFinite(tIn)) {
    const c = clampToEdge(b, start);
    return { x: c.x + INWARD[c.side].x * -out, y: c.y + INWARD[c.side].y * -out };
  }
  const at = { x: start.x + dir.x * tIn, y: start.y + dir.y * tIn };
  return { x: at.x - INWARD[wall].x * out, y: at.y - INWARD[wall].y * out };
}

/** The nearest point on the box's edge to a point outside it, and its wall. */
function clampToEdge(b: Box, p: Point): Point & { side: Side } {
  const e = edges(b);
  const x = Math.min(e.right, Math.max(e.left, p.x));
  const y = Math.min(e.bottom, Math.max(e.top, p.y));
  const side: Side =
    p.y < e.top ? 'top' : p.y > e.bottom ? 'bottom' : p.x < e.left ? 'left' : 'right';
  return { x, y, side };
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

/**
 * Dodge's hit shapes (docs/design/12-minigames-dodge.md, section 6):
 * circles, segments with a thickness, rectangles, ellipses, and ring bands
 * with a gap. Every attack says where it can hit as a list of these, and the
 * same list drives the hits and the testing tab's "Show hitboxes".
 *
 * The sprite's own hitbox is a circle, so every test is "does this shape
 * touch a circle of this radius at this point". Scene units.
 */

export interface Point {
  x: number;
  y: number;
}

export type Shape =
  | { kind: 'circle'; x: number; y: number; r: number }
  /** A line segment with a thickness: everything within `half` of the line. */
  | { kind: 'segment'; x1: number; y1: number; x2: number; y2: number; half: number }
  /** An upright rectangle: its top-left corner and size. */
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  /**
   * A ring band: everything within `half` of a circle of radius `r`, except a
   * gap `gap` units wide (measured along the ring), centered at angle `gapAt`
   * (radians, 0 pointing right, turning toward down).
   */
  | { kind: 'ring'; cx: number; cy: number; r: number; half: number; gapAt: number; gap: number };

/** The distance from a point to a segment. */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The smallest turn between two angles (0 to π). */
export function angleBetween(a: number, b: number): number {
  const d = Math.abs(((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  return d;
}

/** Whether a shape touches a circle of radius `reach` at `p`. */
export function touches(shape: Shape, p: Point, reach: number): boolean {
  switch (shape.kind) {
    case 'circle':
      return Math.hypot(p.x - shape.x, p.y - shape.y) <= shape.r + reach;
    case 'segment':
      return (
        distToSegment(p, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) <=
        shape.half + reach
      );
    case 'rect': {
      const cx = Math.max(shape.x, Math.min(shape.x + shape.w, p.x));
      const cy = Math.max(shape.y, Math.min(shape.y + shape.h, p.y));
      return Math.hypot(p.x - cx, p.y - cy) <= reach;
    }
    case 'ellipse': {
      // The ellipse grown by the reach: close enough for small reaches.
      const dx = (p.x - shape.cx) / (shape.rx + reach);
      const dy = (p.y - shape.cy) / (shape.ry + reach);
      return dx * dx + dy * dy <= 1;
    }
    case 'ring': {
      const dist = Math.hypot(p.x - shape.cx, p.y - shape.cy);
      if (Math.abs(dist - shape.r) > shape.half + reach) return false;
      if (dist === 0) return true;
      // In the gap: the whole circle fits between the gap's ends.
      const off = angleBetween(Math.atan2(p.y - shape.cy, p.x - shape.cx), shape.gapAt) * dist;
      return off > shape.gap / 2 - reach;
    }
  }
}

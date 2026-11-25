/**
 * Dodge's hit shapes (docs/design/12-minigames-dodge.md, section 6):
 * circles, segments with a thickness, rectangles, ellipses, arc bands (a
 * shout's waves) and triangles (flames, the Eye's gaze). Every attack says where it can hit as a list of these, and the
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
   * An arc band: everything within `half` of a circle of radius `r`, but only
   * within `spread / 2` of angle `at` (radians, 0 pointing right, turning
   * toward down).
   */
  | { kind: 'arc'; cx: number; cy: number; r: number; half: number; at: number; spread: number }
  | { kind: 'triangle'; points: readonly [Point, Point, Point] };

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
    case 'arc': {
      const dist = Math.hypot(p.x - shape.cx, p.y - shape.cy);
      if (Math.abs(dist - shape.r) > shape.half + reach) return false;
      if (dist === 0) return true;
      // Within the arc's angle, or close enough to one of its ends.
      const off = angleBetween(Math.atan2(p.y - shape.cy, p.x - shape.cx), shape.at);
      if (off <= shape.spread / 2) return true;
      return arcEnds(shape).some(
        (end) => Math.hypot(p.x - end.x, p.y - end.y) <= shape.half + reach,
      );
    }
    case 'triangle': {
      const [a, b, c] = shape.points;
      if (insideTriangle(p, a, b, c)) return true;
      return (
        distToSegment(p, a, b) <= reach ||
        distToSegment(p, b, c) <= reach ||
        distToSegment(p, c, a) <= reach
      );
    }
  }
}

/** An arc band's two ends (on its middle radius). */
export function arcEnds(shape: Extract<Shape, { kind: 'arc' }>): [Point, Point] {
  const end = (a: number) => ({
    x: shape.cx + shape.r * Math.cos(a),
    y: shape.cy + shape.r * Math.sin(a),
  });
  return [end(shape.at - shape.spread / 2), end(shape.at + shape.spread / 2)];
}

/** Whether a point is inside a triangle (either winding). */
export function insideTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const side = (u: Point, v: Point) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
  const d1 = side(a, b);
  const d2 = side(b, c);
  const d3 = side(c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

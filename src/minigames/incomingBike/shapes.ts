/**
 * Incoming Bike!'s shape matcher for phones (docs/design/30-quick-minigames.md,
 * section 1, "On a phone"; Claude's idea): a finger stroke becomes a list of
 * 8 directions, with tiny wiggles dropped, and is compared with each shape's
 * list. It's simple and forgiving: each direction may be off by one step
 * (45°). A nearly straight stroke is a swipe the way it mostly went, and a
 * loop is any stroke that turns most of the way around.
 *
 * Pure; scene units, y down.
 */
import { BALANCE } from '../../config/balance';

const SWIPE = BALANCE.minigames.incomingBike.swipe;

export type ShapeId = 'up' | 'down' | 'left' | 'right' | 'v' | 'caret' | 'z' | 'loop';

/** 8 directions, clockwise on screen from east: E, SE, S, SW, W, NW, N, NE. */
export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const [E, SE, S, SW, W, N, NE] = [0, 1, 2, 3, 4, 6, 7] as const;

export interface Point {
  x: number;
  y: number;
}

/** Each shape as its directions, drawn the usual way (a V from its top left). */
export const SHAPES: Readonly<Record<Exclude<ShapeId, 'loop'>, readonly Dir[]>> = {
  up: [N],
  down: [S],
  left: [W],
  right: [E],
  v: [SE, NE],
  caret: [NE, SE],
  z: [E, SW, E],
};

/** The order the shapes come in: the four swipes at Tier I, V and Λ at II, Z and the loop at III. */
export const SHAPE_SETS: readonly (readonly ShapeId[])[] = [
  ['up', 'down', 'left', 'right'],
  ['v', 'caret'],
  ['z', 'loop'],
];

const dirOf = (dx: number, dy: number): Dir =>
  ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8) as Dir;

/** How many 45° steps apart two directions are (0 to 4). */
const stepsApart = (a: Dir, b: Dir): number => {
  const d = Math.abs(a - b) % 8;
  return Math.min(d, 8 - d);
};

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** The stroke's length along the way. */
const lengthOf = (pts: readonly Point[]): number =>
  pts.slice(1).reduce((n, p, k) => n + dist(pts[k]!, p), 0);

/** How far a point is from the segment a–b. */
function offSegment(p: Point, a: Point, b: Point): number {
  const len = dist(a, b);
  if (len === 0) return dist(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len ** 2),
  );
  return dist(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

/**
 * The stroke's corners: a point closer than a share of the stroke's size to
 * the straight line between kept ones goes (Ramer–Douglas–Peucker). The
 * hand's shake goes with it.
 */
function corners(pts: readonly Point[]): Point[] {
  if (pts.length < 3) return [...pts];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const size = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const eps = Math.max(SWIPE.cornerMin, size * SWIPE.corner);
  const keep = pts.map((_, k) => k === 0 || k === pts.length - 1);
  const todo: [number, number][] = [[0, pts.length - 1]];
  while (todo.length) {
    const [a, b] = todo.pop()!;
    let far = -1;
    let at = -1;
    for (let k = a + 1; k < b; k++) {
      const d = offSegment(pts[k]!, pts[a]!, pts[b]!);
      if (d > far) [far, at] = [d, k];
    }
    if (far > eps) {
      keep[at] = true;
      todo.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

/**
 * The stroke as directions: its corners' segments, the same direction
 * merged, tiny runs (wiggles) dropped, and a bend drawn round (SE, E, NE for
 * a V's bottom) taken as its two sides. Empty when what's left is too little
 * of the stroke (a scribble).
 */
export function strokeDirs(pts: readonly Point[]): Dir[] {
  if (lengthOf(pts) < SWIPE.shortest) return [];
  const c = corners(pts);
  const total = lengthOf(c);
  const runs: { dir: Dir; len: number }[] = [];
  for (let k = 1; k < c.length; k++) {
    const dir = dirOf(c[k]!.x - c[k - 1]!.x, c[k]!.y - c[k - 1]!.y);
    const len = dist(c[k - 1]!, c[k]!);
    const last = runs.at(-1);
    if (last && last.dir === dir) last.len += len;
    else runs.push({ dir, len });
  }
  const kept = runs.filter((r) => r.len >= total * SWIPE.wiggle);
  if (kept.reduce((n, r) => n + r.len, 0) < total * SWIPE.cover) return [];
  const out: Dir[] = [];
  for (const r of kept) if (out.at(-1) !== r.dir) out.push(r.dir);
  for (let k = 1; k < out.length - 1;) {
    const [a, m, b] = [out[k - 1]!, out[k]!, out[k + 1]!];
    if (stepsApart(a, m) === 1 && stepsApart(m, b) === 1 && stepsApart(a, b) === 2)
      out.splice(k, 1);
    else k++;
  }
  return out;
}

/** How far the stroke turns in all (degrees, signed; a loop turns about 360), from a smoothed copy. */
export function turning(pts: readonly Point[]): number {
  if (lengthOf(pts) < SWIPE.shortest) return 0;
  // A moving average takes out the hand's shake; then points a few units apart.
  const smooth = pts.map((_, k) => {
    const near = pts.slice(Math.max(0, k - 2), k + 3);
    return {
      x: near.reduce((n, p) => n + p.x, 0) / near.length,
      y: near.reduce((n, p) => n + p.y, 0) / near.length,
    };
  });
  const step = Math.max(3, lengthOf(smooth) / 32);
  const even: Point[] = [smooth[0]!];
  for (const p of smooth) if (dist(even.at(-1)!, p) >= step) even.push(p);
  let sum = 0;
  for (let k = 2; k < even.length; k++) {
    const a = Math.atan2(even[k - 1]!.y - even[k - 2]!.y, even[k - 1]!.x - even[k - 2]!.x);
    const b = Math.atan2(even[k]!.y - even[k - 1]!.y, even[k]!.x - even[k - 1]!.x);
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    sum += d;
  }
  return (sum * 180) / Math.PI;
}

/**
 * The shape a stroke draws, from `allowed` (all of them when left out), or
 * null when it's a tap or nothing close. Each direction may be one step off;
 * the closest shape wins.
 */
export function matchShape(
  pts: readonly Point[],
  allowed: readonly ShapeId[] = [...SHAPE_SETS.flat()],
): ShapeId | null {
  if (lengthOf(pts) < SWIPE.shortest) return null;
  // Nearly straight: a swipe, the way it mostly went.
  const dx = pts.at(-1)!.x - pts[0]!.x;
  const dy = pts.at(-1)!.y - pts[0]!.y;
  if (Math.hypot(dx, dy) >= lengthOf(corners(pts)) * SWIPE.straight) {
    const id: ShapeId =
      Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    return allowed.includes(id) ? id : null;
  }
  if (Math.abs(turning(pts)) >= SWIPE.loopDeg) return allowed.includes('loop') ? 'loop' : null;
  const dirs = strokeDirs(pts);
  let best: { id: ShapeId; score: number } | null = null;
  for (const id of allowed) {
    if (id === 'loop') continue;
    const want = SHAPES[id];
    if (want.length !== dirs.length) continue;
    const off = want.map((d, k) => stepsApart(d, dirs[k]!));
    if (off.some((o) => o > 1)) continue;
    const score = off.reduce((n, o) => n + o, 0);
    if (!best || score < best.score) best = { id, score };
  }
  return best?.id ?? null;
}

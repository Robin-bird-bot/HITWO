/**
 * Ants (docs/design/21-minigames-dodge-camp.md, section 2): a swarm of
 * ants. Every ant hits as a small circle.
 *
 * - **Marching Lines** (missile): lines of ants come in from the walls and
 *   walk the box like snake, on a grid, turning 90° every few cells and
 *   never back on themselves. After a while each heads out by the nearest
 *   wall. At Level 1 the lead shows its next turn.
 * - **Ant Mill** (missile): a ring of ants circles one spot while a column
 *   marches across elsewhere, never through the ring. Level 2: the ring
 *   drifts toward the sprite. Level 3: two rings, turning opposite ways.
 * - **Fire Ants** (area, Level 2 and up): ants walk in and stop; all but one
 *   turn red, blink faster, and blow up. Stand by the one that stays dark.
 *   At Level 3 it walks to a new spot during the warning.
 * - **Ant Hill** (changer, Level 2 and up): a crack, then a hill rises. It's
 *   solid, and it fires ants at the sprite while it's up.
 * - **Leafcutter Parade** (Claude's idea; missile): a row of ants carrying
 *   leaves crosses the box, with gaps to slip through.
 * - **Crumb Rush** (Claude's idea, Level 3; missile): crumbs drop, then ants
 *   pour in from all the walls straight at the nearest one.
 *
 * The fire ants don't hit by touch (only their blasts), so standing by the
 * safe one is safe. Claude's ideas are here with the rest, marked
 * `claudesIdea`.
 */
import { BALANCE } from '../../../config/balance';
import { int, nextFloat, shuffle } from '../../../engine/rng';
import type { RngState } from '../../../engine/types';
import {
  alongPath,
  between,
  dist,
  edges,
  INWARD,
  onSide,
  oneOf,
  pathLength,
  SIDES,
  spotIn,
  type Box,
  type Side,
} from '../geometry';
import type { Point, Shape } from '../shapes';
import type { AttackCtx, AttackDef, PartBase, PartRules } from '../types';
import { base, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const AN = D.ants;

// ── Parts ──────────────────────────────────────────────────────────────────

/** A line of ants following one path: a marching line, or the Ant Mill's straight column. */
export interface MarchPart extends PartBase {
  kind: 'march';
  /** The lead's path: from outside a wall, its corners on the grid, and out again. */
  path: Point[];
  ants: number;
  spacing: number;
  speed: number;
  /** How far along the path the lead is when it starts (just outside the wall). */
  lead0: number;
  /** Level 1: the lead shows its next turn. */
  hint?: true;
}

/** A ring of ants circling a spot. */
export interface MillPart extends PartBase {
  kind: 'mill';
  cx: number;
  cy: number;
  r: number;
  ants: number;
  /** Radians a second (opposite ways for two rings), and where the first ant starts. */
  turn: number;
  a0: number;
  until: number;
  /** Level 2: it drifts toward the sprite this fast, keeping clear of the column. */
  drift: number;
  keepOff?: { axis: 'x' | 'y'; at: number };
}

/** Fire ants: they walk in, stop, all but the safe one turn red, then blow up (`activeAt`). */
export interface FireAntsPart extends PartBase {
  kind: 'fireAnts';
  ants: { from: Point; at: Point }[];
  safe: number;
  /** Level 3: where the safe ant walks to during the warning. */
  moveTo?: Point;
  stopAt: number;
  redAt: number;
}

/** The Ant Hill: a crack (`warnAt`), then it rises (`activeAt`), fires ants, and sinks at `downAt`. */
export interface AntHillPart extends PartBase {
  kind: 'antHill';
  x: number;
  y: number;
  downAt: number;
  everySec: number;
  speed: number;
  nextShot: number;
}

/** An ant the hill fired, walking straight. */
export interface WalkerPart extends PartBase {
  kind: 'walker';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Leafcutter Parade: a row of leaf carriers crossing from `side`. */
export interface ParadePart extends PartBase {
  kind: 'parade';
  side: Side;
  /** Where each carrier is along the row (the coordinate across their way). */
  spots: number[];
  /** Where they start along their way (outside the wall), and where they're gone. */
  start: number;
  end: number;
  speed: number;
}

/** Crumb Rush: crumbs, then ants from the walls, each to its nearest crumb. */
export interface CrumbRushPart extends PartBase {
  kind: 'crumbRush';
  crumbs: Point[];
  ants: { from: Point; to: Point; at: number }[];
  speed: number;
  endAt: number;
}

export type AntPart =
  MarchPart | MillPart | FireAntsPart | AntHillPart | WalkerPart | ParadePart | CrumbRushPart;

// ── Shared ─────────────────────────────────────────────────────────────────

/** An ant's hit circle. */
const antAt = (p: Point): Shape => ({ kind: 'circle', x: p.x, y: p.y, r: AN.radius });

/** The nearest point just outside the box's walls to a point inside it. */
function nearestOutside(box: Box, p: Point, out = 5): Point {
  const e = edges(box);
  const gaps: [number, Side][] = [
    [p.x - e.left, 'left'],
    [e.right - p.x, 'right'],
    [p.y - e.top, 'top'],
    [e.bottom - p.y, 'bottom'],
  ];
  const side = gaps.reduce((a, b) => (b[0] < a[0] ? b : a))[1];
  const d = INWARD[side];
  return side === 'left' || side === 'right'
    ? { x: (side === 'left' ? e.left : e.right) - d.x * out, y: p.y }
    : { x: p.x, y: (side === 'top' ? e.top : e.bottom) - d.y * out };
}

// ── Marching Lines ─────────────────────────────────────────────────────────

const M = AN.march;

/** The grid the lines walk on: the middles of its cells across and down, centered in the box. */
export function antGrid(box: Box, grid: number = M.grid): { xs: number[]; ys: number[] } {
  const e = edges(box);
  const nx = Math.max(1, Math.floor(box.w / grid));
  const ny = Math.max(1, Math.floor(box.h / grid));
  const ox = e.left + (box.w - nx * grid) / 2 + grid / 2;
  const oy = e.top + (box.h - ny * grid) / 2 + grid / 2;
  return {
    xs: Array.from({ length: nx }, (_, i) => ox + i * grid),
    ys: Array.from({ length: ny }, (_, j) => oy + j * grid),
  };
}

interface Step {
  dx: number;
  dy: number;
}
const leftOf = (d: Step): Step => ({ dx: d.dy, dy: -d.dx });
const rightOf = (d: Step): Step => ({ dx: -d.dy, dy: d.dx });

/**
 * A marching line's path: in from `side` on a grid line, straight for a few
 * cells, then a 90° turn (never back), for `cells` cells in all; then out by
 * the nearest wall it can reach without turning back. `out` is how far
 * outside the walls it starts and ends, so the whole line enters and leaves.
 */
export function marchPath(
  rng: RngState,
  box: Box,
  side: Side,
  cells: number,
  out: number,
): Point[] {
  const { xs, ys } = antGrid(box);
  const nx = xs.length;
  const ny = ys.length;
  const g = M.grid;
  const inward = INWARD[side];
  let dir: Step = { dx: Math.round(inward.x), dy: Math.round(inward.y) };
  let i =
    side === 'left'
      ? 0
      : side === 'right'
        ? nx - 1
        : int(rng, Math.min(1, nx - 1), Math.max(0, nx - 2));
  let j =
    side === 'top'
      ? 0
      : side === 'bottom'
        ? ny - 1
        : int(rng, Math.min(1, ny - 1), Math.max(0, ny - 2));
  const at = (a: number, b: number): Point => ({ x: xs[a]!, y: ys[b]! });
  const path: Point[] = [{ x: xs[i]! - dir.dx * (out + g), y: ys[j]! - dir.dy * (out + g) }];
  const room = (d: Step) => (d.dx > 0 ? nx - 1 - i : d.dx < 0 ? i : d.dy > 0 ? ny - 1 - j : j);
  let run = int(rng, M.turnEvery[0], M.turnEvery[1]);
  for (let walked = 0, guard = 0; walked < cells && guard < 1000; guard++) {
    if (run <= 0 || room(dir) <= 0) {
      const turns = [leftOf(dir), rightOf(dir)].filter((d) => room(d) > 0);
      if (!turns.length) break;
      // Mostly toward the side with more room, so it doesn't box itself into a corner.
      const a = turns[0]!;
      const b = turns[1] ?? a;
      const roomy = room(a) >= room(b) ? a : b;
      const other = roomy === a ? b : a;
      dir = nextFloat(rng) < 0.7 ? roomy : other;
      path.push(at(i, j));
      run = int(rng, M.turnEvery[0], M.turnEvery[1]);
      continue;
    }
    i += dir.dx;
    j += dir.dy;
    walked++;
    run--;
  }
  // Out by the nearest wall: straight on, or a turn to either side (never back).
  const ways = [dir, leftOf(dir), rightOf(dir)];
  const best = ways.reduce((a, b) => (room(b) < room(a) ? b : a));
  if (best !== dir) {
    path.push(at(i, j));
    dir = best;
  }
  const k = room(dir);
  const edge = at(i + dir.dx * k, j + dir.dy * k);
  path.push({ x: edge.x + dir.dx * (out + g), y: edge.y + dir.dy * (out + g) });
  return path;
}

/** How far along its path the lead of a line is at a time. */
export const leadAt = (p: MarchPart, time: number): number =>
  p.lead0 + p.speed * Math.max(0, time - p.activeAt);

/** Where each ant of a line is (and which way it faces), the lead first. */
export function marchAnts(p: MarchPart, time: number): { at: Point; dir: Point }[] {
  const lead = leadAt(p, time);
  return Array.from({ length: p.ants }, (_, k) => {
    const a = alongPath(p.path, lead - k * p.spacing);
    return { at: a.at, dir: a.dir };
  });
}

/** Level 1: the lead's next turn when it's close (where, and the new way), or none. */
export function marchHint(p: MarchPart, time: number): { at: Point; dir: Point } | null {
  if (!p.hint) return null;
  const lead = leadAt(p, time);
  let d = 0;
  for (let k = 1; k < p.path.length - 1; k++) {
    d += dist(p.path[k - 1]!, p.path[k]!);
    if (d < lead) continue;
    if (d - lead > M.hintCells * M.grid) return null;
    const next = p.path[k + 1]!;
    const corner = p.path[k]!;
    const len = dist(corner, next) || 1;
    return { at: corner, dir: { x: (next.x - corner.x) / len, y: (next.y - corner.y) / len } };
  }
  return null;
}

/** A line of ants starting at `warnAt`, coming in after the warning. */
function line(
  ctx: AttackCtx,
  warnAt: number,
  path: Point[],
  ants: number,
  speed: number,
  hint: boolean,
): MarchPart {
  return {
    kind: 'march',
    ...base(ctx, warnAt, warnAt + warnFor()),
    path,
    ants,
    spacing: M.grid,
    speed,
    lead0: ants * M.grid,
    ...(hint ? { hint: true as const } : {}),
  };
}

export const MARCHING: AttackDef = {
  id: 'marching',
  name: 'Marching Lines',
  kind: 'missile',
  start(ctx) {
    const ants = M.ants[ctx.level];
    const speed = M.speed[ctx.level];
    const cells = Math.ceil((speed * M.walkSec) / M.grid);
    const sides = shuffle(ctx.rng, [...SIDES]).slice(0, M.lines[ctx.level]);
    const parts = sides.map((side, k) =>
      line(
        ctx,
        ctx.time + k * M.apartSec,
        marchPath(ctx.rng, ctx.box, side, cells, ants * M.grid),
        ants,
        speed,
        ctx.level <= M.hintUpTo,
      ),
    );
    return { parts, endsAt: 'parts' };
  },
};

const MARCH_RULES: PartRules<MarchPart> = {
  shapes: (p, w) => (w.time < p.activeAt ? [] : marchAnts(p, w.time).map((a) => antAt(a.at))),
  done: (p, w) => leadAt(p, w.time) - (p.ants - 1) * p.spacing >= pathLength(p.path),
};

// ── Ant Mill ───────────────────────────────────────────────────────────────

const MI = AN.mill;

/** Where each ant of a ring is now (and the way it's walking). */
export function millAnts(p: MillPart, time: number): { at: Point; dir: Point }[] {
  const spin = p.a0 + p.turn * Math.max(0, time - p.activeAt);
  return Array.from({ length: p.ants }, (_, k) => {
    const a = spin + (2 * Math.PI * k) / p.ants;
    const s = Math.sign(p.turn) || 1;
    return {
      at: { x: p.cx + Math.cos(a) * p.r, y: p.cy + Math.sin(a) * p.r },
      dir: { x: -Math.sin(a) * s, y: Math.cos(a) * s },
    };
  });
}

/** A straight column's path across the box along a grid line, from outside one wall to past the other. */
function columnPath(box: Box, axis: 'x' | 'y', at: number, forward: boolean, out: number): Point[] {
  const e = edges(box);
  if (axis === 'y') {
    const a = { x: e.left - out, y: at };
    const b = { x: e.right + out, y: at };
    return forward ? [a, b] : [b, a];
  }
  const a = { x: at, y: e.top - out };
  const b = { x: at, y: e.bottom + out };
  return forward ? [a, b] : [b, a];
}

export const ANT_MILL: AttackDef = {
  id: 'antMill',
  name: 'Ant Mill',
  kind: 'missile',
  start(ctx) {
    const activeAt = ctx.time + warnFor();
    const two = ctx.level >= MI.twoFrom;
    const centers: Point[] = [];
    for (let tries = 0; tries < 80 && centers.length < (two ? 2 : 1); tries++) {
      const c = spotIn(ctx.rng, ctx.box, MI.radius + 5);
      if (Math.abs(dist(c, ctx.pos) - MI.radius) < 12) continue;
      if (centers.some((o) => dist(o, c) < 2 * MI.radius + 10)) continue;
      centers.push(c);
    }
    if (!centers.length) centers.push({ x: ctx.box.cx, y: ctx.box.cy });
    // The column: along a grid line well clear of every ring.
    const { xs, ys } = antGrid(ctx.box);
    const clear = MI.radius + MI.clear;
    const lines = shuffle(ctx.rng, [
      ...ys.map((at) => ({ axis: 'y' as const, at })),
      ...xs.map((at) => ({ axis: 'x' as const, at })),
    ]);
    const lane = lines.find(({ axis, at }) =>
      centers.every((c) => Math.abs((axis === 'y' ? c.y : c.x) - at) >= clear),
    );
    const drift = ctx.level >= MI.driftFrom ? MI.drift : 0;
    const parts: (MillPart | MarchPart)[] = centers.map((c, k) => ({
      kind: 'mill',
      ...base(ctx, ctx.time, activeAt),
      cx: c.x,
      cy: c.y,
      r: MI.radius,
      ants: MI.ring[ctx.level],
      turn: MI.turn * (k % 2 === 0 ? 1 : -1),
      a0: nextFloat(ctx.rng) * 2 * Math.PI,
      until: activeAt + MI.sec,
      drift,
      ...(lane ? { keepOff: lane } : {}),
    }));
    if (lane) {
      const n = MI.column[ctx.level];
      const out = n * M.grid;
      parts.push(
        line(
          ctx,
          ctx.time,
          columnPath(ctx.box, lane.axis, lane.at, nextFloat(ctx.rng) < 0.5, out),
          n,
          M.speed[ctx.level],
          false,
        ),
      );
    }
    return { parts, endsAt: 'parts' };
  },
};

const MILL_RULES: PartRules<MillPart> = {
  update(p, w) {
    if (!p.drift || w.time < p.activeAt) return { part: p };
    // Level 2: drift toward the sprite, staying in the box and clear of the column.
    const dx = w.pos.x - p.cx;
    const dy = w.pos.y - p.cy;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return { part: p };
    const e = edges(w.box);
    const m = p.r + 4;
    let cx = Math.min(e.right - m, Math.max(e.left + m, p.cx + (dx / d) * p.drift * w.dt));
    let cy = Math.min(e.bottom - m, Math.max(e.top + m, p.cy + (dy / d) * p.drift * w.dt));
    const clear = p.r + MI.clear;
    if (p.keepOff?.axis === 'y' && Math.abs(cy - p.keepOff.at) < clear) cy = p.cy;
    if (p.keepOff?.axis === 'x' && Math.abs(cx - p.keepOff.at) < clear) cx = p.cx;
    return { part: { ...p, cx, cy } };
  },
  shapes: (p, w) => (w.time < p.activeAt ? [] : millAnts(p, w.time).map((a) => antAt(a.at))),
  done: (p, w) => w.time > p.until,
};

// ── Fire Ants ──────────────────────────────────────────────────────────────

const F = AN.fire;

/** Where a fire ant is at a time: walking in, standing, or (the safe one at Level 3) walking on. */
export function fireAntAt(p: FireAntsPart, k: number, time: number): Point {
  const a = p.ants[k]!;
  if (time < p.stopAt) {
    const u = Math.max(0, (time - p.warnAt) / Math.max(1e-6, p.stopAt - p.warnAt));
    return { x: a.from.x + (a.at.x - a.from.x) * u, y: a.from.y + (a.at.y - a.from.y) * u };
  }
  if (k !== p.safe || !p.moveTo || time < p.redAt) return a.at;
  const u = Math.min(1, (time - p.redAt) / (F.redSec * 0.6));
  return { x: a.at.x + (p.moveTo.x - a.at.x) * u, y: a.at.y + (p.moveTo.y - a.at.y) * u };
}

/** Where the safe ant ends up (the spot no blast reaches). */
export const safeSpot = (p: FireAntsPart): Point => p.moveTo ?? p.ants[p.safe]!.at;

/**
 * The fire ants' spots: the safe one at least [40] from the sprite (and,
 * at Level 3, the spot it walks to); every other at least [30] from the
 * rest and far enough from the safe spot that no blast reaches within [12]
 * of it.
 */
function fireSpots(
  rng: RngState,
  box: Box,
  sprite: Point,
  n: number,
  moves: boolean,
): { spots: Point[]; moveTo?: Point } {
  const e = edges(box);
  const keep = F.blast + F.safe;
  let best: { spots: Point[]; moveTo?: Point } = { spots: [{ x: box.cx, y: box.cy }] };
  for (let tries = 0; tries < 60; tries++) {
    const s0 = spotIn(rng, box, 10);
    if (dist(s0, sprite) < F.fromSprite) continue;
    let s1 = s0;
    if (moves) {
      const a = nextFloat(rng) * 2 * Math.PI;
      const d = between(rng, F.move[0], F.move[1]);
      s1 = {
        x: Math.min(e.right - 10, Math.max(e.left + 10, s0.x + Math.cos(a) * d)),
        y: Math.min(e.bottom - 10, Math.max(e.top + 10, s0.y + Math.sin(a) * d)),
      };
    }
    const spots = [s0];
    for (let k = 0; k < 60 && spots.length < n; k++) {
      const c = spotIn(rng, box, 8);
      if (dist(c, s1) < keep) continue;
      if (spots.some((o) => dist(o, c) < F.apart)) continue;
      spots.push(c);
    }
    const found = moves ? { spots, moveTo: s1 } : { spots };
    if (spots.length > best.spots.length) best = found;
    if (spots.length >= n) return found;
  }
  return best;
}

export const FIRE_ANTS: AttackDef = {
  id: 'fireAnts',
  name: 'Fire Ants',
  kind: 'area',
  start(ctx) {
    const n = ctx.state.hudTier === 5 ? F.tierFive : F.ants[ctx.level];
    const moves = ctx.level >= F.moveFrom;
    const { spots, moveTo } = fireSpots(ctx.rng, ctx.box, ctx.pos, n, moves);
    const stopAt = ctx.time + F.walkSec;
    const redAt = stopAt + F.stopSec;
    return {
      parts: [
        {
          kind: 'fireAnts',
          ...base(ctx, ctx.time, redAt + F.redSec),
          ants: spots.map((at) => ({ from: nearestOutside(ctx.box, at), at })),
          safe: 0,
          ...(moveTo ? { moveTo } : {}),
          stopAt,
          redAt,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const FIRE_RULES: PartRules<FireAntsPart> = {
  // Every ant but the safe one blows up, at one moment.
  shapes: (p, w, t0) =>
    t0 < p.activeAt && w.time >= p.activeAt
      ? p.ants
          .filter((_, k) => k !== p.safe)
          .map((a) => ({ kind: 'circle' as const, x: a.at.x, y: a.at.y, r: F.blast }))
      : [],
  outline: (p, w, t0) =>
    t0 < p.activeAt && w.time >= p.activeAt
      ? p.ants
          .filter((_, k) => k !== p.safe)
          .map((a) => ({ kind: 'circle' as const, x: a.at.x, y: a.at.y, r: F.blast }))
      : [],
  done: (p, w) => w.time > p.activeAt + F.boomSec,
};

// ── Ant Hill ───────────────────────────────────────────────────────────────

const H = AN.hill;

/** How risen the hill is now: 0 (a crack) to 1 (up), and back down as it sinks. */
export function hillRise(p: AntHillPart, time: number): number {
  if (time < p.activeAt) return 0;
  if (time < p.activeAt + H.riseSec) return (time - p.activeAt) / H.riseSec;
  if (time < p.downAt) return 1;
  return Math.max(0, 1 - (time - p.downAt) / H.sinkSec);
}

export const ANT_HILL: AttackDef = {
  id: 'antHill',
  name: 'Ant Hill',
  kind: 'changer',
  start(ctx) {
    let spot = spotIn(ctx.rng, ctx.box, H.radius + 4);
    for (let tries = 0; tries < 40 && dist(spot, ctx.pos) < H.away; tries++) {
      const c = spotIn(ctx.rng, ctx.box, H.radius + 4);
      if (dist(c, ctx.pos) > dist(spot, ctx.pos)) spot = c;
    }
    const activeAt = ctx.time + warnFor(H.crackSec);
    const up = ctx.state.hudTier === 5 ? H.tierFiveSec : H.upSec[ctx.level];
    return {
      parts: [
        {
          kind: 'antHill',
          ...base(ctx, ctx.time, activeAt),
          x: spot.x,
          y: spot.y,
          downAt: activeAt + H.riseSec + up,
          everySec: H.everySec[ctx.level],
          speed: H.speed[ctx.level],
          nextShot: activeAt + H.riseSec,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const HILL_RULES: PartRules<AntHillPart> = {
  update(p, w) {
    // While it's up, an ant at the sprite every so often.
    const spawn: WalkerPart[] = [];
    let next = p.nextShot;
    while (next <= w.time && next < p.downAt) {
      const dx = w.pos.x - p.x;
      const dy = w.pos.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      spawn.push({
        kind: 'walker',
        id: w.nextId(),
        round: p.round,
        warnAt: next,
        activeAt: next,
        child: true,
        x: p.x + (dx / d) * H.radius,
        y: p.y + (dy / d) * H.radius,
        vx: (dx / d) * p.speed,
        vy: (dy / d) * p.speed,
      });
      next += p.everySec;
    }
    return spawn.length ? { part: { ...p, nextShot: next }, spawn } : { part: p };
  },
  shapes: () => [],
  blocks: (p, w) =>
    w.time >= p.activeAt && w.time < p.downAt + H.sinkSec / 2
      ? [{ x: p.x, y: p.y, r: H.radius }]
      : [],
  done: (p, w) => w.time > p.downAt + H.sinkSec,
};

/** A walker's middle at a time. */
export const walkerAt = (p: WalkerPart, time: number): Point => {
  const t = Math.max(0, time - p.activeAt);
  return { x: p.x + p.vx * t, y: p.y + p.vy * t };
};

const WALKER_RULES: PartRules<WalkerPart> = {
  shapes(p, w, t0) {
    if (w.time < p.activeAt) return [];
    const a = walkerAt(p, Math.max(p.activeAt, t0));
    const b = walkerAt(p, w.time);
    return [{ kind: 'segment', x1: a.x, y1: a.y, x2: b.x, y2: b.y, half: AN.radius }];
  },
  done(p, w) {
    const at = walkerAt(p, w.time);
    const e = edges(w.box);
    return at.x < e.left - 6 || at.x > e.right + 6 || at.y < e.top - 6 || at.y > e.bottom + 6;
  },
};

// ── Leafcutter Parade (Claude's idea) ──────────────────────────────────────

const PA = AN.parade;

/** Whether a parade walks across (from a side wall) or down/up (from the top or bottom). */
const across = (side: Side) => side === 'left' || side === 'right';

/** Where the row is along its way now. */
export function paradeAt(p: ParadePart, time: number): number {
  const sign = p.end > p.start ? 1 : -1;
  return p.start + sign * p.speed * Math.max(0, time - p.activeAt);
}

/** Each leaf's box now. */
export function paradeLeaves(p: ParadePart, time: number): (Shape & { kind: 'rect' })[] {
  const c = paradeAt(p, time);
  const [long, short] = PA.leaf;
  return p.spots.map((s) =>
    across(p.side)
      ? { kind: 'rect', x: c - short / 2, y: s - long / 2, w: short, h: long }
      : { kind: 'rect', x: s - long / 2, y: c - short / 2, w: long, h: short },
  );
}

export const LEAFCUTTER: AttackDef = {
  id: 'leafcutter',
  name: 'Leafcutter Parade',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const side = oneOf(ctx.rng, SIDES);
    const e = edges(ctx.box);
    const pitch = PA.leaf[0] + PA.gap[ctx.level];
    const [lo, hi] = across(side) ? [e.top, e.bottom] : [e.left, e.right];
    const first = lo + nextFloat(ctx.rng) * pitch;
    const spots: number[] = [];
    for (let s = first; s < hi; s += pitch) spots.push(s);
    const out = PA.leaf[1];
    const [start, end] =
      side === 'left'
        ? [e.left - out, e.right + out]
        : side === 'right'
          ? [e.right + out, e.left - out]
          : side === 'top'
            ? [e.top - out, e.bottom + out]
            : [e.bottom + out, e.top - out];
    return {
      parts: [
        {
          kind: 'parade',
          ...base(ctx, ctx.time, ctx.time + warnFor()),
          side,
          spots,
          start,
          end,
          speed: PA.speed,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const PARADE_RULES: PartRules<ParadePart> = {
  shapes: (p, w) => (w.time < p.activeAt ? [] : paradeLeaves(p, w.time)),
  done: (p, w) => {
    const c = paradeAt(p, w.time);
    return p.end > p.start ? c >= p.end : c <= p.end;
  },
};

// ── Crumb Rush (Claude's idea) ─────────────────────────────────────────────

const CR = AN.crumbs;

/** Where a rushing ant is (none before it sets off), and which way it faces. */
export function crumbAnt(
  p: CrumbRushPart,
  k: number,
  time: number,
): { at: Point; dir: Point } | null {
  const a = p.ants[k]!;
  if (time < a.at) return null;
  const len = dist(a.from, a.to) || 1;
  const d = Math.min(len, p.speed * (time - a.at));
  const dir = { x: (a.to.x - a.from.x) / len, y: (a.to.y - a.from.y) / len };
  return { at: { x: a.from.x + dir.x * d, y: a.from.y + dir.y * d }, dir };
}

export const CRUMB_RUSH: AttackDef = {
  id: 'crumbRush',
  name: 'Crumb Rush',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const n = ctx.state.hudTier === 5 ? CR.tierFive : CR.count;
    const crumbs: Point[] = [];
    for (let tries = 0; tries < 80 && crumbs.length < n; tries++) {
      const c = spotIn(ctx.rng, ctx.box, 15);
      if (dist(c, ctx.pos) < CR.away) continue;
      if (crumbs.some((o) => dist(o, c) < CR.apart)) continue;
      crumbs.push(c);
    }
    if (!crumbs.length) crumbs.push(spotIn(ctx.rng, ctx.box, 15));
    const activeAt = ctx.time + warnFor();
    const sides = shuffle(ctx.rng, [...SIDES]);
    const ants = Array.from({ length: CR.ants }, (_, k) => {
      const from = onSide(ctx.box, sides[k % 4]!, between(ctx.rng, 0.05, 0.95), 4);
      const to = crumbs.reduce((a, b) => (dist(b, from) < dist(a, from) ? b : a));
      return { from, to, at: activeAt + (k * CR.pourSec) / CR.ants };
    });
    const arrive = ants.reduce(
      (last, a) => Math.max(last, a.at + dist(a.from, a.to) / CR.speed),
      0,
    );
    return {
      parts: [
        {
          kind: 'crumbRush',
          ...base(ctx, ctx.time, activeAt),
          crumbs,
          ants,
          speed: CR.speed,
          endAt: arrive + CR.staySec,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const CRUMB_RULES: PartRules<CrumbRushPart> = {
  shapes: (p, w) =>
    p.ants.flatMap((_, k) => {
      const a = crumbAnt(p, k, w.time);
      return a ? [antAt(a.at)] : [];
    }),
  done: (p, w) => w.time > p.endAt,
};

// ── The library's pieces ───────────────────────────────────────────────────

export const ANT_ATTACKS: readonly AttackDef[] = [
  MARCHING,
  ANT_MILL,
  FIRE_ANTS,
  ANT_HILL,
  LEAFCUTTER,
  CRUMB_RUSH,
];

export const ANT_RULES: {
  [K in AntPart['kind']]: PartRules<Extract<AntPart, { kind: K }>>;
} = {
  march: MARCH_RULES,
  mill: MILL_RULES,
  fireAnts: FIRE_RULES,
  antHill: HILL_RULES,
  walker: WALKER_RULES,
  parade: PARADE_RULES,
  crumbRush: CRUMB_RULES,
};

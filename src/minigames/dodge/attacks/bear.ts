/**
 * Claws and Bite (docs/design/12-minigames-dodge.md, section 6).
 *
 * - **Claws** (Bear, Bear with a Sword, Bobcat): always curved. Each row of
 *   claws swings along an arc around a pivot outside a corner, like a paw
 *   swiping, each claw on its own radius. One attack sends 2, 3 or 4 rows
 *   by tier, a moment apart, from different corners, so their arcs cross.
 *   Faint claw lines and an arrow warn where they come in. Each claw points
 *   along its path, tip first, and hits as a short thin segment.
 * - **Bite** (Bear): jaws open around a zone centered on the sprite, then
 *   snap shut; the sprite is hit if it's in the zone at the snap. Tier III:
 *   a second bite, aimed where the sprite is when the first snaps.
 */
import { BALANCE } from '../../../config/balance';
import { shuffle } from '../../../engine/rng';
import { between, coin, DEG, edges, oneOf, rayToWall, type Box } from '../geometry';
import type { Point, Shape } from '../shapes';
import type { AttackCtx, AttackDef, BitePart, ClawsPart, PartRules } from '../types';
import { base, from, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const C = D.claws;

// ── Claws ──────────────────────────────────────────────────────────────────

export interface Claw {
  at: Point;
  /** The way it's moving (unit): the claw points this way, tip first. */
  dir: Point;
}

/** Where each claw in a row is at a time (before the row starts: where it starts). */
export function clawsAt(p: ClawsPart, time: number): Claw[] {
  const t = Math.max(0, Math.min(time, p.endAt) - p.activeAt);
  const a = p.path.a0 + p.path.w * t;
  const sign = Math.sign(p.path.w) || 1;
  const dir = { x: -Math.sin(a) * sign, y: Math.cos(a) * sign };
  return Array.from({ length: p.count }, (_, k) => {
    const r = p.path.r + (k - (p.count - 1) / 2) * p.spacing;
    return { at: { x: p.path.cx + r * Math.cos(a), y: p.path.cy + r * Math.sin(a) }, dir };
  });
}

/**
 * claw.png (9 × 18) is a slash whose tip is at its top-right corner. Turning
 * it by this much (degrees, rotation only, never mirrored) points the tip
 * along `dir`, so a claw is never upside down whichever way it swings.
 */
export const CLAW_TIP = Math.atan2(-18, 9);
export const clawTurn = (dir: Point): number =>
  ((Math.atan2(dir.y, dir.x) - CLAW_TIP) * 180) / Math.PI;

/**
 * Where the row comes into the box (its middle claw), and which way: for
 * its warning arrow at the edge. Found by walking along the arc.
 */
export function clawsEntry(p: ClawsPart, box: Box): { at: Point; dir: Point } {
  const e = edges(box);
  const inside = (q: Point) => q.x >= e.left && q.x <= e.right && q.y >= e.top && q.y <= e.bottom;
  const span = p.endAt - p.activeAt;
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = p.activeAt + (span * i) / steps;
    const a = p.path.a0 + p.path.w * (t - p.activeAt);
    const at = { x: p.path.cx + p.path.r * Math.cos(a), y: p.path.cy + p.path.r * Math.sin(a) };
    if (inside(at)) {
      const sign = Math.sign(p.path.w) || 1;
      return { at, dir: { x: -Math.sin(a) * sign, y: Math.cos(a) * sign } };
    }
  }
  const first = clawsAt(p, p.activeAt);
  const mid = first[Math.floor(first.length / 2)]!;
  return { at: mid.at, dir: mid.dir };
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: readonly Corner[] = ['tl', 'tr', 'br', 'bl'];

/** A row around (cx, cy) at radius r (its middle claw), from angle a0, turning `turn` radians. */
function clawRow(
  ctx: AttackCtx,
  path: { cx: number; cy: number; r: number; a0: number },
  turn: number,
  warnAt: number,
  activeAt: number,
  speed: number,
): ClawsPart {
  const w = (Math.sign(turn) * speed) / path.r;
  return {
    kind: 'claws',
    ...base(ctx, warnAt, activeAt),
    count: C.count[ctx.tier],
    spacing: C.spacing,
    length: C.length,
    thickness: C.thickness,
    path: { ...path, w },
    endAt: activeAt + Math.abs(turn) / Math.abs(w),
  };
}

/**
 * A curved swipe: the row swings around a pivot outside a corner, through
 * a point near the middle of the box.
 */
export function clawsArc(
  ctx: AttackCtx,
  box: Box,
  corner: Corner,
  turn: 1 | -1,
  warnAt: number,
  activeAt: number,
  speed: number,
): ClawsPart {
  const e = edges(box);
  const left = corner === 'tl' || corner === 'bl';
  const top = corner === 'tl' || corner === 'tr';
  const out = C.pivotOut / Math.SQRT2;
  const pivot = {
    x: (left ? e.left : e.right) + (left ? -out : out),
    y: (top ? e.top : e.bottom) + (top ? -out : out),
  };
  const aim = {
    x: box.cx + between(ctx.rng, -C.aimSpread, C.aimSpread) * box.w,
    y: box.cy + between(ctx.rng, -C.aimSpread, C.aimSpread) * box.h,
  };
  const r = Math.hypot(aim.x - pivot.x, aim.y - pivot.y);
  const mid = Math.atan2(aim.y - pivot.y, aim.x - pivot.x);
  const sweep = C.sweepDeg * DEG;
  return clawRow(
    ctx,
    { cx: pivot.x, cy: pivot.y, r, a0: mid - (turn * sweep) / 2 },
    turn * sweep,
    warnAt,
    activeAt,
    speed,
  );
}

/** One curved row from a random corner (the sword bear's extra claws). */
export function oneClawRow(ctx: AttackCtx, warnAt: number): ClawsPart {
  const speed = C.speed * ctx.speed;
  return clawsArc(
    ctx,
    ctx.box,
    oneOf(ctx.rng, CORNERS),
    coin(ctx.rng) ? 1 : -1,
    warnAt,
    warnAt + warnFor(),
    speed,
  );
}

/**
 * A row bursting out from a point, starting along `dir` and curving one
 * way (Landing swipe), until it's out of the box.
 */
export function clawsBurst(
  ctx: AttackCtx,
  origin: Point,
  dir: Point,
  warnAt: number,
  activeAt: number,
  speed: number,
): ClawsPart {
  const sign = coin(ctx.rng) ? 1 : -1;
  const R = C.landingRadius;
  // The pivot is to one side of the start, so the row starts heading along `dir`.
  const toStart = sign > 0 ? { x: dir.y, y: -dir.x } : { x: -dir.y, y: dir.x };
  const cx = origin.x - toStart.x * R;
  const cy = origin.y - toStart.y * R;
  const reach = rayToWall(ctx.box, origin, dir) + 2 * C.length;
  const turn = Math.min(150 * DEG, reach / R);
  return clawRow(
    ctx,
    { cx, cy, r: R, a0: Math.atan2(toStart.y, toStart.x) },
    sign * turn,
    warnAt,
    activeAt,
    speed,
  );
}

export const CLAWS: AttackDef = {
  id: 'claws',
  name: 'Claws',
  kind: 'missile',
  start(ctx) {
    const speed = C.speed * ctx.speed * (ctx.tweak.speed ?? 1);
    const warn = warnFor(ctx.tweak.warnSec);
    // Rows from different corners, a moment apart.
    const corners = shuffle(ctx.rng, CORNERS);
    const parts = Array.from({ length: C.rows[ctx.tier] }, (_, k) => {
      const warnAt = ctx.time + k * C.rowGapSec;
      return clawsArc(
        ctx,
        ctx.box,
        corners[k % corners.length]!,
        coin(ctx.rng) ? 1 : -1,
        warnAt,
        warnAt + warn,
        speed,
      );
    });
    return { parts, endsAt: 'parts' };
  },
};

/** Where a claw can hit: a short segment along its path, centered on it. */
export function clawShape(c: Claw, length: number, thickness: number): Shape {
  return {
    kind: 'segment',
    x1: c.at.x - (c.dir.x * length) / 2,
    y1: c.at.y - (c.dir.y * length) / 2,
    x2: c.at.x + (c.dir.x * length) / 2,
    y2: c.at.y + (c.dir.y * length) / 2,
    half: thickness / 2,
  };
}

export const CLAWS_RULES: PartRules<ClawsPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt || w.time > p.endAt) return [];
    return clawsAt(p, w.time).map((c) => clawShape(c, p.length, p.thickness));
  },
  done: (p, w) => w.time > p.endAt,
};

// ── Bite ───────────────────────────────────────────────────────────────────

const B = D.bite;

/** A zone this big, centered on a point, kept inside the box. */
export function zoneAround(box: Box, p: Point, w: number, h: number): Point {
  const e = edges(box);
  return {
    x: Math.min(e.right - w / 2, Math.max(e.left + w / 2, p.x)),
    y: Math.min(e.bottom - h / 2, Math.max(e.top + h / 2, p.y)),
  };
}

/** How open the jaws are: 1 wide open, 0 shut. */
export function biteOpen(p: BitePart, time: number): number {
  const openUntil = p.activeAt - p.snapSec;
  if (time < p.warnAt) return 0;
  if (time < openUntil)
    return Math.min(1, (time - p.warnAt) / Math.max(0.01, openUntil - p.warnAt));
  if (time < p.activeAt) return 1 - (time - openUntil) / p.snapSec;
  return 0;
}

export const BITE: AttackDef = {
  id: 'bite',
  name: 'Bite',
  kind: 'missile',
  start(ctx) {
    const [w, h] = B.zone;
    const at = zoneAround(ctx.box, ctx.pos, w, h);
    const first: BitePart = {
      kind: 'bite',
      ...base(ctx, ctx.time, ctx.time + warnFor(B.openSec) + B.snapSec),
      cx: at.x,
      cy: at.y,
      w,
      h,
      snapSec: B.snapSec,
      closedSec: B.closedSec,
    };
    if (!from(ctx, B.doubleFrom)) return { parts: [first], endsAt: 'parts' };
    // The second aims where the sprite is when the first snaps.
    const second: BitePart = {
      ...first,
      ...base(ctx, first.activeAt, first.activeAt + warnFor(B.openSec) + B.snapSec),
      aimPending: true,
    };
    return { parts: [first, second], endsAt: 'parts' };
  },
};

export const BITE_RULES: PartRules<BitePart> = {
  update(p, w) {
    if (!p.aimPending || w.time < p.warnAt) return { part: p };
    const at = zoneAround(w.box, w.pos, p.w, p.h);
    const part: BitePart = { ...p, cx: at.x, cy: at.y };
    delete part.aimPending;
    return { part };
  },
  shapes(p, w, t0) {
    // Only at the snap.
    if (!(t0 < p.activeAt && p.activeAt <= w.time)) return [];
    return [{ kind: 'rect', x: p.cx - p.w / 2, y: p.cy - p.h / 2, w: p.w, h: p.h }];
  },
  done: (p, w) => w.time > p.activeAt + p.closedSec,
};

export const BEAR_ATTACKS: readonly AttackDef[] = [CLAWS, BITE];

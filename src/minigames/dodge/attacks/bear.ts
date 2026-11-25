/**
 * Claws and Bite (docs/design/12-minigames-dodge.md, section 6).
 *
 * - **Claws** (Bear, Bear with a Sword, Bobcat): a row of claw marks crosses
 *   the box, straight from a wall, or (from Tier II) swinging along an arc
 *   around a pivot outside a corner, like a paw swiping. Tier III: a second
 *   row from the opposite side a moment later (not for the sword bear).
 *   Faint claw lines and an arrow warn where they come in. Each claw hits
 *   as a short thin segment.
 * - **Bite** (Bear): jaws open around a zone centered on the sprite, then
 *   snap shut; the sprite is hit if it's in the zone at the snap. Tier III:
 *   a second bite, aimed where the sprite is when the first snaps.
 */
import { BALANCE } from '../../../config/balance';
import {
  between,
  coin,
  DEG,
  edges,
  INWARD,
  OPPOSITE,
  onSide,
  oneOf,
  SIDES,
  unit,
  type Box,
  type Side,
} from '../geometry';
import type { Point, Shape } from '../shapes';
import type { AttackCtx, AttackDef, BitePart, ClawsPart, PartRules } from '../types';
import { base, from, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const C = D.claws;

// ── Claws ──────────────────────────────────────────────────────────────────

/** A claw's slant: the row's direction turned this far toward where it's going. */
const SLANT = 30 * DEG;

export interface Claw {
  at: Point;
  /** Its long axis (unit), and the way it's moving (unit). */
  axis: Point;
  dir: Point;
}

/** Where each claw in a row is at a time (before the row starts: where it starts). */
export function clawsAt(p: ClawsPart, time: number): Claw[] {
  const t = Math.max(0, Math.min(time, p.endAt) - p.activeAt);
  const out: Claw[] = [];
  for (let k = 0; k < p.count; k++) {
    const off = (k - (p.count - 1) / 2) * p.spacing;
    let at: Point;
    let dir: Point;
    let across: Point;
    if (p.path.type === 'line') {
      dir = unit({ x: p.path.vx, y: p.path.vy });
      across = { x: -dir.y, y: dir.x };
      at = {
        x: p.path.x + p.path.vx * t + across.x * off,
        y: p.path.y + p.path.vy * t + across.y * off,
      };
    } else {
      const a = p.path.a0 + p.path.w * t;
      const r = p.path.r + off;
      at = { x: p.path.cx + r * Math.cos(a), y: p.path.cy + r * Math.sin(a) };
      const sign = Math.sign(p.path.w) || 1;
      dir = { x: -Math.sin(a) * sign, y: Math.cos(a) * sign };
      across = { x: Math.cos(a), y: Math.sin(a) };
    }
    const axis = unit({
      x: across.x * Math.cos(SLANT) + dir.x * Math.sin(SLANT),
      y: across.y * Math.cos(SLANT) + dir.y * Math.sin(SLANT),
    });
    out.push({ at, axis, dir });
  }
  return out;
}

/** Where the row comes in (the middle of the row at its start), and which way. */
export function clawsEntry(p: ClawsPart): { at: Point; dir: Point } {
  const claws = clawsAt(p, p.activeAt);
  const mid = claws[Math.floor(claws.length / 2)]!;
  return { at: mid.at, dir: mid.dir };
}

/** A straight row from `origin` in `dir`, travelling `distance`. */
export function clawLine(
  ctx: AttackCtx,
  origin: Point,
  dir: Point,
  distance: number,
  warnAt: number,
  activeAt: number,
  speed: number,
): ClawsPart {
  return {
    kind: 'claws',
    ...base(ctx, warnAt, activeAt),
    count: C.count[ctx.tier],
    spacing: C.spacing,
    length: C.length,
    thickness: C.thickness,
    path: { type: 'line', x: origin.x, y: origin.y, vx: dir.x * speed, vy: dir.y * speed },
    endAt: activeAt + distance / speed,
  };
}

/** A straight row crossing the box from a wall, `along` it (0 to 1). */
export function clawsAcross(
  ctx: AttackCtx,
  box: Box,
  side: Side,
  along: number,
  warnAt: number,
  activeAt: number,
  speed: number,
): ClawsPart {
  const out = C.length / 2 + ((C.count[ctx.tier] - 1) * C.spacing) / 2 + 4;
  const origin = onSide(box, side, along, out);
  const span = side === 'left' || side === 'right' ? box.w : box.h;
  return clawLine(ctx, origin, INWARD[side], span + 2 * out, warnAt, activeAt, speed);
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: readonly Corner[] = ['tl', 'tr', 'bl', 'br'];
const ACROSS: Readonly<Record<Corner, Corner>> = { tl: 'br', br: 'tl', tr: 'bl', bl: 'tr' };

/** A curved swipe: the row swings around a pivot outside a corner, through the middle of the box. */
function clawsArc(
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
  const r = Math.hypot(box.cx - pivot.x, box.cy - pivot.y);
  const mid = Math.atan2(box.cy - pivot.y, box.cx - pivot.x);
  const sweep = C.sweepDeg * DEG;
  const w = (turn * speed) / r;
  return {
    kind: 'claws',
    ...base(ctx, warnAt, activeAt),
    count: C.count[ctx.tier],
    spacing: C.spacing,
    length: C.length,
    thickness: C.thickness,
    path: { type: 'arc', cx: pivot.x, cy: pivot.y, r, a0: mid - (turn * sweep) / 2, w },
    endAt: activeAt + sweep / Math.abs(w),
  };
}

export const CLAWS: AttackDef = {
  id: 'claws',
  name: 'Claws',
  start(ctx) {
    const speed = C.speed * ctx.speed * (ctx.tweak.speed ?? 1);
    const warnAt = ctx.time;
    const activeAt = ctx.time + warnFor(ctx.tweak.warnSec);
    const double = from(ctx, C.doubleFrom) && !ctx.tweak.noDouble;
    const later = (t: number) => t + C.doubleDelaySec;
    if (from(ctx, C.curvedFrom) && coin(ctx.rng, C.curvedChance)) {
      const corner = oneOf(ctx.rng, CORNERS);
      const turn = coin(ctx.rng) ? 1 : -1;
      const first = clawsArc(ctx, ctx.box, corner, turn, warnAt, activeAt, speed);
      if (!double) return { parts: [first], endsAt: 'parts' };
      const second = clawsArc(
        ctx,
        ctx.box,
        ACROSS[corner],
        turn,
        later(warnAt),
        later(activeAt),
        speed,
      );
      return { parts: [first, second], endsAt: 'parts' };
    }
    const side = oneOf(ctx.rng, SIDES);
    const first = clawsAcross(
      ctx,
      ctx.box,
      side,
      between(ctx.rng, 0.25, 0.75),
      warnAt,
      activeAt,
      speed,
    );
    if (!double) return { parts: [first], endsAt: 'parts' };
    const second = clawsAcross(
      ctx,
      ctx.box,
      OPPOSITE[side],
      between(ctx.rng, 0.25, 0.75),
      later(warnAt),
      later(activeAt),
      speed,
    );
    return { parts: [first, second], endsAt: 'parts' };
  },
};

export const CLAWS_RULES: PartRules<ClawsPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt || w.time > p.endAt) return [];
    return clawsAt(p, w.time).map((c): Shape => ({
      kind: 'segment',
      x1: c.at.x - (c.axis.x * p.length) / 2,
      y1: c.at.y - (c.axis.y * p.length) / 2,
      x2: c.at.x + (c.axis.x * p.length) / 2,
      y2: c.at.y + (c.axis.y * p.length) / 2,
      half: p.thickness / 2,
    }));
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

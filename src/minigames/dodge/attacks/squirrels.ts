/**
 * The Squirrel Army's attacks (docs/design/12-minigames-dodge.md, section 6).
 *
 * - **Rolling acorns:** a squirrel pops up at the edge with a "!", then
 *   throws an acorn in, at least 25° away from the wall. Acorns bounce off
 *   the walls like a mirror, cracking one stage per bounce, and break into
 *   harmless crumbs on the 3rd. Tier III: a breaking acorn throws shrapnel
 *   away from the wall. A corner hit counts as one bounce.
 * - **Acorn bombs:** lobbed in over the top edge to a marked spot; they sit
 *   (Tier I) or roll slowly and bounce (Tier II and up). The fuse burns, the
 *   blast radius pulsing the whole time; anything inside it during the
 *   blast is hit. Tier III: shrapnel flies out. Only the blast and the
 *   shrapnel hurt.
 * - **Shrapnel** flies in straight lines and is gone at the walls.
 */
import { BALANCE } from '../../../config/balance';
import { nextFloat } from '../../../engine/rng';
import {
  between,
  count,
  DEG,
  edges,
  INWARD,
  onSide,
  oneOf,
  rotate,
  SIDES,
  type Box,
  type Side,
} from '../geometry';
import type { Point } from '../shapes';
import type {
  AcornPart,
  AttackDef,
  BombPart,
  CrumbsPart,
  Part,
  PartRules,
  ShrapnelPart,
  World,
} from '../types';
import { base, from, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const A = D.acorns;
const B = D.bombs;
const SH = D.shrapnel;

/**
 * Moves something round by `dt` and bounces it off the box's walls like a
 * mirror. Returns the wall it hit (one per step, even in a corner), if any.
 */
function bounce(
  p: { x: number; y: number; vx: number; vy: number },
  box: Box,
  r: number,
  dt: number,
): { x: number; y: number; vx: number; vy: number; wall: Side | null } {
  const e = edges(box);
  let { x, y, vx, vy } = p;
  x += vx * dt;
  y += vy * dt;
  let wall: Side | null = null;
  if (x - r < e.left) {
    x = e.left + r;
    vx = Math.abs(vx);
    wall = 'left';
  } else if (x + r > e.right) {
    x = e.right - r;
    vx = -Math.abs(vx);
    wall = 'right';
  }
  if (y - r < e.top) {
    y = e.top + r;
    vy = Math.abs(vy);
    wall ??= 'top';
  } else if (y + r > e.bottom) {
    y = e.bottom - r;
    vy = -Math.abs(vy);
    wall ??= 'bottom';
  }
  return { x, y, vx, vy, wall };
}

/** Shrapnel pieces flying out from a point: spread around a direction, or all the way round. */
function shrapnel(
  w: World,
  round: number,
  at: Point,
  pieces: number,
  around: Point | null,
): ShrapnelPart[] {
  const turn = nextFloat(w.rng) * Math.PI * 2;
  return Array.from({ length: pieces }, (_, k) => {
    const dir = around
      ? rotate(around, ((k - (pieces - 1) / 2) / Math.max(1, pieces - 1)) * 120 * DEG)
      : rotate({ x: 1, y: 0 }, turn + (k / pieces) * Math.PI * 2);
    return {
      kind: 'shrapnel',
      id: w.nextId(),
      round,
      warnAt: w.time,
      activeAt: w.time,
      child: true,
      x: at.x,
      y: at.y,
      vx: dir.x * SH.speed,
      vy: dir.y * SH.speed,
    };
  });
}

// ── Rolling acorns ─────────────────────────────────────────────────────────

export const ACORNS: AttackDef = {
  id: 'acorns',
  name: 'Rolling acorns',
  kind: 'missile',
  start(ctx) {
    const speed = A.speed * ctx.speed;
    const n = A.count[ctx.tier];
    const parts: AcornPart[] = [];
    for (let k = 0; k < n; k++) {
      const side = oneOf(ctx.rng, SIDES);
      const along = between(ctx.rng, 0.15, 0.85);
      // Thrown in, at least the minimum angle away from the wall.
      const spread = (90 - A.minAngleDeg) * DEG;
      const dir = rotate(INWARD[side], between(ctx.rng, -spread, spread));
      const at = onSide(ctx.box, side, along, -A.radius);
      parts.push({
        kind: 'acorn',
        ...base(ctx, ctx.time, ctx.time + warnFor()),
        squirrel: onSide(ctx.box, side, along, 7),
        side,
        x: at.x,
        y: at.y,
        vx: dir.x * speed,
        vy: dir.y * speed,
        bounces: 0,
      });
    }
    return { parts, endsAt: 'parts' };
  },
};

/** The acorn's crack stage: 0, 1 or 2. */
export const acornStage = (p: AcornPart): number => Math.min(2, p.bounces);

export const ACORN_RULES: PartRules<AcornPart> = {
  update(p, w) {
    if (w.time < p.activeAt || p.done) return { part: p };
    const moved = bounce(p, w.box, A.radius, Math.min(w.dt, w.time - p.activeAt));
    const part: AcornPart = { ...p, x: moved.x, y: moved.y, vx: moved.vx, vy: moved.vy };
    if (!moved.wall) return { part };
    part.bounces = p.bounces + 1;
    if (part.bounces < A.breakOn) return { part };
    // It breaks: crumbs, and (Tier III) shrapnel away from the wall.
    const crumbs: CrumbsPart = {
      kind: 'crumbs',
      id: w.nextId(),
      round: p.round,
      warnAt: w.time,
      activeAt: w.time,
      child: true,
      x: part.x,
      y: part.y,
    };
    const spawn: Part[] = [crumbs];
    if (w.tier >= SH.from) {
      spawn.push(...shrapnel(w, p.round, part, SH.acornPieces, INWARD[moved.wall]));
    }
    return { part: { ...part, done: true }, spawn };
  },
  shapes(p, w) {
    if (w.time < p.activeAt || p.done) return [];
    return [{ kind: 'circle', x: p.x, y: p.y, r: A.radius }];
  },
  done: (p) => !!p.done,
};

export const CRUMBS_RULES: PartRules<CrumbsPart> = {
  shapes: () => [],
  done: (p, w) => w.time > p.activeAt + A.crumbsSec,
};

// ── Acorn bombs ────────────────────────────────────────────────────────────

/** A bomb's body radius, for rolling and bouncing (bomb.png is 12 × 15). */
const BOMB_BODY = 6;

export const BOMBS: AttackDef = {
  id: 'bombs',
  name: 'Acorn bombs',
  kind: 'missile',
  start(ctx) {
    const n = count(ctx.rng, B.count[ctx.tier]);
    const e = edges(ctx.box);
    const margin = 16;
    const spots: Point[] = [];
    for (let k = 0; k < n; k++) {
      // Spread out: a few tries for a spot away from the others.
      let spot = { x: 0, y: 0 };
      for (let tries = 0; tries < 8; tries++) {
        spot = {
          x: between(ctx.rng, e.left + margin, e.right - margin),
          y: between(ctx.rng, e.top + margin, e.bottom - margin),
        };
        if (spots.every((s) => Math.hypot(s.x - spot.x, s.y - spot.y) > B.radius * 1.3)) break;
      }
      spots.push(spot);
    }
    const rolls = from(ctx, B.rollFrom);
    const landAt = ctx.time + warnFor(B.markSec);
    const parts = spots.map((spot): BombPart => {
      const angle = nextFloat(ctx.rng) * Math.PI * 2;
      return {
        kind: 'bomb',
        ...base(ctx, ctx.time, landAt + B.fuseSec),
        from: { x: spot.x, y: e.top - 4 },
        x: spot.x,
        y: spot.y,
        vx: rolls ? Math.cos(angle) * B.rollSpeed : 0,
        vy: rolls ? Math.sin(angle) * B.rollSpeed : 0,
        landAt,
        blastSec: B.blastSec,
        radius: B.radius,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

/** Where the bomb is drawn: on its way in over the top edge, or where it sits or rolls. */
export function bombAt(p: BombPart, time: number): { at: Point; lift: number } {
  if (time >= p.landAt) return { at: { x: p.x, y: p.y }, lift: 0 };
  const u = Math.max(0, (time - p.warnAt) / Math.max(0.01, p.landAt - p.warnAt));
  return {
    at: { x: p.from.x + (p.x - p.from.x) * u, y: p.from.y + (p.y - p.from.y) * u },
    lift: Math.sin(u * Math.PI) * B.lobHeight,
  };
}

/** Whether the fuse sprite shows lit: faster and faster as the blast comes. */
export function bombLit(p: BombPart, time: number): boolean {
  if (time < p.landAt) return false;
  const u = Math.min(1, (time - p.landAt) / Math.max(0.01, p.activeAt - p.landAt));
  // Flips from about 4 a second to about 16 a second.
  const phase = (time - p.landAt) * (4 + 12 * u);
  return Math.floor(phase) % 2 === 1;
}

export const BOMB_RULES: PartRules<BombPart> = {
  update(p, w) {
    if (w.time < p.landAt) return { part: p };
    if (!p.blasted && w.time >= p.activeAt) {
      // The blast; Tier III: shrapnel all the way round.
      const part = { ...p, blasted: true as const };
      return {
        part,
        spawn: w.tier >= SH.from ? shrapnel(w, p.round, p, SH.bombPieces, null) : [],
      };
    }
    if (p.blasted || (!p.vx && !p.vy)) return { part: p };
    const moved = bounce(p, w.box, BOMB_BODY, Math.min(w.dt, w.time - p.landAt));
    return { part: { ...p, x: moved.x, y: moved.y, vx: moved.vx, vy: moved.vy } };
  },
  shapes(p, w) {
    if (w.time < p.activeAt || w.time > p.activeAt + p.blastSec) return [];
    return [{ kind: 'circle', x: p.x, y: p.y, r: p.radius }];
  },
  done: (p, w) => w.time > p.activeAt + p.blastSec + 0.1,
};

// ── Shrapnel ───────────────────────────────────────────────────────────────

export const SHRAPNEL_RULES: PartRules<ShrapnelPart> = {
  update(p, w) {
    return { part: { ...p, x: p.x + p.vx * w.dt, y: p.y + p.vy * w.dt } };
  },
  shapes: (p) => [{ kind: 'circle', x: p.x, y: p.y, r: SH.radius }],
  done(p, w) {
    const e = edges(w.box);
    return (
      p.x < e.left - SH.radius ||
      p.x > e.right + SH.radius ||
      p.y < e.top - SH.radius ||
      p.y > e.bottom + SH.radius
    );
  },
};

export const SQUIRREL_ATTACKS: readonly AttackDef[] = [ACORNS, BOMBS];

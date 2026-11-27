/**
 * Bear with a Gun (docs/design/21-minigames-dodge-camp.md, section 1): a
 * cowboy bear with a revolver. Bearrels' bear moved into Dodge (Nov 26).
 *
 * - **Aimed Shot** (missile): from a spot just outside a wall, a dashed aim
 *   line tracks the sprite, locks and blinks, then a fast lane crosses the
 *   whole box along it. A few in a row, each from a new spot; at Level 3
 *   every third is a double.
 * - **Snipe** (changer, Level 2 and up): a crosshair follows the sprite a
 *   little slower than it moves, locks red, and blasts (2 hearts). The blast
 *   leaves a hole the sprite can't enter, which fades after a while. At most
 *   [3] holes, never more than [30%] of the box. Level 3: two in a row.
 * - **Bear Traps** (changer): traps are tossed in (a shadow shows where),
 *   land gray and harmless for a moment (22-minigame-revisions.md, section
 *   3.1), then turn red and lie open for a while, snapping shut on the
 *   sprite: 1 heart and slowed.
 * - **Rapid Fire** (missile): a cone flashes from one spot, then a spray of
 *   bullets flies out within it.
 * - **Ricochet** (Claude's idea, Level 2 and up; missile): fast shots
 *   whose whole bouncing paths show first, all at once; the bullets follow
 *   them exactly, a moment apart. More shots by tier (section 3.2).
 * - **Bullet Ring** (Tier IV and up; missile, section 3.3): a "!" over the
 *   portrait and a muzzle flash at the middle of the box's top, then rings
 *   of pellets fly out from there, each ring turned from the last so the
 *   gaps move.
 * - **Quick Draw** (Claude's idea, Level 3; area): a "!" over the portrait,
 *   then a band across the sprite's row, then one down its column.
 *
 * Its two ideas are here with the rest of its attacks (not in
 * claudesIdeas.ts), marked `claudesIdea` so the switch still removes them.
 */
import { BALANCE } from '../../../config/balance';
import { nextFloat } from '../../../engine/rng';
import type { RngState } from '../../../engine/types';
import {
  between,
  coin,
  DEG,
  dist,
  edges,
  onSide,
  oneOf,
  rayToWall,
  spotIn,
  throughBox,
  unit,
  type Box,
  type Side,
} from '../geometry';
import type { Point, Shape } from '../shapes';
import type { AttackCtx, AttackDef, Part, PartBase, PartRules } from '../types';
import { base, from, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const G = D.gun;

// ── Parts ──────────────────────────────────────────────────────────────────

/** One Aimed Shot: the aim tracks the sprite until `lockAt`, then the shot fires at `activeAt`. */
export interface ShotPart extends PartBase {
  kind: 'shot';
  /** The gun's spot, just outside a wall. */
  from: Point;
  /** Where it aims: the sprite, until it locks. */
  aim: Point;
  lockAt: number;
  /** Set when it locks: which way the lane goes and how long it is (to the far wall). */
  dir?: Point;
  length?: number;
  /** A double (Level 3): a second lane this far to one side. */
  twin?: number;
}

/** A Snipe's crosshair: it follows the sprite until `lockAt`, then blasts at `activeAt`. */
export interface CrosshairPart extends PartBase {
  kind: 'crosshair';
  x: number;
  y: number;
  speed: number;
  lockAt: number;
  holeSec: number;
  blasted?: true;
}

/** A hole left by a snipe: the sprite can't enter it. It fades (and shrinks) from `until`. */
export interface HolePart extends PartBase {
  kind: 'hole';
  x: number;
  y: number;
  r: number;
  until: number;
}

/**
 * A bear trap: tossed (`warnAt`, its shadow showing), landing gray and
 * harmless (`activeAt`), turning red at `armAt`, open until `openUntil`.
 */
export interface TrapPart extends PartBase {
  kind: 'trap';
  /** Where it's tossed from (the bear, above the box) and where it lands. */
  from: Point;
  x: number;
  y: number;
  armAt: number;
  openUntil: number;
  /** When it snapped shut on the sprite (harmless from then). */
  shutAt?: number;
  /** It came down too near the sprite (or with too many out) and is gone. */
  gone?: true;
}

/** One bullet of a Rapid Fire spray, flying straight from the gun from `activeAt`. */
export interface BulletPart extends PartBase {
  kind: 'bullet';
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The first of a spray shows the gun's warning: where it is, the cone's middle and half its spread (radians). */
  cone?: { at: number; half: number; until: number };
}

/** A Ricochet shot: its whole path (from the gun, bouncing off the walls, and out) shows first. */
export interface RicochetPart extends PartBase {
  kind: 'ricochet';
  path: Point[];
  speed: number;
}

/** One ring of a Bullet Ring: pellets flying out from `from`, the first at angle `a0`. */
export interface BulletRingPart extends PartBase {
  kind: 'bulletRing';
  from: Point;
  a0: number;
  pellets: number;
  speed: number;
  /** The first ring carries the warning (the "!" and the muzzle flash). */
  first?: true;
}

/** Quick Draw: a band across the row (`row`, at `activeAt`), then down the column (`col`, at `colAt`). */
export interface QuickDrawPart extends PartBase {
  kind: 'quickDraw';
  row: number;
  /** Picked where the sprite is as the row fires. */
  col?: number;
  colAt: number;
  band: number;
}

export type GunPart =
  | ShotPart
  | CrosshairPart
  | HolePart
  | TrapPart
  | BulletPart
  | RicochetPart
  | BulletRingPart
  | QuickDrawPart;

// ── Shared ─────────────────────────────────────────────────────────────────

/** The walls the gun fires from: the top or a side (never from under the box). */
const GUN_SIDES: readonly Side[] = ['top', 'left', 'right'];

/** A spot for the gun just outside a wall. */
const gunSpot = (rng: RngState, box: Box): Point =>
  onSide(box, oneOf(rng, GUN_SIDES), between(rng, 0.1, 0.9), G.aimed.out);

/** A straight shot's swept path this step: a segment from where it was to where it is. */
function sweep(
  at: (t: number) => Point,
  start: number,
  t0: number,
  t1: number,
  half: number,
): Shape[] {
  if (t1 < start) return [];
  const a = at(Math.max(start, t0));
  const b = at(t1);
  return [{ kind: 'segment', x1: a.x, y1: a.y, x2: b.x, y2: b.y, half }];
}

/** Whether a point is in (or within `pad` of) the box. */
const nearBox = (box: Box, p: Point, pad: number) => {
  const e = edges(box);
  return p.x >= e.left - pad && p.x <= e.right + pad && p.y >= e.top - pad && p.y <= e.bottom + pad;
};

// ── Aimed Shot ─────────────────────────────────────────────────────────────

const A = G.aimed;

/** A shot's lanes once locked: from the gun to the far wall (two for a double). */
export function shotLanes(p: ShotPart): [Point, Point][] {
  if (!p.dir || p.length === undefined) return [];
  const lane = (off: number): [Point, Point] => {
    const n = { x: -p.dir!.y * off, y: p.dir!.x * off };
    const a = { x: p.from.x + n.x, y: p.from.y + n.y };
    return [a, { x: a.x + p.dir!.x * p.length!, y: a.y + p.dir!.y * p.length! }];
  };
  return p.twin ? [lane(0), lane(p.twin)] : [lane(0)];
}

/** How far the shot has crossed (0 to 1), from `activeAt`. */
export const shotFront = (p: ShotPart, time: number): number =>
  Math.max(0, Math.min(1, (time - p.activeAt) / A.crossSec));

/** Locks the aim: the lane runs from the gun through the aim point to the far wall. */
function lock(p: ShotPart, box: Box): ShotPart {
  const toward = { x: p.aim.x - p.from.x, y: p.aim.y - p.from.y };
  const dir = Math.hypot(toward.x, toward.y) > 1e-6 ? unit(toward) : { x: 0, y: 1 };
  const through = throughBox(box, p.from, dir);
  return { ...p, dir, length: through ? through.tOut : 0 };
}

export const AIMED_SHOT: AttackDef = {
  id: 'aimedShot',
  name: 'Aimed Shot',
  kind: 'missile',
  start(ctx) {
    const parts: ShotPart[] = [];
    const track = A.trackSec[ctx.level];
    let t = ctx.time;
    for (let k = 0; k < A.shots[ctx.level]; k++) {
      const lockAt = t + track;
      const activeAt = lockAt + A.lockSec;
      const double = from(ctx, A.doubleFrom) && (k + 1) % A.doubleEvery === 0;
      parts.push({
        kind: 'shot',
        ...base(ctx, t, activeAt),
        from: gunSpot(ctx.rng, ctx.box),
        aim: { ...ctx.pos },
        lockAt,
        ...(double ? { twin: (coin(ctx.rng) ? 1 : -1) * A.doubleApart } : {}),
      });
      t = activeAt + A.crossSec + A.gapSec;
    }
    return { parts, endsAt: 'parts' };
  },
};

const SHOT_RULES: PartRules<ShotPart> = {
  update(p, w) {
    if (w.time < p.lockAt) return { part: { ...p, aim: { ...w.pos } } };
    return { part: p.dir ? p : lock(p, w.box) };
  },
  shapes(p, w, t0) {
    // While the shot crosses: each lane from the gun to the shot's front.
    if (w.time < p.activeAt || t0 > p.activeAt + A.crossSec) return [];
    const front = shotFront(p, w.time);
    return shotLanes(p).map(([a, b]) => ({
      kind: 'segment',
      x1: a.x,
      y1: a.y,
      x2: a.x + (b.x - a.x) * front,
      y2: a.y + (b.y - a.y) * front,
      half: A.laneWidth / 2,
    }));
  },
  done: (p, w) => w.time > p.activeAt + A.crossSec + A.trailSec,
};

// ── Snipe ──────────────────────────────────────────────────────────────────

const SN = G.snipe;

function crosshair(ctx: AttackCtx, warnAt: number): CrosshairPart {
  const follow = SN.follow[ctx.level];
  const lockAt = warnAt + follow.sec;
  return {
    kind: 'crosshair',
    ...base(ctx, warnAt, lockAt + SN.lockSec),
    x: ctx.pos.x,
    y: ctx.pos.y,
    speed: follow.share * D.moveSpeed,
    lockAt,
    holeSec: SN.holeSec[ctx.level] * (ctx.state.sandbags ? 0.5 : 1),
  };
}

export const SNIPE: AttackDef = {
  id: 'snipe',
  name: 'Snipe',
  kind: 'changer',
  start(ctx) {
    const first = crosshair(ctx, ctx.time);
    if (!from(ctx, SN.twiceFrom)) return { parts: [first], endsAt: 'parts' };
    return { parts: [first, crosshair(ctx, first.activeAt + SN.blastSec)], endsAt: 'parts' };
  },
};

/** The holes up now (not yet gone). */
const holesIn = (parts: readonly Part[]): HolePart[] =>
  parts.filter((q): q is HolePart => q.kind === 'hole');

/** A hole's size now: full until it starts to fade, then shrinking to nothing. */
export function holeRadius(p: HolePart, time: number): number {
  if (time <= p.until) return p.r;
  return p.r * Math.max(0, 1 - (time - p.until) / SN.fadeSec);
}

/** Whether a new hole of radius `r` fits: under the most at once, and under the most of the box. */
export function holeFits(parts: readonly Part[], box: Box, r: number): boolean {
  const holes = holesIn(parts);
  if (holes.length >= SN.maxHoles) return false;
  const area = (q: number) => Math.PI * q * q;
  const covered = holes.reduce((sum, h) => sum + area(h.r), 0);
  return covered + area(r) <= SN.maxCover * box.w * box.h;
}

const CROSSHAIR_RULES: PartRules<CrosshairPart> = {
  update(p, w) {
    // Before it shows, it sits on the sprite; then it follows, a little slower.
    if (w.time < p.warnAt) return { part: { ...p, x: w.pos.x, y: w.pos.y } };
    if (w.time < p.lockAt) {
      const dx = w.pos.x - p.x;
      const dy = w.pos.y - p.y;
      const d = Math.hypot(dx, dy);
      const stepBy = Math.min(d, p.speed * w.dt);
      return d > 1e-9
        ? { part: { ...p, x: p.x + (dx / d) * stepBy, y: p.y + (dy / d) * stepBy } }
        : { part: p };
    }
    if (p.blasted || w.time < p.activeAt) return { part: p };
    const blasted: CrosshairPart = { ...p, blasted: true };
    if (!holeFits(w.parts, w.box, SN.holeRadius)) return { part: blasted };
    const hole: HolePart = {
      kind: 'hole',
      id: w.nextId(),
      round: p.round,
      warnAt: w.time,
      activeAt: w.time,
      child: true,
      x: p.x,
      y: p.y,
      r: SN.holeRadius,
      until: w.time + p.holeSec,
    };
    return { part: blasted, spawn: [hole] };
  },
  // The blast hits at one moment.
  shapes: (p, w, t0) =>
    t0 < p.activeAt && w.time >= p.activeAt
      ? [{ kind: 'circle', x: p.x, y: p.y, r: SN.blastRadius }]
      : [],
  outline: (p, w, t0) =>
    t0 < p.activeAt && w.time >= p.activeAt
      ? [{ kind: 'circle', x: p.x, y: p.y, r: SN.blastRadius }]
      : [],
  damage: () => SN.damage,
  done: (p, w) => w.time > p.activeAt + SN.blastSec,
};

const HOLE_RULES: PartRules<HolePart> = {
  shapes: () => [],
  blocks: (p, w) => {
    const r = holeRadius(p, w.time);
    return r > 0 ? [{ x: p.x, y: p.y, r }] : [];
  },
  done: (p, w) => w.time > p.until + SN.fadeSec,
};

// ── Bear Traps ─────────────────────────────────────────────────────────────

const T = G.traps;

/** Traps lying open now. */
const openTraps = (parts: readonly Part[], time: number): TrapPart[] =>
  parts.filter(
    (q): q is TrapPart =>
      q.kind === 'trap' && !q.gone && q.shutAt === undefined && time < q.openUntil,
  );

/** Where the bear tosses from: above the middle of the box's top. */
export const tossFrom = (box: Box): Point => ({ x: box.cx, y: edges(box).top - 10 });

/** A trap's spot in the air (`u` from 0 at the toss to 1 at the landing), along its arc. */
export function trapArc(p: TrapPart, u: number): Point {
  const k = Math.max(0, Math.min(1, u));
  return {
    x: p.from.x + (p.x - p.from.x) * k,
    y: p.from.y + (p.y - p.from.y) * k - Math.sin(Math.PI * k) * 18,
  };
}

export const BEAR_TRAPS: AttackDef = {
  id: 'traps',
  name: 'Bear Traps',
  kind: 'changer',
  start(ctx) {
    const already = openTraps(ctx.state.parts, ctx.time);
    const room = Math.max(0, T.maxOpen - already.length);
    const holes = holesIn(ctx.state.parts);
    const taken: Point[] = already.map((q) => ({ x: q.x, y: q.y }));
    const parts: TrapPart[] = [];
    const open = T.openSec[ctx.level] * (ctx.state.sandbags ? 0.5 : 1);
    for (let k = 0; k < Math.min(T.count[ctx.level], room); k++) {
      let spot: Point | null = null;
      for (let tries = 0; tries < 40 && !spot; tries++) {
        const at = spotIn(ctx.rng, ctx.box, 10);
        if (dist(at, ctx.pos) < T.pickAway) continue;
        if (taken.some((q) => dist(q, at) < T.apart)) continue;
        if (holes.some((h) => dist(h, at) < h.r + 9)) continue;
        spot = at;
      }
      if (!spot) continue;
      taken.push(spot);
      const warnAt = ctx.time + k * T.tossGapSec;
      const activeAt = warnAt + warnFor(ctx, T.shadowSec);
      // It lands gray and harmless, then turns red; its open time starts then.
      const armAt = activeAt + T.armSec;
      parts.push({
        kind: 'trap',
        ...base(ctx, warnAt, activeAt),
        from: tossFrom(ctx.box),
        x: spot.x,
        y: spot.y,
        armAt,
        openUntil: armAt + open,
      });
    }
    // The round is over once they've landed; the traps stay.
    const landed = parts.reduce((last, q) => Math.max(last, q.activeAt), ctx.time);
    return { parts, endsAt: landed };
  },
};

const TRAP_RULES: PartRules<TrapPart> = {
  update(p, w) {
    // Landing: never right by the sprite (or past the most open at once).
    if (p.gone || w.time < p.activeAt || w.time - w.dt >= p.activeAt) return { part: p };
    const others = openTraps(w.parts, w.time).filter((q) => q.id !== p.id);
    if (dist(p, w.pos) < T.away || others.length >= T.maxOpen) {
      return { part: { ...p, gone: true } };
    }
    return { part: p };
  },
  shapes(p, w) {
    // Gray (arming) traps never bite.
    if (p.gone || p.shutAt !== undefined || w.time < p.armAt || w.time >= p.openUntil) return [];
    return [{ kind: 'ellipse', cx: p.x, cy: p.y, rx: T.hit[0], ry: T.hit[1] }];
  },
  onHit: (p, w) => ({ part: { ...p, shutAt: w.time }, slowSec: T.slowSec }),
  done: (p, w) =>
    !!p.gone ||
    (p.shutAt !== undefined && w.time > p.shutAt + T.closedFadeSec) ||
    w.time > p.openUntil + T.openFadeSec,
};

// ── Rapid Fire ─────────────────────────────────────────────────────────────

const R = G.rapid;

/** A bullet's middle at a time (at the gun until it fires). */
export const bulletAt = (p: BulletPart, time: number): Point => {
  const t = Math.max(0, time - p.activeAt);
  return { x: p.x + p.vx * t, y: p.y + p.vy * t };
};

export const RAPID_FIRE: AttackDef = {
  id: 'rapidFire',
  name: 'Rapid Fire',
  kind: 'missile',
  start(ctx) {
    const gun = gunSpot(ctx.rng, ctx.box);
    const mid = Math.atan2(ctx.pos.y - gun.y, ctx.pos.x - gun.x);
    const half = R.spreadDeg * DEG;
    const n = R.bullets[ctx.level];
    const speed = R.speed[ctx.level] * ctx.state.pace;
    const fireAt = ctx.time + warnFor(ctx, R.warnSec);
    const parts: BulletPart[] = Array.from({ length: n }, (_, k) => {
      const a = mid + (nextFloat(ctx.rng) * 2 - 1) * half;
      return {
        kind: 'bullet',
        ...base(ctx, ctx.time, fireAt + (k * R.sec) / n),
        x: gun.x,
        y: gun.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        ...(k === 0 ? { cone: { at: mid, half, until: fireAt + R.sec } } : {}),
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const BULLET_RULES: PartRules<BulletPart> = {
  shapes: (p, w, t0) => sweep((t) => bulletAt(p, t), p.activeAt, t0, w.time, R.radius),
  done: (p, w) =>
    w.time > p.activeAt &&
    (p.cone ? w.time > p.cone.until : true) &&
    !nearBox(w.box, bulletAt(p, w.time), 6),
};

// ── Ricochet (Claude's idea) ───────────────────────────────────────────────

const RI = G.ricochet;

/**
 * A ricochet's path: from the gun into the box toward `aim`, bouncing off
 * the walls `bounces` times, then out through a wall.
 */
export function ricochetPath(box: Box, gun: Point, aim: Point, bounces: number): Point[] {
  const toward = { x: aim.x - gun.x, y: aim.y - gun.y };
  let dir = Math.hypot(toward.x, toward.y) > 1e-6 ? unit(toward) : { x: 0, y: 1 };
  const through = throughBox(box, gun, dir);
  if (!through) return [gun, { x: gun.x + dir.x * 20, y: gun.y + dir.y * 20 }];
  let at = { x: gun.x + dir.x * (through.tIn + 0.01), y: gun.y + dir.y * (through.tIn + 0.01) };
  const path: Point[] = [gun];
  const e = edges(box);
  for (let k = 0; k < bounces; k++) {
    const d = rayToWall(box, at, dir);
    const hit = { x: at.x + dir.x * d, y: at.y + dir.y * d };
    path.push(hit);
    const flipX = Math.abs(hit.x - e.left) < 1e-6 || Math.abs(hit.x - e.right) < 1e-6;
    const flipY = Math.abs(hit.y - e.top) < 1e-6 || Math.abs(hit.y - e.bottom) < 1e-6;
    dir = { x: flipX ? -dir.x : dir.x, y: flipY ? -dir.y : dir.y };
    at = hit;
  }
  const d = rayToWall(box, at, dir);
  path.push({ x: at.x + dir.x * (d + 8), y: at.y + dir.y * (d + 8) });
  return path;
}

/** Where a ricochet bullet is along its path at a time, and which way it's going. */
export function ricochetAt(p: RicochetPart, time: number): { at: Point; end: boolean } {
  let left = Math.max(0, time - p.activeAt) * p.speed;
  for (let i = 0; i < p.path.length - 1; i++) {
    const a = p.path[i]!;
    const b = p.path[i + 1]!;
    const len = dist(a, b);
    if (left <= len) {
      const k = len ? left / len : 0;
      return { at: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, end: false };
    }
    left -= len;
  }
  return { at: { ...p.path.at(-1)! }, end: true };
}

export const RICOCHET: AttackDef = {
  id: 'ricochet',
  name: 'Ricochet',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    // Every path shows at once; then the shots fire a moment apart, each from its own spot.
    const fireAt = ctx.time + warnFor(ctx, RI.warnSec);
    const parts: RicochetPart[] = Array.from({ length: ricochetShots(ctx) }, (_, k) => ({
      kind: 'ricochet',
      ...base(ctx, ctx.time, fireAt + k * RI.gapSec),
      path: ricochetPath(ctx.box, gunSpot(ctx.rng, ctx.box), ctx.pos, RI.bounces[ctx.level]),
      speed: RI.speed * ctx.state.pace,
    }));
    return { parts, endsAt: 'parts' };
  },
};

/** How many Ricochet shots: by the tier (section 3.2). */
export const ricochetShots = (ctx: Pick<AttackCtx, 'state'>): number => RI.shots[ctx.state.hudTier];

const RICOCHET_RULES: PartRules<RicochetPart> = {
  shapes: (p, w, t0) => sweep((t) => ricochetAt(p, t).at, p.activeAt, t0, w.time, RI.radius),
  done: (p, w) => w.time > p.activeAt && ricochetAt(p, w.time).end,
};

// ── Bullet Ring ────────────────────────────────────────────────────────────

const BR = G.bulletRing;

/** Where the rings come from: the middle of the box's top edge. */
export const ringFrom = (box: Box): Point => ({ x: box.cx, y: edges(box).top });

/**
 * A ring's pellets now: only the ones flying into the box count (those
 * that start out of it, up and away from the top edge, don't).
 */
export function ringPellets(p: BulletRingPart, time: number): Point[] {
  const r = Math.max(0, time - p.activeAt) * p.speed;
  const out: Point[] = [];
  for (let k = 0; k < p.pellets; k++) {
    const a = p.a0 + (2 * Math.PI * k) / p.pellets;
    const dy = Math.sin(a);
    if (dy <= 1e-6) continue;
    out.push({ x: p.from.x + Math.cos(a) * r, y: p.from.y + dy * r });
  }
  return out;
}

export const BULLET_RING: AttackDef = {
  id: 'bulletRing',
  name: 'Bullet Ring',
  kind: 'missile',
  fromTier: BR.fromTier as 4,
  start(ctx) {
    const from = ringFrom(ctx.box);
    const fireAt = ctx.time + warnFor(ctx, BR.warnSec);
    const turn = BR.turnDeg * DEG;
    const a0 = nextFloat(ctx.rng) * ((2 * Math.PI) / BR.bullets);
    const parts: BulletRingPart[] = Array.from({ length: BR.rings[ctx.state.hudTier] }, (_, k) => ({
      kind: 'bulletRing',
      ...base(ctx, ctx.time, fireAt + k * BR.apartSec),
      from,
      a0: a0 + k * turn,
      pellets: BR.bullets,
      speed: BR.speed * ctx.state.pace,
      ...(k === 0 ? { first: true as const } : {}),
    }));
    return { parts, endsAt: 'parts' };
  },
};

const BULLET_RING_RULES: PartRules<BulletRingPart> = {
  shapes: (p, w) =>
    w.time < p.activeAt
      ? []
      : ringPellets(p, w.time).map((q) => ({ kind: 'circle', x: q.x, y: q.y, r: BR.radius })),
  // Gone once every pellet is past the box's far corners.
  done: (p, w) => w.time > p.activeAt + (Math.hypot(w.box.w, w.box.h) + 8) / p.speed,
};

// ── Quick Draw (Claude's idea) ─────────────────────────────────────────────

const Q = G.quickDraw;

/** The band's thickness in a box this big: never more than leaves the safe share. */
const bandIn = (span: number) => Math.min(Q.band, span * (1 - Q.safeShare));

/** Quick Draw's two bands as rectangles: the row (and the column, once picked). */
export function quickDrawBands(
  p: QuickDrawPart,
  box: Box,
): { row: Shape & { kind: 'rect' }; col?: Shape & { kind: 'rect' } } {
  const e = edges(box);
  const bh = bandIn(box.h);
  const bw = bandIn(box.w);
  const row = {
    kind: 'rect' as const,
    x: e.left,
    y: Math.min(e.bottom - bh, Math.max(e.top, p.row - bh / 2)),
    w: box.w,
    h: bh,
  };
  if (p.col === undefined) return { row };
  return {
    row,
    col: {
      kind: 'rect',
      x: Math.min(e.right - bw, Math.max(e.left, p.col - bw / 2)),
      y: e.top,
      w: bw,
      h: box.h,
    },
  };
}

export const QUICK_DRAW: AttackDef = {
  id: 'quickDraw',
  name: 'Quick Draw',
  kind: 'area',
  claudesIdea: true,
  start(ctx) {
    const activeAt = ctx.time + warnFor(ctx, Q.warnSec);
    return {
      parts: [
        {
          kind: 'quickDraw',
          ...base(ctx, ctx.time, activeAt),
          row: ctx.pos.y,
          colAt: activeAt + Q.gapSec,
          band: Q.band,
        },
      ],
      endsAt: 'parts',
    };
  },
};

const QUICK_DRAW_RULES: PartRules<QuickDrawPart> = {
  update: (p, w) =>
    p.col === undefined && w.time >= p.activeAt ? { part: { ...p, col: w.pos.x } } : { part: p },
  shapes(p, w, t0) {
    const bands = quickDrawBands(p, w.box);
    const firing = (at: number) => w.time >= at && t0 < at + Q.blastSec;
    const out: Shape[] = [];
    if (firing(p.activeAt)) out.push(bands.row);
    if (bands.col && firing(p.colAt)) out.push(bands.col);
    return out;
  },
  done: (p, w) => w.time > p.colAt + Q.blastSec,
};

// ── The library's pieces ───────────────────────────────────────────────────

export const GUN_ATTACKS: readonly AttackDef[] = [
  AIMED_SHOT,
  SNIPE,
  BEAR_TRAPS,
  RAPID_FIRE,
  RICOCHET,
  BULLET_RING,
  QUICK_DRAW,
];

export const GUN_RULES: {
  [K in GunPart['kind']]: PartRules<Extract<GunPart, { kind: K }>>;
} = {
  shot: SHOT_RULES,
  crosshair: CROSSHAIR_RULES,
  hole: HOLE_RULES,
  trap: TRAP_RULES,
  bullet: BULLET_RULES,
  ricochet: RICOCHET_RULES,
  bulletRing: BULLET_RING_RULES,
  quickDraw: QUICK_DRAW_RULES,
};

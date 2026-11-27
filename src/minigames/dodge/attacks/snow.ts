/**
 * The snow animals (docs/design/23-minigames-final.md, sections 9.2 and
 * 9.3). Their whole box is ice (logic.ts). Every attack here is Claude's
 * idea; the Snow Leopard also has the shared Claws.
 *
 * - **The Snow Leopard:**
 *   - **Pounce** (missile): he crouches at the edge nearest the sprite; a red
 *     dotted line shows his path to where the sprite is; then he leaps along
 *     it. At Level 3 sometimes a second leap.
 *   - **Prowl** (missile): he pads round the box's edge (outside it,
 *     harmless), then pounces from where he stops, with a shorter warning.
 *   - **Tail Sweep** (area): a band along the bottom or one side is warned,
 *     then his tail sweeps through it.
 *   - **Snow Kick** (missile): a cone of snow pellets from one side.
 * - **The Abominable Snowgirl:**
 *   - **Snowballs** (missile): lobbed in arcs, each landing on a shadow that
 *     grows, then bursting into chunks that slide outward across the ice.
 *   - **Icicles** (missile): icicles along the top glint, then drop one after
 *     another.
 *   - **Antler Charge** (area): a stripe across the box is warned, then she
 *     charges through it. Level 3: two stripes that cross.
 *   - **Shake Off** (missile): a ring of snowflakes bursts from the middle,
 *     then a second ring turned half a gap.
 *   - **Avalanche** (area, Level 3): snow falls down the box in columns,
 *     with one gap.
 */
import { BALANCE } from '../../../config/balance';
import { nextFloat } from '../../../engine/rng';
import {
  between,
  coin,
  DEG,
  dist,
  edges,
  INWARD,
  onSide,
  oneOf,
  SIDES,
  spotIn,
  throughBox,
  unit,
  type Box,
  type Side,
} from '../geometry';
import type { Point } from '../shapes';
import type { AttackCtx, AttackDef, PartBase, PartRules } from '../types';
import { base, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const S = D.snow;

// ── Parts ──────────────────────────────────────────────────────────────────

/**
 * A leap (Pounce and Prowl): from `from` (just outside a wall) through
 * `to`, on out of the box. A prowl's target is set as it stops (`aimAt`).
 */
export interface LeapPart extends PartBase {
  kind: 'leap';
  from: Point;
  to: Point;
  speed: number;
  /** Prowl: until this time he pads round the edge, then aims. */
  prowl?: { side: Side; from: number; to: number; speed: number; aimAt: number };
}

/** Tail Sweep: a band along a wall, swept from `activeAt` for [0.4 s]. */
export interface TailPart extends PartBase {
  kind: 'tail';
  side: 'bottom' | 'left' | 'right';
}

/** A snow pellet (Snow Kick) or a sliding chunk (a burst snowball), flying straight. */
export interface PelletPart extends PartBase {
  kind: 'pellet';
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** A chunk slides to a stop and goes after this; a pellet goes once it's out of the box. */
  until?: number;
  big?: true;
}

/** A snowball lobbed onto its shadow at (x, y), landing at `activeAt`. */
export interface SnowballPart extends PartBase {
  kind: 'snowball';
  x: number;
  y: number;
  from: Point;
  burst?: true;
}

/** An icicle along the top: glinting from `warnAt`, dropping at `activeAt`. */
export interface IciclePart extends PartBase {
  kind: 'icicle';
  x: number;
  top: number;
  speed: number;
}

/** Antler Charge: across the box along a stripe (`dir` from `from`). */
export interface ChargePart extends PartBase {
  kind: 'charge';
  from: Point;
  dir: Point;
  reach: number;
  speed: number;
}

/** Shake Off: a ring of flakes out from the middle (the first at angle `a0`). */
export interface FlakesPart extends PartBase {
  kind: 'flakes';
  from: Point;
  a0: number;
  n: number;
  speed: number;
}

/** Avalanche: snow down the box in columns, with one gap column. */
/**
 * Avalanche: snow falls down the box in columns, with one gap (Nov 26
 * evening: [38] units wide, starting near the sprite). `gapAt` is the gap's
 * left edge, measured from the box's left wall.
 */
export interface AvalanchePart extends PartBase {
  kind: 'avalanche';
  gapAt: number;
  gapW: number;
  speed: number;
}

export type SnowPart =
  | LeapPart
  | TailPart
  | PelletPart
  | SnowballPart
  | IciclePart
  | ChargePart
  | FlakesPart
  | AvalanchePart;

// ── Pounce and Prowl ───────────────────────────────────────────────────────

/** The wall nearest a spot. */
function nearestSide(box: Box, p: Point): Side {
  const e = edges(box);
  const d: [Side, number][] = [
    ['left', p.x - e.left],
    ['right', e.right - p.x],
    ['top', p.y - e.top],
    ['bottom', e.bottom - p.y],
  ];
  return d.sort((a, b) => a[1] - b[1])[0]![0];
}

/** A leap from a wall's spot to the target, on out of the box. */
function leapPath(box: Box, from: Point, target: Point): { from: Point; to: Point } {
  const dir = unit({ x: target.x - from.x, y: target.y - from.y });
  const t = throughBox(box, from, dir);
  const out = (t ? t.tOut : dist(from, target)) + 20;
  return { from, to: { x: from.x + dir.x * out, y: from.y + dir.y * out } };
}

/** Where a leap is now (the prowl pads round the edge first). */
export function leapAt(p: LeapPart, box: Box, time: number): Point {
  if (p.prowl && time < p.prowl.aimAt) {
    const u = Math.min(
      1,
      Math.max(0, (time - p.warnAt) * p.prowl.speed) / Math.abs(p.prowl.to - p.prowl.from || 1),
    );
    return onSide(box, p.prowl.side, p.prowl.from + (p.prowl.to - p.prowl.from) * u, 10);
  }
  const d = Math.max(0, time - p.activeAt) * p.speed;
  const dir = unit({ x: p.to.x - p.from.x, y: p.to.y - p.from.y });
  return { x: p.from.x + dir.x * d, y: p.from.y + dir.y * d };
}

/** Pounce: from the wall nearest the sprite, at where it is now. */
function pounceFrom(ctx: AttackCtx, warnAt: number, target: Point): LeapPart {
  const side = nearestSide(ctx.box, target);
  const e = edges(ctx.box);
  const along =
    side === 'left' || side === 'right'
      ? (target.y - e.top) / ctx.box.h
      : (target.x - e.left) / ctx.box.w;
  const from = onSide(ctx.box, side, Math.max(0.1, Math.min(0.9, along)), 10);
  return {
    kind: 'leap',
    ...base(ctx, warnAt, warnAt + warnFor(ctx, S.pounce.warnSec)),
    ...leapPath(ctx.box, from, target),
    speed: S.pounce.speed * ctx.speed,
  };
}

export const LEOPARD_POUNCE: AttackDef = {
  id: 'leopardPounce',
  name: 'Pounce',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const first = pounceFrom(ctx, ctx.time, ctx.pos);
    const parts = [first];
    if (ctx.level >= 3 && nextFloat(ctx.rng) < S.pounce.doubleChance) {
      const again = pounceFrom(ctx, first.activeAt + 0.3, spotIn(ctx.rng, ctx.box, 12));
      parts.push(again);
    }
    return { parts, endsAt: 'parts' };
  },
};

export const PROWL: AttackDef = {
  id: 'prowl',
  name: 'Prowl',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const side = oneOf(ctx.rng, SIDES);
    const len = side === 'left' || side === 'right' ? ctx.box.h : ctx.box.w;
    const a = between(ctx.rng, 0.1, 0.9);
    const b = Math.max(
      0.1,
      Math.min(0.9, a + (coin(ctx.rng) ? 1 : -1) * between(ctx.rng, 0.3, 0.6)),
    );
    const aimAt = ctx.time + S.prowl.sec;
    const from = onSide(ctx.box, side, b, 10);
    const part: LeapPart = {
      kind: 'leap',
      ...base(ctx, ctx.time, aimAt + warnFor(ctx, S.prowl.warnSec)),
      from,
      to: from,
      speed: S.pounce.speed * ctx.speed,
      prowl: { side, from: a, to: b, speed: S.prowl.speed / len, aimAt },
    };
    return { parts: [part], endsAt: 'parts' };
  },
};

const LEAP_RULES: PartRules<LeapPart> = {
  // A prowl aims at the sprite as it stops.
  update(p, w) {
    if (!p.prowl || w.time < p.prowl.aimAt || p.to !== p.from) return { part: p };
    return { part: { ...p, ...leapPath(w.box, p.from, w.pos) } };
  },
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const at = leapAt(p, w.box, w.time);
    return [{ kind: 'circle', x: at.x, y: at.y, r: S.pounce.radius }];
  },
  done: (p, w) =>
    w.time > p.activeAt &&
    p.to !== p.from &&
    dist(leapAt(p, w.box, w.time), p.from) >= dist(p.to, p.from),
};

// ── Tail Sweep ─────────────────────────────────────────────────────────────

/** The band a tail sweep covers. */
export function tailBand(p: TailPart, box: Box): { x: number; y: number; w: number; h: number } {
  const e = edges(box);
  const b = S.tail.band;
  if (p.side === 'bottom') return { x: e.left, y: e.bottom - b, w: box.w, h: b };
  if (p.side === 'left') return { x: e.left, y: e.top, w: b, h: box.h };
  return { x: e.right - b, y: e.top, w: b, h: box.h };
}

export const TAIL_SWEEP: AttackDef = {
  id: 'tailSweep',
  name: 'Tail Sweep',
  kind: 'area',
  claudesIdea: true,
  movesAcross: true,
  start(ctx) {
    const part: TailPart = {
      kind: 'tail',
      ...base(ctx, ctx.time, ctx.time + warnFor(ctx, S.tail.warnSec)),
      side: oneOf(ctx.rng, ['bottom', 'left', 'right'] as const),
    };
    return { parts: [part], endsAt: 'parts' };
  },
};

const TAIL_RULES: PartRules<TailPart> = {
  shapes: (p, w) =>
    w.time >= p.activeAt && w.time < p.activeAt + S.tail.sweepSec
      ? [{ kind: 'rect', ...tailBand(p, w.box) }]
      : [],
  done: (p, w) => w.time > p.activeAt + S.tail.sweepSec,
};

// ── Snow Kick, and the chunks of a burst snowball ──────────────────────────

/** Where a pellet (or chunk) is now: a chunk slows as it slides. */
export function pelletAt(p: PelletPart, time: number): Point {
  const t = Math.max(0, time - p.activeAt);
  if (p.until === undefined) return { x: p.x + p.vx * t, y: p.y + p.vy * t };
  // Sliding on ice: the same friction as the sprite.
  const k = D.ice.friction;
  const d = (1 - Math.exp(-k * t)) / k;
  return { x: p.x + p.vx * d, y: p.y + p.vy * d };
}

export const SNOW_KICK: AttackDef = {
  id: 'snowKick',
  name: 'Snow Kick',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const side = oneOf(ctx.rng, SIDES);
    const from = onSide(ctx.box, side, between(ctx.rng, 0.25, 0.75), 6);
    const mid = Math.atan2(INWARD[side].y, INWARD[side].x);
    const n = Math.round(between(ctx.rng, S.kick.count[0], S.kick.count[1] + 0.99) - 0.49);
    const activeAt = ctx.time + warnFor(ctx, S.kick.warnSec);
    const parts: PelletPart[] = Array.from({ length: n }, (_, k) => {
      const a = mid + (nextFloat(ctx.rng) * 2 - 1) * S.kick.spreadDeg * DEG;
      const speed = S.kick.speed * ctx.speed * between(ctx.rng, 0.8, 1.2);
      return {
        kind: 'pellet',
        ...base(ctx, ctx.time, activeAt + k * 0.03),
        x: from.x,
        y: from.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const PELLET_RULES: PartRules<PelletPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const at = pelletAt(p, w.time);
    return [
      { kind: 'circle', x: at.x, y: at.y, r: p.big ? S.snowballs.chunkRadius : S.kick.radius },
    ];
  },
  done(p, w) {
    if (p.until !== undefined) return w.time > p.until;
    const at = pelletAt(p, w.time);
    const e = edges(w.box);
    return (
      w.time > p.activeAt &&
      (at.x < e.left - 8 || at.x > e.right + 8 || at.y < e.top - 8 || at.y > e.bottom + 8)
    );
  },
};

// ── Snowballs ──────────────────────────────────────────────────────────────

export const SNOWBALLS: AttackDef = {
  id: 'snowballs',
  name: 'Snowballs',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const e = edges(ctx.box);
    const n = S.snowballs.count[ctx.level];
    const from = { x: ctx.box.cx, y: e.top - 20 };
    const parts: SnowballPart[] = Array.from({ length: n }, (_, k) => {
      const at = k === 0 ? { ...ctx.pos } : spotIn(ctx.rng, ctx.box, 10);
      const warnAt = ctx.time + k * S.snowballs.apartSec;
      return {
        kind: 'snowball',
        ...base(ctx, warnAt, warnAt + warnFor(ctx, S.snowballs.lobSec)),
        x: at.x,
        y: at.y,
        from,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const SNOWBALL_RULES: PartRules<SnowballPart> = {
  // It lands and bursts into chunks that slide outward.
  update(p, w) {
    if (p.burst || w.time < p.activeAt) return { part: p };
    const n = S.snowballs.chunks;
    const a0 = nextFloat(w.rng) * Math.PI;
    const spawn: PelletPart[] = Array.from({ length: n }, (_, k) => {
      const a = a0 + (2 * Math.PI * k) / n;
      return {
        kind: 'pellet',
        id: w.nextId(),
        round: p.round,
        warnAt: w.time,
        activeAt: w.time,
        child: true,
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * S.snowballs.chunkSpeed,
        vy: Math.sin(a) * S.snowballs.chunkSpeed,
        until: w.time + S.snowballs.chunkSec,
        big: true,
      };
    });
    return { part: { ...p, burst: true }, spawn };
  },
  shapes: (p, w) =>
    w.time >= p.activeAt && w.time < p.activeAt + 0.1
      ? [{ kind: 'circle', x: p.x, y: p.y, r: S.snowballs.radius }]
      : [],
  done: (p, w) => !!p.burst && w.time > p.activeAt + 0.1,
};

// ── Icicles ────────────────────────────────────────────────────────────────

/** Where an icicle's tip is now (hanging at the top until it drops). */
export const icicleTip = (p: IciclePart, time: number): number =>
  p.top + S.icicles.length + Math.max(0, time - p.activeAt) * p.speed;

export const ICICLES: AttackDef = {
  id: 'icicles',
  name: 'Icicles',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const e = edges(ctx.box);
    const n = Math.round(between(ctx.rng, S.icicles.count[0], S.icicles.count[1] + 0.99) - 0.49);
    const xs = Array.from({ length: n }, (_, k) => e.left + ((k + 0.5) * ctx.box.w) / n);
    const order = xs.map((x) => x).sort(() => nextFloat(ctx.rng) - 0.5);
    const dropFrom = ctx.time + warnFor(ctx, S.icicles.glintSec);
    const parts: IciclePart[] = order.map((x, k) => ({
      kind: 'icicle',
      ...base(ctx, ctx.time, dropFrom + k * S.icicles.apartSec),
      x,
      top: e.top,
      speed: S.icicles.speed * ctx.speed,
    }));
    return { parts, endsAt: 'parts' };
  },
};

const ICICLE_RULES: PartRules<IciclePart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const tip = icicleTip(p, w.time);
    return [
      {
        kind: 'segment',
        x1: p.x,
        y1: tip - S.icicles.length,
        x2: p.x,
        y2: tip,
        half: S.icicles.half,
      },
    ];
  },
  done: (p, w) => icicleTip(p, w.time) - S.icicles.length > edges(w.box).bottom,
};

// ── Antler Charge ──────────────────────────────────────────────────────────

/** Where she is on her charge now. */
export function chargeAt(p: ChargePart, time: number): Point {
  const d = Math.max(0, time - p.activeAt) * p.speed;
  return { x: p.from.x + p.dir.x * d, y: p.from.y + p.dir.y * d };
}

export const ANTLER_CHARGE: AttackDef = {
  id: 'antlerCharge',
  name: 'Antler Charge',
  kind: 'area',
  claudesIdea: true,
  movesAcross: true,
  start(ctx) {
    const e = edges(ctx.box);
    const activeAt = ctx.time + warnFor(ctx, S.charge.warnSec);
    const across = (horizontal: boolean, at: number, forward: boolean): ChargePart => {
      const pad = 20;
      const from = horizontal
        ? { x: forward ? e.left - pad : e.right + pad, y: at }
        : { x: at, y: forward ? e.top - pad : e.bottom + pad };
      const dir = horizontal ? { x: forward ? 1 : -1, y: 0 } : { x: 0, y: forward ? 1 : -1 };
      return {
        kind: 'charge',
        ...base(ctx, ctx.time, activeAt),
        from,
        dir,
        reach: (horizontal ? ctx.box.w : ctx.box.h) + 2 * pad,
        speed: S.charge.speed * ctx.speed,
      };
    };
    const horizontal = coin(ctx.rng);
    const first = horizontal
      ? across(true, between(ctx.rng, e.top + 12, e.bottom - 12), coin(ctx.rng))
      : across(false, between(ctx.rng, e.left + 12, e.right - 12), coin(ctx.rng));
    const parts = [first];
    // Level 3: two stripes that cross.
    if (ctx.level >= 3) {
      parts.push(
        horizontal
          ? across(false, between(ctx.rng, e.left + 12, e.right - 12), coin(ctx.rng))
          : across(true, between(ctx.rng, e.top + 12, e.bottom - 12), coin(ctx.rng)),
      );
    }
    return { parts, endsAt: 'parts' };
  },
};

const CHARGE_RULES: PartRules<ChargePart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const at = chargeAt(p, w.time);
    return [{ kind: 'circle', x: at.x, y: at.y, r: S.charge.radius }];
  },
  done: (p, w) => w.time > p.activeAt + p.reach / p.speed,
};

// ── Shake Off ──────────────────────────────────────────────────────────────

/** A ring's flakes now. */
export function flakesNow(p: FlakesPart, time: number): Point[] {
  const r = Math.max(0, time - p.activeAt) * p.speed;
  return Array.from({ length: p.n }, (_, k) => {
    const a = p.a0 + (2 * Math.PI * k) / p.n;
    return { x: p.from.x + Math.cos(a) * r, y: p.from.y + Math.sin(a) * r };
  });
}

export const SHAKE_OFF: AttackDef = {
  id: 'shakeOff',
  name: 'Shake Off',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const from = { x: ctx.box.cx, y: ctx.box.cy };
    const a0 = nextFloat(ctx.rng) * 2 * Math.PI;
    const activeAt = ctx.time + warnFor(ctx, S.shake.warnSec);
    const ring = (k: number): FlakesPart => ({
      kind: 'flakes',
      ...base(ctx, ctx.time, activeAt + k * S.shake.apartSec),
      from,
      a0: a0 + (k * Math.PI) / S.shake.flakes,
      n: S.shake.flakes,
      speed: S.shake.speed * ctx.speed,
    });
    return { parts: [ring(0), ring(1)], endsAt: 'parts' };
  },
};

const FLAKES_RULES: PartRules<FlakesPart> = {
  shapes: (p, w) =>
    w.time < p.activeAt
      ? []
      : flakesNow(p, w.time).map((q) => ({ kind: 'circle', x: q.x, y: q.y, r: S.shake.radius })),
  done: (p, w) => w.time > p.activeAt + (Math.hypot(w.box.w, w.box.h) / 2 + 8) / p.speed,
};

// ── Avalanche ──────────────────────────────────────────────────────────────

/** The snow band's top now, falling down the box. */
export function avalancheY(p: AvalanchePart, box: Box, time: number): number {
  return edges(box).top - S.avalanche.band + Math.max(0, time - p.activeAt) * p.speed;
}

/**
 * The falling columns (their left edge and width): the space on each side
 * of the gap split evenly into columns about [16] wide.
 */
export function avalancheColumns(p: AvalanchePart, box: Box): { x: number; w: number }[] {
  const e = edges(box);
  const split = (from: number, width: number) => {
    if (width < 0.5) return [];
    const n = Math.max(1, Math.round(width / S.avalanche.column));
    return Array.from({ length: n }, (_, k) => ({ x: from + (k * width) / n, w: width / n }));
  };
  const gapL = e.left + p.gapAt;
  return [...split(e.left, p.gapAt), ...split(gapL + p.gapW, e.right - gapL - p.gapW)];
}

/**
 * Where the gap goes: its middle within [60] units of the sprite, left or
 * right, but never over the sprite itself (with the ice, a far gap can't
 * be reached in time). In a box too small for that, anywhere off the sprite.
 */
export function avalancheGap(ctx: Pick<AttackCtx, 'box' | 'pos' | 'rng'>): number {
  const e = edges(ctx.box);
  const w = Math.min(S.avalanche.gap, ctx.box.w);
  const half = w / 2;
  const clear = half + D.hitRadius + 1;
  const spots: number[] = [];
  for (let c = Math.ceil(e.left + half); c <= e.right - half; c++) {
    const away = Math.abs(c - ctx.pos.x);
    if (away >= clear && away <= S.avalanche.near) spots.push(c);
  }
  if (!spots.length) {
    for (let c = Math.ceil(e.left + half); c <= e.right - half; c++) {
      if (Math.abs(c - ctx.pos.x) >= clear) spots.push(c);
    }
  }
  const middle = spots.length
    ? spots[Math.floor(nextFloat(ctx.rng) * spots.length)]!
    : e.left + between(ctx.rng, half, Math.max(half, ctx.box.w - half));
  return middle - half - e.left;
}

export const AVALANCHE: AttackDef = {
  id: 'avalanche',
  name: 'Avalanche',
  kind: 'area',
  claudesIdea: true,
  movesAcross: true,
  start(ctx) {
    const part: AvalanchePart = {
      kind: 'avalanche',
      ...base(ctx, ctx.time, ctx.time + warnFor(ctx, S.avalanche.warnSec)),
      gapAt: avalancheGap(ctx),
      gapW: Math.min(S.avalanche.gap, ctx.box.w),
      speed: S.avalanche.speed * ctx.speed,
    };
    return { parts: [part], endsAt: 'parts' };
  },
};

const AVALANCHE_RULES: PartRules<AvalanchePart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const y = avalancheY(p, w.box, w.time);
    return avalancheColumns(p, w.box).map((c) => ({
      kind: 'rect' as const,
      x: c.x,
      y,
      w: c.w,
      h: S.avalanche.band,
    }));
  },
  done: (p, w) => avalancheY(p, w.box, w.time) > edges(w.box).bottom,
};

// ── The library's pieces ───────────────────────────────────────────────────

export const SNOW_ATTACKS: readonly AttackDef[] = [
  LEOPARD_POUNCE,
  PROWL,
  TAIL_SWEEP,
  SNOW_KICK,
  SNOWBALLS,
  ICICLES,
  ANTLER_CHARGE,
  SHAKE_OFF,
  AVALANCHE,
];

export const SNOW_RULES: {
  [K in SnowPart['kind']]: PartRules<Extract<SnowPart, { kind: K }>>;
} = {
  leap: LEAP_RULES,
  tail: TAIL_RULES,
  pellet: PELLET_RULES,
  snowball: SNOWBALL_RULES,
  icicle: ICICLE_RULES,
  charge: CHARGE_RULES,
  flakes: FLAKES_RULES,
  avalanche: AVALANCHE_RULES,
};

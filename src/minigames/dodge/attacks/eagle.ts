/**
 * The Eagle (docs/design/23-minigames-final.md, section 9.1): each version
 * keeps the earlier ones' attacks and adds its own.
 *
 * - **Eagle:**
 *   - **Swoop** (Wyatt; missile): a dotted path across the box and "!" at its
 *     entry, then he flies along it. More in a row by level; from Level 2
 *     the last is aimed at the sprite.
 *   - **Feather Fall** (Claude's idea; missile): feathers drift down from the
 *     top, swaying.
 *   - **Talon Drop** (Claude's idea, Level 1 and up; missile): a shadow
 *     follows the sprite, stops, and the talons strike there.
 *   - **Wing Gust** (Claude's idea, Level 2 and up; changer): feathers stream
 *     across, then the sprite is pushed sideways for a while.
 * - **Toupeeagle** adds:
 *   - **Hair Toss** (Wyatt; missile): curly red hairs spin along curved arcs
 *     toward the sprite.
 *   - **Comb-Over** (Claude's idea; area): a wall of hair sweeps across the
 *     box from one side, with one gap.
 * - **Freeagle** adds Bear with a Gun's Aimed Shot and Rapid Fire (Wyatt:
 *   "a gun"), and **Oil Barrels** (Wyatt; changer): barrels land on their
 *   shadows, a fuse counts down, they burst, and each leaves an oil puddle
 *   where the sprite slides on ice.
 */
import { BALANCE } from '../../../config/balance';
import { nextFloat } from '../../../engine/rng';
import {
  between,
  coin,
  dist,
  edges,
  onSide,
  oneOf,
  SIDES,
  spotIn,
  throughBox,
  unit,
  type Box,
} from '../geometry';
import type { Point } from '../shapes';
import type { AttackCtx, AttackDef, PartBase, PartRules } from '../types';
import { base, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const E = D.eagle;

/** The level as an Easy-aware row (0 is Easy). */
const rankOf = (ctx: Pick<AttackCtx, 'easy' | 'level'>): 0 | 1 | 2 | 3 =>
  ctx.easy ? 0 : ctx.level;

// ── Parts ──────────────────────────────────────────────────────────────────

/** A swoop: the eagle flies a straight path across the box (`from` → `to`, both outside it). */
export interface SwoopPart extends PartBase {
  kind: 'swoop';
  from: Point;
  to: Point;
  speed: number;
  /** Where its "!" goes: the box's edge where it comes in. */
  mark: Point;
}

/** A feather drifting down from `x` above the box, swaying. */
export interface FeatherPart extends PartBase {
  kind: 'feather';
  x: number;
  y0: number;
  phase: number;
  bottom: number;
}

/** Talon Drop: the shadow follows the sprite until `stopAt`, then the talons strike there at `activeAt`. */
export interface TalonPart extends PartBase {
  kind: 'talon';
  x: number;
  y: number;
  stopAt: number;
}

/** Wing Gust: feathers stream (the warning), then the sprite is pushed `dir` until `until`. */
export interface GustPart extends PartBase {
  kind: 'gust';
  dir: 1 | -1;
  until: number;
}

/** A curly hair along a curved arc (`from`, bending through `bend`, to `to`). */
export interface HairPart extends PartBase {
  kind: 'hair';
  from: Point;
  bend: Point;
  to: Point;
  speed: number;
}

/** Comb-Over: a wall of hair sweeping across from `side`, with a gap at `gapAt`. */
export interface CombPart extends PartBase {
  kind: 'comb';
  side: 'left' | 'right';
  gapAt: number;
  speed: number;
}

/** An oil barrel: tossed (its shadow from `warnAt`), landing at `activeAt`, bursting at `burstAt`. */
export interface BarrelPart extends PartBase {
  kind: 'barrel';
  x: number;
  y: number;
  burstAt: number;
  /** It burst and left its puddle. */
  burst?: true;
}

/** An oil puddle: slippery until `until`. */
export interface OilPart extends PartBase {
  kind: 'oil';
  x: number;
  y: number;
  r: number;
  until: number;
}

export type EaglePart =
  SwoopPart | FeatherPart | TalonPart | GustPart | HairPart | CombPart | BarrelPart | OilPart;

// ── Swoop ──────────────────────────────────────────────────────────────────

/** Where a swoop is at a time (it starts at `from`). */
export function swoopAt(p: SwoopPart, time: number): Point {
  const d = Math.max(0, time - p.activeAt) * p.speed;
  const dir = unit({ x: p.to.x - p.from.x, y: p.to.y - p.from.y });
  return { x: p.from.x + dir.x * d, y: p.from.y + dir.y * d };
}

/** A path across the box: in from a side, through `through` (or a random spot), out the far side. */
function crossing(ctx: AttackCtx, through?: Point): { from: Point; to: Point; mark: Point } {
  const side = oneOf(ctx.rng, SIDES);
  const target = through ?? spotIn(ctx.rng, ctx.box, 10);
  const entry = onSide(ctx.box, side, between(ctx.rng, 0.2, 0.8));
  const dir = unit({ x: target.x - entry.x, y: target.y - entry.y });
  const t = throughBox(ctx.box, entry, dir);
  const out = t ? t.tOut : 200;
  const pad = 24;
  return {
    from: { x: entry.x - dir.x * pad, y: entry.y - dir.y * pad },
    to: { x: entry.x + dir.x * (out + pad), y: entry.y + dir.y * (out + pad) },
    mark: entry,
  };
}

export const SWOOP: AttackDef = {
  id: 'swoop',
  name: 'Swoop',
  kind: 'missile',
  movesAcross: true,
  start(ctx) {
    const n = E.swoop.count[rankOf(ctx)];
    const parts: SwoopPart[] = Array.from({ length: n }, (_, k) => {
      const aimed = k === n - 1 && rankOf(ctx) >= 2;
      const path = crossing(ctx, aimed ? ctx.pos : undefined);
      const warnAt = ctx.time + k * E.swoop.apartSec;
      return {
        kind: 'swoop',
        ...base(ctx, warnAt, warnAt + warnFor(E.swoop.warnSec)),
        ...path,
        speed: E.swoop.speed * ctx.speed,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const SWOOP_RULES: PartRules<SwoopPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const at = swoopAt(p, w.time);
    return [{ kind: 'circle', x: at.x, y: at.y, r: E.swoop.radius }];
  },
  done: (p, w) => w.time > p.activeAt && dist(swoopAt(p, w.time), p.from) >= dist(p.to, p.from),
};

// ── Feather Fall ───────────────────────────────────────────────────────────

/** Where a feather is now: falling, swaying side to side. */
export function featherAt(p: FeatherPart, time: number): Point {
  const t = Math.max(0, time - p.activeAt);
  return {
    x: p.x + E.feather.sway * Math.sin((2 * Math.PI * t) / E.feather.swaySec + p.phase),
    y: p.y0 + t * E.feather.speed,
  };
}

export const FEATHER_FALL: AttackDef = {
  id: 'featherFall',
  name: 'Feather Fall',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const e = edges(ctx.box);
    const n = E.feather.count[rankOf(ctx)];
    const parts: FeatherPart[] = Array.from({ length: n }, (_, k) => {
      const warnAt = ctx.time + (k * E.feather.spreadSec) / n;
      return {
        kind: 'feather',
        ...base(ctx, warnAt, warnAt + warnFor()),
        x: between(ctx.rng, e.left + 8, e.right - 8),
        y0: e.top - 6,
        phase: nextFloat(ctx.rng) * 2 * Math.PI,
        bottom: e.bottom + 8,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const FEATHER_RULES: PartRules<FeatherPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const at = featherAt(p, w.time);
    return [{ kind: 'circle', x: at.x, y: at.y, r: E.feather.radius }];
  },
  done: (p, w) => featherAt(p, w.time).y > p.bottom,
};

// ── Talon Drop ─────────────────────────────────────────────────────────────

export const TALON_DROP: AttackDef = {
  id: 'talonDrop',
  name: 'Talon Drop',
  kind: 'missile',
  claudesIdea: true,
  start(ctx) {
    const stopAt = ctx.time + E.talon.followSec;
    const part: TalonPart = {
      kind: 'talon',
      ...base(ctx, ctx.time, stopAt + warnFor(E.talon.strikeSec)),
      x: ctx.pos.x,
      y: ctx.pos.y,
      stopAt,
    };
    return { parts: [part], endsAt: 'parts' };
  },
};

const TALON_RULES: PartRules<TalonPart> = {
  // The shadow follows the sprite until it stops.
  update: (p, w) => (w.time < p.stopAt ? { part: { ...p, x: w.pos.x, y: w.pos.y } } : { part: p }),
  shapes: (p, w) =>
    w.time >= p.activeAt && w.time < p.activeAt + E.talon.showSec
      ? [{ kind: 'circle', x: p.x, y: p.y, r: E.talon.radius }]
      : [],
  done: (p, w) => w.time > p.activeAt + E.talon.showSec,
};

// ── Wing Gust ──────────────────────────────────────────────────────────────

export const WING_GUST: AttackDef = {
  id: 'wingGust',
  name: 'Wing Gust',
  kind: 'changer',
  claudesIdea: true,
  movesAcross: true,
  start(ctx) {
    const activeAt = ctx.time + warnFor(E.gust.warnSec);
    const part: GustPart = {
      kind: 'gust',
      ...base(ctx, ctx.time, activeAt),
      dir: coin(ctx.rng) ? 1 : -1,
      until: activeAt + E.gust.sec,
    };
    return { parts: [part], endsAt: part.until };
  },
};

const GUST_RULES: PartRules<GustPart> = {
  shapes: () => [],
  push: (p, w) =>
    w.time >= p.activeAt && w.time < p.until ? { x: p.dir * E.gust.push, y: 0 } : null,
  done: (p, w) => w.time > p.until,
};

// ── Hair Toss ──────────────────────────────────────────────────────────────

/** A point on a hair's curve, `u` from 0 to 1 (a quadratic curve). */
export function hairCurve(p: HairPart, u: number): Point {
  const a = (1 - u) * (1 - u);
  const b = 2 * u * (1 - u);
  const c = u * u;
  return {
    x: a * p.from.x + b * p.bend.x + c * p.to.x,
    y: a * p.from.y + b * p.bend.y + c * p.to.y,
  };
}

/** How long a hair's curve is (roughly). */
const curveLength = (p: HairPart) => {
  let len = 0;
  let last = p.from;
  for (let k = 1; k <= 16; k++) {
    const q = hairCurve(p, k / 16);
    len += dist(last, q);
    last = q;
  }
  return len;
};

/** Where a hair is now (and whether it's done its curve). */
export function hairAt(p: HairPart, time: number): { at: Point; end: boolean } {
  const u = (Math.max(0, time - p.activeAt) * p.speed) / Math.max(1, curveLength(p));
  return { at: hairCurve(p, Math.min(1, u)), end: u >= 1 };
}

export const HAIR_TOSS: AttackDef = {
  id: 'hairToss',
  name: 'Hair Toss',
  kind: 'missile',
  start(ctx) {
    const e = edges(ctx.box);
    const n = E.hair.count[ctx.level];
    const from = { x: ctx.box.cx, y: e.top - 8 };
    const parts: HairPart[] = Array.from({ length: n }, (_, k) => {
      // Aimed at the sprite, out the far side, bending one way or the other.
      const dir = unit({ x: ctx.pos.x - from.x, y: ctx.pos.y - from.y });
      const t = throughBox(ctx.box, from, dir);
      const reach = (t ? t.tOut : 120) + 20;
      const to = { x: from.x + dir.x * reach, y: from.y + dir.y * reach };
      const side = coin(ctx.rng) ? 1 : -1;
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const bend = {
        x: mid.x - dir.y * E.hair.curve * side,
        y: mid.y + dir.x * E.hair.curve * side,
      };
      const warnAt = ctx.time + k * E.hair.apartSec;
      return {
        kind: 'hair',
        ...base(ctx, warnAt, warnAt + warnFor()),
        from,
        bend,
        to,
        speed: E.hair.speed * ctx.speed,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

const HAIR_RULES: PartRules<HairPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const { at } = hairAt(p, w.time);
    return [{ kind: 'circle', x: at.x, y: at.y, r: E.hair.radius }];
  },
  done: (p, w) => w.time > p.activeAt && hairAt(p, w.time).end,
};

// ── Comb-Over ──────────────────────────────────────────────────────────────

/** Where the wall of hair is now (x), sweeping across from its side. */
export function combX(p: CombPart, box: Box, time: number): number {
  const e = edges(box);
  const d = Math.max(0, time - p.activeAt) * p.speed;
  return p.side === 'left' ? e.left - E.comb.thick + d : e.right + E.comb.thick - d;
}

export const COMB_OVER: AttackDef = {
  id: 'combOver',
  name: 'Comb-Over',
  kind: 'area',
  claudesIdea: true,
  movesAcross: true,
  start(ctx) {
    const e = edges(ctx.box);
    const part: CombPart = {
      kind: 'comb',
      ...base(ctx, ctx.time, ctx.time + warnFor(E.comb.warnSec)),
      side: coin(ctx.rng) ? 'left' : 'right',
      gapAt: between(ctx.rng, e.top + E.comb.gap, e.bottom - E.comb.gap),
      speed: E.comb.speed * ctx.speed,
    };
    return { parts: [part], endsAt: 'parts' };
  },
};

const COMB_RULES: PartRules<CombPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const e = edges(w.box);
    const x = combX(p, w.box, w.time) - E.comb.thick / 2;
    const g0 = p.gapAt - E.comb.gap / 2;
    const g1 = p.gapAt + E.comb.gap / 2;
    return [
      { kind: 'rect', x, y: e.top, w: E.comb.thick, h: g0 - e.top },
      { kind: 'rect', x, y: g1, w: E.comb.thick, h: e.bottom - g1 },
    ];
  },
  done: (p, w) => {
    const e = edges(w.box);
    const x = combX(p, w.box, w.time);
    return p.side === 'left' ? x > e.right + E.comb.thick : x < e.left - E.comb.thick;
  },
};

// ── Oil Barrels ────────────────────────────────────────────────────────────

export const OIL_BARRELS: AttackDef = {
  id: 'oilBarrels',
  name: 'Oil Barrels',
  kind: 'changer',
  start(ctx) {
    const n = E.oil.barrels[ctx.level];
    const taken: Point[] = [];
    const parts: BarrelPart[] = [];
    for (let k = 0; k < n; k++) {
      let spot = spotIn(ctx.rng, ctx.box, 14);
      for (
        let tries = 0;
        tries < 30 && taken.some((t) => dist(t, spot) < E.oil.puddle * 1.6);
        tries++
      )
        spot = spotIn(ctx.rng, ctx.box, 14);
      taken.push(spot);
      const warnAt = ctx.time + k * 0.2;
      const activeAt = warnAt + warnFor(E.oil.landSec);
      parts.push({
        kind: 'barrel',
        ...base(ctx, warnAt, activeAt),
        x: spot.x,
        y: spot.y,
        burstAt: activeAt + E.oil.fuseSec,
      });
    }
    return { parts, endsAt: Math.max(...parts.map((p) => p.burstAt)) };
  },
};

/** The fuse's number now (whole seconds left, at least 1), while it counts down. */
export const fuseLeft = (p: BarrelPart, time: number): number =>
  Math.max(1, Math.ceil(p.burstAt - time));

const BARREL_RULES: PartRules<BarrelPart> = {
  // It bursts and leaves its puddle.
  update(p, w) {
    if (p.burst || w.time < p.burstAt) return { part: p };
    const puddle: OilPart = {
      kind: 'oil',
      id: w.nextId(),
      round: p.round,
      warnAt: w.time,
      activeAt: w.time,
      child: true,
      x: p.x,
      y: p.y,
      r: E.oil.puddle,
      until: w.time + E.oil.puddleSec,
    };
    return { part: { ...p, burst: true }, spawn: [puddle] };
  },
  shapes: (p, w) =>
    w.time >= p.burstAt && w.time < p.burstAt + E.oil.burstShowSec
      ? [{ kind: 'circle', x: p.x, y: p.y, r: E.oil.burst }]
      : [],
  done: (p, w) => w.time > p.burstAt + E.oil.burstShowSec,
};

const OIL_RULES: PartRules<OilPart> = {
  shapes: () => [],
  slippery: (p, w) => (w.time < p.until ? [{ kind: 'circle', x: p.x, y: p.y, r: p.r }] : []),
  done: (p, w) => w.time > p.until,
};

// ── The library's pieces ───────────────────────────────────────────────────

export const EAGLE_ATTACKS: readonly AttackDef[] = [
  SWOOP,
  FEATHER_FALL,
  TALON_DROP,
  WING_GUST,
  HAIR_TOSS,
  COMB_OVER,
  OIL_BARRELS,
];

export const EAGLE_RULES: {
  [K in EaglePart['kind']]: PartRules<Extract<EaglePart, { kind: K }>>;
} = {
  swoop: SWOOP_RULES,
  feather: FEATHER_RULES,
  talon: TALON_RULES,
  gust: GUST_RULES,
  hair: HAIR_RULES,
  comb: COMB_RULES,
  barrel: BARREL_RULES,
  oil: OIL_RULES,
};

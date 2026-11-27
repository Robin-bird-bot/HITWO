/**
 * Bear with a Sword's sword attacks (docs/design/12-minigames-dodge.md,
 * section 6):
 *
 * - **Sword Volley** (22-minigame-revisions.md, section 5; it replaced the
 *   Sword sweep): swords appear one by one on the box's edges, numbered,
 *   with only their tips inside. After a warning they fly straight across
 *   in number order. A waiting sword doesn't hit.
 * - **Jab:** a thin lane shows, then the blade thrusts along it to the far
 *   wall, stays, and pulls back. Tier II: two in a row, and diagonal lanes.
 *   Tier III: a pair or a fan of three from one point.
 * - **Poke-up slide:** the sword slides just outside a wall and stabs in at
 *   every spot along it, each spot warned with a "!". Tier II: from the top
 *   or the bottom. Tier III: both at once, offset.
 * - **Wave:** the sword slides along the top wall, its blade dipping into
 *   the box and out again in a smooth wave; its path shows a moment ahead.
 *   Tier II: along either wall. Tier III: top and bottom at once, half a
 *   wave out of step, leaving a winding path between them.
 *
 * The bear's sword attacks sometimes bring a row of Claws with them (a
 * tweak in animals.ts; logic.ts adds the row). From Tier III any of the
 * bear's attacks can shrink the box for a few attacks (logic.ts).
 */
import { BALANCE } from '../../../config/balance';
import type { RngState } from '../../../engine/types';
import {
  between,
  coin,
  dist,
  DEG,
  edges,
  INWARD,
  onSide,
  oneOf,
  rayToWall,
  rotate,
  SIDES,
  type Box,
  type Side,
} from '../geometry';
import type { Point } from '../shapes';
import type {
  AttackCtx,
  AttackDef,
  JabPart,
  PartRules,
  PokePart,
  VolleyPart,
  WavePart,
} from '../types';
import { base, from, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const S = D.sword;

// ── Sword Volley ───────────────────────────────────────────────────────────

const V = D.volley;

/** Where a volley sword's tip is now: still until it flies, then straight across. */
export function volleyTip(p: VolleyPart, time: number): Point {
  const d = Math.max(0, time - p.activeAt) * p.speed;
  return { x: p.tip.x + p.dir.x * d, y: p.tip.y + p.dir.y * d };
}

/** How far a volley sword's tip goes before the whole sword is past the far wall. */
const volleyReach = (box: Box, side: Side): number =>
  (side === 'left' || side === 'right' ? box.w : box.h) - V.tipIn + V.length * 2;

/**
 * Spots on the box's edge for `n` swords: any side, at least `corner` from
 * a corner and `apart` from each other (as far as the box has room).
 */
export function volleySpots(rng: RngState, box: Box, n: number): { side: Side; at: Point }[] {
  const spots: { side: Side; at: Point }[] = [];
  for (let tries = 0; spots.length < n && tries < 400; tries++) {
    const side = oneOf(rng, SIDES);
    const len = side === 'left' || side === 'right' ? box.h : box.w;
    if (len <= 2 * V.corner) continue;
    const at = onSide(box, side, between(rng, V.corner, len - V.corner) / len);
    if (spots.some((o) => dist(o.at, at) < V.apart)) continue;
    spots.push({ side, at });
  }
  return spots;
}

export const VOLLEY: AttackDef = {
  id: 'volley',
  name: 'Sword Volley',
  kind: 'missile',
  start(ctx) {
    const spots = volleySpots(ctx.rng, ctx.box, V.swords[ctx.level]);
    // They appear one by one, warn after the last, then fly in number order.
    const lastAppears = ctx.time + (spots.length - 1) * V.appearSec;
    const firstFlies = lastAppears + warnFor(ctx, V.warnSec);
    const parts: VolleyPart[] = spots.map(({ side, at }, k) => {
      const dir = INWARD[side];
      return {
        kind: 'volley',
        ...base(ctx, ctx.time + k * V.appearSec, firstFlies + k * V.flyGapSec),
        n: k + 1,
        side,
        tip: { x: at.x + dir.x * V.tipIn, y: at.y + dir.y * V.tipIn },
        dir,
        speed: V.speed * ctx.speed,
        reach: volleyReach(ctx.box, side),
        // The next to fly shows its path: the first through the warning, then each after the one before flies.
        pathAt: k === 0 ? lastAppears : firstFlies + (k - 1) * V.flyGapSec,
      };
    });
    return { parts, endsAt: 'parts' };
  },
};

/** A flying sword hits as a short segment from its tip back; a waiting one doesn't hit. */
export const VOLLEY_RULES: PartRules<VolleyPart> = {
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const a = volleyTip(p, w.time);
    const b = { x: a.x - p.dir.x * V.length, y: a.y - p.dir.y * V.length };
    return [{ kind: 'segment', x1: a.x, y1: a.y, x2: b.x, y2: b.y, half: V.half }];
  },
  done: (p, w) => w.time >= p.activeAt + p.reach / p.speed,
};

// ── Jab ────────────────────────────────────────────────────────────────────

const J = D.jab;

/** How far the tip has gone along the lane (0 at the wall it comes from). */
export function jabDepth(p: JabPart, time: number): number {
  const t = time - p.activeAt;
  if (t <= 0) return 0;
  if (t < p.thrustSec) return (t / p.thrustSec) * p.reach;
  if (t < p.thrustSec + p.holdSec) return p.reach;
  const back = t - p.thrustSec - p.holdSec;
  return back < p.pullSec ? (1 - back / p.pullSec) * p.reach : 0;
}

/** The blade inside the box: from where it comes in to its tip. */
export function jabBlade(p: JabPart, time: number): [Point, Point] | null {
  const d = jabDepth(p, time);
  if (d <= 0) return null;
  const back = Math.max(0, d - S.blade);
  return [
    { x: p.from.x + p.dir.x * back, y: p.from.y + p.dir.y * back },
    { x: p.from.x + p.dir.x * d, y: p.from.y + p.dir.y * d },
  ];
}

function jab(ctx: AttackCtx, origin: Point, dir: Point, warnAt: number): JabPart {
  return {
    kind: 'jab',
    ...base(ctx, warnAt, warnAt + warnFor(ctx, J.warnSec)),
    from: origin,
    dir,
    reach: rayToWall(ctx.box, origin, dir),
    thrustSec: J.thrustSec,
    holdSec: J.holdSec,
    pullSec: J.pullSec,
  };
}

/** A lane from a wall: straight in, or (from Tier II) slanted. */
function lane(ctx: AttackCtx, side: Side, along: number, slanted: boolean): [Point, Point] {
  const origin = onSide(ctx.box, side, along);
  if (!slanted) return [origin, INWARD[side]];
  const angle = between(ctx.rng, J.diagonalDeg[0], J.diagonalDeg[1]) * DEG;
  // Slant toward the middle of the box, so the lane crosses it.
  const toMiddle = { x: ctx.box.cx - origin.x, y: ctx.box.cy - origin.y };
  const a = rotate(INWARD[side], angle);
  const b = rotate(INWARD[side], -angle);
  const dot = (v: Point) => v.x * toMiddle.x + v.y * toMiddle.y;
  return [origin, dot(a) >= dot(b) ? a : b];
}

export const JAB: AttackDef = {
  id: 'jab',
  name: 'Sword jab',
  kind: 'missile',
  start(ctx) {
    const slanted = () => from(ctx, J.diagonalFrom) && coin(ctx.rng);
    const fan = from(ctx, J.fanFrom) && coin(ctx.rng);
    if (fan) {
      // A fan from one point on a wall, all at once.
      const side = oneOf(ctx.rng, SIDES);
      const origin = onSide(ctx.box, side, between(ctx.rng, 0.3, 0.7));
      const parts = Array.from({ length: J.fanCount }, (_, k) => {
        const angle = (k - (J.fanCount - 1) / 2) * J.fanSpreadDeg * DEG;
        return jab(ctx, origin, rotate(INWARD[side], angle), ctx.time);
      });
      return { parts, endsAt: 'parts' };
    }
    const side = oneOf(ctx.rng, SIDES);
    const along = between(ctx.rng, 0.15, 0.85);
    const [o1, d1] = lane(ctx, side, along, slanted());
    const first = jab(ctx, o1, d1, ctx.time);
    if (!from(ctx, J.pairFrom)) return { parts: [first], endsAt: 'parts' };
    // A second one on a different lane, its lane showing as the first thrusts.
    const side2 = coin(ctx.rng) ? side : oneOf(ctx.rng, SIDES);
    let along2 = between(ctx.rng, 0.15, 0.85);
    if (side2 === side && Math.abs(along2 - along) < 0.3)
      along2 = along < 0.5 ? along + 0.4 : along - 0.4;
    const [o2, d2] = lane(ctx, side2, along2, slanted());
    return { parts: [first, jab(ctx, o2, d2, first.activeAt)], endsAt: 'parts' };
  },
};

export const JAB_RULES: PartRules<JabPart> = {
  shapes(p, w) {
    const blade = jabBlade(p, w.time);
    if (!blade) return [];
    const [a, b] = blade;
    return [{ kind: 'segment', x1: a.x, y1: a.y, x2: b.x, y2: b.y, half: S.bladeHalfWidth }];
  },
  done: (p, w) => w.time > p.activeAt + p.thrustSec + p.holdSec + p.pullSec,
};

// ── Poke-up slide ──────────────────────────────────────────────────────────

const P = D.poke;

/** Where the sliding sword is along its wall (x). */
export function pokeX(p: PokePart, time: number): number {
  const dir = p.spots.length > 1 ? Math.sign(p.spots[1]! - p.spots[0]!) || 1 : 1;
  if (time <= p.stabAt[0]!) return p.spots[0]! - dir * p.speed * (p.stabAt[0]! - time);
  for (let k = 0; k < p.spots.length; k++) {
    const end = p.stabAt[k]! + p.stabSec;
    if (time <= end) return p.spots[k]!;
    const next = p.stabAt[k + 1];
    if (next === undefined || time < next) return p.spots[k]! + dir * p.speed * (time - end);
  }
  return p.spots.at(-1)!;
}

/** How far the tip is in (units), and which stab it is. */
export function pokeDepth(p: PokePart, time: number): { depth: number; spot: number } | null {
  for (let k = 0; k < p.stabAt.length; k++) {
    const u = (time - p.stabAt[k]!) / p.stabSec;
    if (u < 0 || u > 1) continue;
    const up = u < 0.3 ? u / 0.3 : u < 0.7 ? 1 : (1 - u) / 0.3;
    return { depth: up * p.depth, spot: k };
  }
  return null;
}

function slide(
  ctx: AttackCtx,
  side: 'top' | 'bottom',
  offset: boolean,
  forward: boolean,
): PokePart {
  const box = ctx.box;
  const e = edges(box);
  const xs: number[] = [];
  for (
    let x = e.left + P.spacing * (offset ? 1 : 0.5);
    x < e.right - P.spacing / 4;
    x += P.spacing
  ) {
    xs.push(x);
  }
  const spots = forward ? xs : xs.reverse();
  const speed = P.slideSpeed * ctx.speed;
  const first = ctx.time + warnFor(ctx, Math.max(D.warnSec, P.markSec));
  const stabAt = spots.map((_, k) => first + k * (P.spacing / speed + P.stabSec));
  return {
    kind: 'poke',
    ...base(ctx, ctx.time, first),
    side,
    spots,
    stabAt,
    stabSec: P.stabSec,
    depth: P.depth * box.h,
    speed,
  };
}

export const POKE: AttackDef = {
  id: 'poke',
  name: 'Poke-up slide',
  kind: 'missile',
  start(ctx) {
    const forward = coin(ctx.rng);
    if (from(ctx, P.bothFrom)) {
      return {
        parts: [slide(ctx, 'bottom', false, forward), slide(ctx, 'top', true, forward)],
        endsAt: 'parts',
      };
    }
    const side = from(ctx, P.topFrom) && coin(ctx.rng) ? 'top' : 'bottom';
    return { parts: [slide(ctx, side, false, forward)], endsAt: 'parts' };
  },
};

export const POKE_RULES: PartRules<PokePart> = {
  shapes(p, w) {
    const stab = pokeDepth(p, w.time);
    if (!stab || stab.depth <= 0) return [];
    const e = edges(w.box);
    const x = p.spots[stab.spot]!;
    const wall = p.side === 'bottom' ? e.bottom : e.top;
    const tip = p.side === 'bottom' ? wall - stab.depth : wall + stab.depth;
    return [{ kind: 'segment', x1: x, y1: wall, x2: x, y2: tip, half: S.bladeHalfWidth }];
  },
  done: (p, w) => w.time > p.stabAt.at(-1)! + p.stabSec + 0.4,
};

// ── Wave ───────────────────────────────────────────────────────────────────

const W = D.wave;

/** How far the wave has slid in from the wall it started at, at a time (negative before it comes in). */
const waveRun = (p: WavePart, time: number): number => (time - p.activeAt) * p.speed;

/** How deep the blade is (units) after sliding `run` units in. */
export const waveDepth = (p: WavePart, box: Box, run: number): number =>
  ((p.depth * box.h) / 2) * (1 - Math.cos((2 * Math.PI * run) / p.wavelength + p.phase));

/** Where the sword is (x) after sliding `run` units in. */
export const waveX = (p: WavePart, box: Box, run: number): number => {
  const e = edges(box);
  return p.dir > 0 ? e.left + run : e.right - run;
};

/** The wall the wave slides along (y), and which way is into the box. */
export const waveWall = (p: WavePart, box: Box): { y: number; inward: 1 | -1 } => {
  const e = edges(box);
  return p.side === 'top' ? { y: e.top, inward: 1 } : { y: e.bottom, inward: -1 };
};

/** The sword now: where it is along the wall and how deep its tip is, or none while it's outside. */
export function waveAt(p: WavePart, box: Box, time: number): { x: number; depth: number } | null {
  const run = waveRun(p, time);
  if (run < 0 || run > box.w) return null;
  return { x: waveX(p, box, run), depth: waveDepth(p, box, run) };
}

/** The tip's path for the next `aheadSec` (from now, or from the wall before it comes in), as points. */
export function wavePath(p: WavePart, box: Box, time: number): Point[] {
  const a = Math.max(0, waveRun(p, time));
  const b = Math.min(box.w, waveRun(p, Math.max(time, p.activeAt) + p.aheadSec));
  if (b <= a) return [];
  const wall = waveWall(p, box);
  const n = Math.max(2, Math.ceil((b - a) / 3));
  return Array.from({ length: n + 1 }, (_, k) => {
    const run = a + ((b - a) * k) / n;
    return { x: waveX(p, box, run), y: wall.y + wall.inward * waveDepth(p, box, run) };
  });
}

function wave(ctx: AttackCtx, side: 'top' | 'bottom', dir: 1 | -1, phase: number): WavePart {
  return {
    kind: 'wave',
    ...base(ctx, ctx.time, ctx.time + warnFor(ctx, W.aheadSec)),
    side,
    dir,
    speed: W.speed * ctx.speed,
    depth: W.depth,
    wavelength: W.wavelength,
    phase,
    aheadSec: W.aheadSec,
  };
}

export const WAVE: AttackDef = {
  id: 'wave',
  name: 'Wave',
  kind: 'missile',
  start(ctx) {
    const dir = coin(ctx.rng) ? 1 : -1;
    if (from(ctx, W.bothFrom)) {
      // Top and bottom at once, half a wave out of step.
      return {
        parts: [wave(ctx, 'top', dir, 0), wave(ctx, 'bottom', dir, Math.PI)],
        endsAt: 'parts',
      };
    }
    const side = from(ctx, W.eitherFrom) && coin(ctx.rng) ? 'bottom' : 'top';
    return { parts: [wave(ctx, side, dir, 0)], endsAt: 'parts' };
  },
};

export const WAVE_RULES: PartRules<WavePart> = {
  shapes(p, w) {
    const at = waveAt(p, w.box, w.time);
    if (!at || at.depth < 0.5) return [];
    const wall = waveWall(p, w.box);
    return [
      {
        kind: 'segment',
        x1: at.x,
        y1: wall.y,
        x2: at.x,
        y2: wall.y + wall.inward * at.depth,
        half: S.bladeHalfWidth,
      },
    ];
  },
  done: (p, w) => waveRun(p, w.time) > w.box.w + 4,
};

export const SWORD_ATTACKS: readonly AttackDef[] = [VOLLEY, JAB, POKE, WAVE];

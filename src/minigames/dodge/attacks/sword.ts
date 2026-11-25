/**
 * Bear with a Sword's sword attacks (docs/design/12-minigames-dodge.md,
 * section 6):
 *
 * - **Sweep** (unchanged from step 3): the half about to be swept is
 *   hatched, then the blade sweeps it from straight down to flat sideways
 *   around a pivot above the box. Each swing warns a little less, never
 *   under the minimum. Tier II: sometimes a double swing. Tier III: the box
 *   sometimes shrinks for a few of the bear's attacks.
 * - **Jab:** a thin lane shows, then the blade thrusts along it to the far
 *   wall, stays, and pulls back. Tier II: two in a row, and diagonal lanes.
 *   Tier III: a pair or a fan of three from one point.
 * - **Poke-up slide:** the sword slides just outside a wall and stabs in at
 *   every spot along it, each spot warned with a "!". Tier II: from the top
 *   or the bottom. Tier III: both at once, offset.
 */
import { BALANCE } from '../../../config/balance';
import { nextFloat } from '../../../engine/rng';
import type { RngState } from '../../../engine/types';
import {
  between,
  coin,
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
  DodgeState,
  JabPart,
  PartRules,
  PokePart,
  SwingPart,
} from '../types';
import { base, from, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const S = D.sword;

// ── Sweep ──────────────────────────────────────────────────────────────────

/** The warning before a swing: it starts long and gets shorter each swing, never under the minimum. */
export const swingWarnSec = (swings: number): number =>
  Math.max(S.warnMinSec, D.warnMinSec, S.warnStartSec * (1 - S.warnShrink) ** swings);

export const swingSweepSec = (swings: number): number =>
  Math.max(S.sweepMinSec, S.sweepSec * (1 - S.sweepShrink) ** swings);

/** One side, or the other at random, never the same side more than twice in a row. */
function pickSide(s: DodgeState, rng: RngState): 'left' | 'right' {
  const [a, b] = s.sides.slice(-2);
  if (a && a === b) return a === 'left' ? 'right' : 'left';
  return nextFloat(rng) < 0.5 ? 'left' : 'right';
}

/** The pivot the sword turns around, above the middle of the box. */
export const swordPivot = (box: Box): Point => ({
  x: box.cx,
  y: box.cy - box.h / 2 - S.pivotAbove,
});

/**
 * The blade's angle from pointing straight down, toward the swing's side:
 * 0 at the start of the sweep, 90° (flat sideways) at the end.
 */
export function swingAngle(sw: SwingPart, time: number): number | null {
  if (time < sw.activeAt || time > sw.activeAt + sw.sweepSec) return null;
  return ((time - sw.activeAt) / sw.sweepSec) * (Math.PI / 2);
}

/** The blade, from the pivot, at an angle on a side. */
export function bladeAt(box: Box, side: 'left' | 'right', angle: number): [Point, Point] {
  const p = swordPivot(box);
  const sx = side === 'right' ? 1 : -1;
  return [p, { x: p.x + sx * Math.sin(angle) * S.blade, y: p.y + Math.cos(angle) * S.blade }];
}

export const SWEEP: AttackDef = {
  id: 'sweep',
  name: 'Sword sweep',
  start(ctx) {
    const s = ctx.state;
    const side = pickSide(s, ctx.rng);
    const warn = swingWarnSec(s.swings);
    const sweep = swingSweepSec(s.swings);
    const first: SwingPart = {
      kind: 'swing',
      ...base(ctx, ctx.time, ctx.time + warn),
      side,
      sweepSec: sweep,
    };
    const parts = [first];
    const sides = [side];
    if (from(ctx, S.doubleFrom) && nextFloat(ctx.rng) < S.doubleChance) {
      // Straight back across the other half; its warning shows from the first sweep on.
      const other = side === 'left' ? 'right' : 'left';
      parts.push({
        kind: 'swing',
        ...base(ctx, first.activeAt, first.activeAt + sweep + S.doubleGapSec),
        side: other,
        sweepSec: sweep,
      });
      sides.push(other);
    }
    const shrink =
      from(ctx, S.shrinkFrom) && s.shrunkFor <= 0 && nextFloat(ctx.rng) < S.shrinkChance;
    return {
      parts,
      endsAt: Math.max(...parts.map((p) => p.activeAt + p.sweepSec)),
      patch: {
        swings: s.swings + parts.length,
        sides: [...s.sides, ...sides].slice(-4),
        ...(shrink ? { shrunkFor: S.shrinkSwings } : {}),
      },
    };
  },
};

export const SWING_RULES: PartRules<SwingPart> = {
  shapes(p, w) {
    const angle = swingAngle(p, w.time);
    if (angle === null) return [];
    const [a, b] = bladeAt(w.box, p.side, angle);
    return [{ kind: 'segment', x1: a.x, y1: a.y, x2: b.x, y2: b.y, half: S.bladeHalfWidth }];
  },
  done: (p, w) => w.time > p.activeAt + p.sweepSec + 0.05,
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
    ...base(ctx, warnAt, warnAt + warnFor(J.warnSec)),
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
  const first = ctx.time + warnFor(Math.max(D.warnSec, P.markSec));
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

export const SWORD_ATTACKS: readonly AttackDef[] = [SWEEP, JAB, POKE];

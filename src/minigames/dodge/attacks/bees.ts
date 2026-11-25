/**
 * Bees (docs/design/12-minigames-dodge.md, section 5), as five attacks in
 * the library: Lane, Cross, Diagonal and Zigzag (Tier II and up), and Aimed
 * (Tier III). Each bee shows a "!" at its entry edge before it flies in;
 * bees leave the box on the far side and are gone. Unchanged from step 3.
 */
import { BALANCE } from '../../../config/balance';
import { int, nextFloat } from '../../../engine/rng';
import type { RngState } from '../../../engine/types';
import { edges, SIDES, type Box, type Side } from '../geometry';
import type { Point } from '../shapes';
import type { AttackCtx, AttackDef, AttackStart, BeePart, PartRules } from '../types';
import { warnFor } from './common';

const D = BALANCE.minigames.dodge;

/** A bee entering from a side at a place along it (0 to 1), flying straight across. */
function laneBee(
  ctx: AttackCtx,
  box: Box,
  side: Side,
  along: number,
  warnAt: number,
  speed: number,
): BeePart {
  const e = edges(box);
  const out = 6;
  const across = { left: [1, 0], right: [-1, 0], top: [0, 1], bottom: [0, -1] }[side];
  const x =
    side === 'left' ? e.left - out : side === 'right' ? e.right + out : e.left + along * box.w;
  const y =
    side === 'top' ? e.top - out : side === 'bottom' ? e.bottom + out : e.top + along * box.h;
  const mark = {
    x: side === 'left' ? e.left - 5 : side === 'right' ? e.right + 5 : x,
    y: side === 'top' ? e.top - 5 : side === 'bottom' ? e.bottom + 5 : y,
  };
  return {
    kind: 'bee',
    id: ctx.nextId(),
    round: ctx.round,
    x,
    y,
    vx: across[0]! * speed,
    vy: across[1]! * speed,
    warnAt,
    activeAt: warnAt + warnFor(),
    mark,
  };
}

/** Lanes across the box with one gap lane. */
function laneWave(
  ctx: AttackCtx,
  rng: RngState,
  side: Side,
  bees: number,
  at: number,
  speed: number,
): BeePart[] {
  const lanes = bees + 1;
  const gap = int(rng, 0, lanes - 1);
  const out: BeePart[] = [];
  for (let k = 0; k < lanes; k++) {
    if (k === gap) continue;
    out.push(laneBee(ctx, ctx.box, side, (k + 0.5) / lanes, at, speed));
  }
  return out;
}

/** The next round starts the tier's gap after the last bee sets off (as in step 3). */
const wave = (bees: BeePart[]): AttackStart => ({
  parts: bees,
  endsAt: Math.max(...bees.map((b) => b.activeAt)),
});

const beeSpeed = (ctx: AttackCtx) => D.bees.speed * ctx.speed;

export const LANE: AttackDef = {
  id: 'lane',
  name: 'Lane',
  start(ctx) {
    const side = SIDES[int(ctx.rng, 0, 3)]!;
    const n = int(ctx.rng, D.bees.lane[0], D.bees.lane[1]);
    return wave(laneWave(ctx, ctx.rng, side, n, ctx.time, beeSpeed(ctx)));
  },
};

export const CROSS: AttackDef = {
  id: 'cross',
  name: 'Cross',
  start(ctx) {
    const a = laneWave(
      ctx,
      ctx.rng,
      'left',
      int(ctx.rng, D.bees.cross[0], D.bees.cross[1]),
      ctx.time,
      beeSpeed(ctx),
    );
    const c = laneWave(
      ctx,
      ctx.rng,
      'top',
      int(ctx.rng, D.bees.cross[0], D.bees.cross[1]),
      ctx.time,
      beeSpeed(ctx),
    );
    return wave([...a, ...c]);
  },
};

export const DIAGONAL: AttackDef = {
  id: 'diagonal',
  name: 'Diagonal',
  start(ctx) {
    // From a corner to the opposite one, in a staggered line across the path.
    const b = ctx.box;
    const speed = beeSpeed(ctx);
    const dx = nextFloat(ctx.rng) < 0.5 ? 1 : -1;
    const dy = nextFloat(ctx.rng) < 0.5 ? 1 : -1;
    const corner = { x: b.cx - (dx * b.w) / 2 - dx * 6, y: b.cy - (dy * b.h) / 2 - dy * 6 };
    const dir = { x: dx / Math.SQRT2, y: dy / Math.SQRT2 };
    const perp = { x: -dir.y, y: dir.x };
    const n = D.bees.diagonal.bees;
    return wave(
      Array.from({ length: n }, (_, k) => {
        const off = (k - (n - 1) / 2) * D.bees.diagonal.spacing;
        const x = corner.x + perp.x * off;
        const y = corner.y + perp.y * off;
        const warnAt = ctx.time + k * D.bees.diagonal.staggerSec;
        return {
          kind: 'bee' as const,
          id: ctx.nextId(),
          round: ctx.round,
          x,
          y,
          vx: dir.x * speed,
          vy: dir.y * speed,
          warnAt,
          activeAt: warnAt + warnFor(),
          mark: { x: x + dir.x * 3, y: y + dir.y * 3 },
        };
      }),
    );
  },
};

export const ZIGZAG: AttackDef = {
  id: 'zigzag',
  name: 'Zigzag',
  start(ctx) {
    const side: Side = nextFloat(ctx.rng) < 0.5 ? 'left' : 'right';
    const n = D.bees.zigzag.bees;
    return wave(
      Array.from({ length: n }, (_, k) => ({
        ...laneBee(ctx, ctx.box, side, (k + 1) / (n + 1), ctx.time, beeSpeed(ctx) * 0.8),
        weave: {
          amplitude: D.bees.zigzag.amplitude / 2,
          perSec: D.bees.zigzag.perSec,
          nx: 0,
          ny: 1,
        },
      })),
    );
  },
};

export const AIMED: AttackDef = {
  id: 'aimed',
  name: 'Aimed',
  start(ctx) {
    // From random edge points, aimed at the sprite when each launches.
    const n = D.bees.aimed.bees;
    const speed = beeSpeed(ctx);
    return wave(
      Array.from({ length: n }, (_, k) => {
        const side = SIDES[int(ctx.rng, 0, 3)]!;
        const bee = laneBee(
          ctx,
          ctx.box,
          side,
          0.1 + nextFloat(ctx.rng) * 0.8,
          ctx.time + k * D.bees.aimed.staggerSec,
          speed,
        );
        return { ...bee, aimSpeed: speed };
      }),
    );
  },
};

export const BEE_ATTACKS: readonly AttackDef[] = [LANE, CROSS, DIAGONAL, ZIGZAG, AIMED];

/** Where a bee is now (it flies once its warning is over). */
export function beeAt(bee: BeePart, time: number): Point {
  const t = Math.max(0, time - bee.activeAt);
  let x = bee.x + bee.vx * t;
  let y = bee.y + bee.vy * t;
  if (bee.weave) {
    const w = Math.sin(2 * Math.PI * bee.weave.perSec * t) * bee.weave.amplitude;
    x += bee.weave.nx * w;
    y += bee.weave.ny * w;
  }
  return { x, y };
}

export const BEE_RULES: PartRules<BeePart> = {
  update(p, w) {
    // An aimed bee aims at the sprite as it launches.
    if (!p.aimSpeed || p.aimed || w.time < p.activeAt) return { part: p };
    const dx = w.pos.x - p.x;
    const dy = w.pos.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    return {
      part: { ...p, vx: (dx / d) * p.aimSpeed, vy: (dy / d) * p.aimSpeed, aimed: true },
    };
  },
  shapes(p, w) {
    if (w.time < p.activeAt) return [];
    const at = beeAt(p, w.time);
    return [{ kind: 'circle', x: at.x, y: at.y, r: D.bees.radius }];
  },
  done(p, w) {
    // Gone once it has flown out of the box (it starts just outside, flying in).
    if (w.time - p.activeAt <= 0.3) return false;
    const at = beeAt(p, w.time);
    return (
      Math.abs(at.x - w.box.cx) > w.box.w / 2 + 12 || Math.abs(at.y - w.box.cy) > w.box.h / 2 + 12
    );
  },
};

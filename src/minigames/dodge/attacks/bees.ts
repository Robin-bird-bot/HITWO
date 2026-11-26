/**
 * Bees (docs/design/12-minigames-dodge.md, section 5), as attacks in the
 * library. Which ones play goes by level (balance `bees.levels`), since bees
 * are the Tier I animal and have to start easiest:
 * - **Easy:** One at a time (aimed, slow, well apart) and Pairs.
 * - **Level 1:** One at a time (closer together) and a small staggered Lane.
 * - **Level 2:** Lane, Cross (both staggered) and Zigzag.
 * - **Level 3:** full rows (Lane and Cross with every bee at once), Diagonal
 *   and the Aimed swarm.
 *
 * Each bee shows a "!" where it'll come into the box before it flies in;
 * bees leave the box on the far side and are gone.
 */
import { BALANCE } from '../../../config/balance';
import { int, nextFloat } from '../../../engine/rng';
import type { RngState } from '../../../engine/types';
import { between, edges, entryMark, SIDES, type Box, type Side } from '../geometry';
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

/**
 * Lanes across the box with one gap lane, each bee starting at its own
 * delay up to `stagger` (a full row, all at once, when it's 0).
 */
function laneWave(
  ctx: AttackCtx,
  rng: RngState,
  side: Side,
  bees: number,
  at: number,
  speed: number,
  stagger: number,
): BeePart[] {
  const lanes = bees + 1;
  const gap = int(rng, 0, lanes - 1);
  const out: BeePart[] = [];
  for (let k = 0; k < lanes; k++) {
    if (k === gap) continue;
    const delay = stagger > 0 ? between(rng, 0, stagger) : 0;
    out.push(laneBee(ctx, ctx.box, side, (k + 0.5) / lanes, at + delay, speed));
  }
  return out;
}

/** A bee from a random edge point, aimed at the sprite as it launches. */
function aimedBee(ctx: AttackCtx, warnAt: number, speed: number): BeePart {
  const side = SIDES[int(ctx.rng, 0, 3)]!;
  const bee = laneBee(ctx, ctx.box, side, 0.1 + nextFloat(ctx.rng) * 0.8, warnAt, speed);
  return { ...bee, aimSpeed: speed };
}

/** The level's Lane numbers (Easy uses Level 1's). */
const laneOf = (ctx: AttackCtx) => D.bees.lane[ctx.level];

/**
 * The next round starts the level's gap after the last bee sets off (as in
 * step 3). Prepare's Smoky Fire takes bees off the end of every wave (one
 * always comes).
 */
const wave = (ctx: AttackCtx, all: BeePart[]): AttackStart => {
  const bees = all.slice(0, Math.max(1, all.length - (ctx.state.fewerBees ?? 0)));
  return { parts: bees, endsAt: Math.max(...bees.map((b) => b.activeAt)) };
};

const beeSpeed = (ctx: AttackCtx) => D.bees.speed * ctx.speed;

export const SINGLE: AttackDef = {
  id: 'single',
  name: 'One at a time',
  kind: 'missile',
  start(ctx) {
    // One by one from random edge points, each aimed at the sprite; slower on Easy.
    const S = D.bees.single;
    const n = int(ctx.rng, S.bees[0], S.bees[1]);
    const every = ctx.easy ? S.everySec[0] : S.everySec[1];
    const speed = ctx.easy ? S.easySpeed : beeSpeed(ctx);
    return wave(
      ctx,
      Array.from({ length: n }, (_, k) => aimedBee(ctx, ctx.time + k * every, speed)),
    );
  },
};

export const PAIRS: AttackDef = {
  id: 'pairs',
  name: 'Pairs',
  kind: 'missile',
  start(ctx) {
    // Two bees from one side in lanes far apart, one after the other.
    const P = D.bees.pairs;
    const side = SIDES[int(ctx.rng, 0, 3)]!;
    const first = between(ctx.rng, 0.15, 0.85 - P.apart);
    const lanes = nextFloat(ctx.rng) < 0.5 ? [first, first + P.apart] : [first + P.apart, first];
    return wave(
      ctx,
      lanes.map((along, k) =>
        laneBee(ctx, ctx.box, side, along, ctx.time + k * P.everySec, beeSpeed(ctx)),
      ),
    );
  },
};

export const LANE: AttackDef = {
  id: 'lane',
  name: 'Lane',
  kind: 'missile',
  start(ctx) {
    // Staggered below Level 3; a full row at Level 3.
    const L = laneOf(ctx);
    const side = SIDES[int(ctx.rng, 0, 3)]!;
    const n = int(ctx.rng, L.bees[0], L.bees[1]);
    return wave(ctx, laneWave(ctx, ctx.rng, side, n, ctx.time, beeSpeed(ctx), L.staggerSec));
  },
};

export const CROSS: AttackDef = {
  id: 'cross',
  name: 'Cross',
  kind: 'missile',
  start(ctx) {
    // Staggered as a Lane at Level 2; full rows at Level 3.
    const stagger = laneOf(ctx).staggerSec;
    const row = (side: Side) =>
      laneWave(
        ctx,
        ctx.rng,
        side,
        int(ctx.rng, D.bees.cross[0], D.bees.cross[1]),
        ctx.time,
        beeSpeed(ctx),
        stagger,
      );
    return wave(ctx, [...row('left'), ...row('top')]);
  },
};

export const DIAGONAL: AttackDef = {
  id: 'diagonal',
  name: 'Diagonal',
  kind: 'missile',
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
      ctx,
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
          // Where this bee's own path comes into the box (the line is wide, so not all at the corner).
          mark: entryMark(b, { x, y }, dir),
        };
      }),
    );
  },
};

export const ZIGZAG: AttackDef = {
  id: 'zigzag',
  name: 'Zigzag',
  kind: 'missile',
  start(ctx) {
    const side: Side = nextFloat(ctx.rng) < 0.5 ? 'left' : 'right';
    const n = D.bees.zigzag.bees;
    return wave(
      ctx,
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
  name: 'Aimed swarm',
  kind: 'missile',
  start(ctx) {
    // All at once from random edge points, each aimed at the sprite.
    const speed = beeSpeed(ctx);
    return wave(
      ctx,
      Array.from({ length: D.bees.aimed.bees }, () => aimedBee(ctx, ctx.time, speed)),
    );
  },
};

export const BEE_ATTACKS: readonly AttackDef[] = [
  SINGLE,
  PAIRS,
  LANE,
  CROSS,
  DIAGONAL,
  ZIGZAG,
  AIMED,
];

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
    // Gone once it has flown out of the box and is heading away (it starts outside, flying in).
    if (w.time - p.activeAt <= 0.3) return false;
    const at = beeAt(p, w.time);
    const dx = at.x - w.box.cx;
    const dy = at.y - w.box.cy;
    const away = dx * p.vx + dy * p.vy > 0;
    return away && (Math.abs(dx) > w.box.w / 2 + 12 || Math.abs(dy) > w.box.h / 2 + 12);
  },
};

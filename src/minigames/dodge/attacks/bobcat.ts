/**
 * Pounce (Bobcat; docs/design/12-minigames-dodge.md, section 6): a shadow
 * grows where the bobcat will land, and the sprite is hit if it's in the
 * shadow at the landing. Tier I: on a random third of the box. Tier II and
 * up: centered on the sprite, two in a row. Tier III: sometimes a feint,
 * the first shadow fading and the real one showing just before landing.
 */
import { BALANCE } from '../../../config/balance';
import { int } from '../../../engine/rng';
import { coin, edges } from '../geometry';
import type { Point } from '../shapes';
import type { AttackCtx, AttackDef, PartRules, PouncePart } from '../types';
import { base, from, warnFor } from './common';

const D = BALANCE.minigames.dodge;
const P = D.pounce;

export function pounce(
  ctx: AttackCtx,
  at: Point | null,
  warnAt: number,
  activeAt: number,
): PouncePart {
  const [w, h] = P.shadow;
  return {
    kind: 'pounce',
    ...base(ctx, warnAt, activeAt),
    cx: at?.x ?? ctx.box.cx,
    cy: at?.y ?? ctx.box.cy,
    rx: w / 2,
    ry: h / 2,
    ...(at ? {} : { aimPending: true as const }),
    dustSec: P.dustSec,
  };
}

/** How big the shadow is (0 to 1) as it grows, or as a feint fades (1 to 0). */
export function shadowSize(p: PouncePart, time: number): number {
  if (time < p.warnAt) return 0;
  const u = Math.min(1, (time - p.warnAt) / Math.max(0.01, p.activeAt - p.warnAt));
  return 0.25 + 0.75 * u;
}

export const POUNCE: AttackDef = {
  id: 'pounce',
  name: 'Pounce',
  start(ctx) {
    const grow = warnFor(P.growSec);
    const t = ctx.time;
    if (!from(ctx, P.aimedFrom)) {
      // A random third of the box.
      const e = edges(ctx.box);
      const k = int(ctx.rng, 0, 2);
      return {
        parts: [
          pounce(ctx, { x: e.left + (ctx.box.w * (k + 0.5)) / 3, y: ctx.box.cy }, t, t + grow),
        ],
        endsAt: 'parts',
      };
    }
    if (from(ctx, P.feintFrom) && coin(ctx.rng)) {
      // The first shadow fades; the real one shows just before landing, where the sprite is then.
      const decoy = { ...pounce(ctx, { ...ctx.pos }, t, t + grow), feint: true as const };
      const real = pounce(ctx, null, decoy.activeAt - warnFor(P.feintRealSec), decoy.activeAt);
      return { parts: [decoy, real], endsAt: 'parts' };
    }
    const first = pounce(ctx, { ...ctx.pos }, t, t + grow);
    if (!from(ctx, P.twoFrom)) return { parts: [first], endsAt: 'parts' };
    const second = pounce(ctx, null, first.activeAt, first.activeAt + grow);
    return { parts: [first, second], endsAt: 'parts' };
  },
};

export const POUNCE_RULES: PartRules<PouncePart> = {
  update(p, w) {
    if (!p.aimPending || w.time < p.warnAt) return { part: p };
    const part: PouncePart = { ...p, cx: w.pos.x, cy: w.pos.y };
    delete part.aimPending;
    return { part };
  },
  shapes(p, w, t0) {
    // Only at the landing, and never for a feint.
    if (p.feint || !(t0 < p.activeAt && p.activeAt <= w.time)) return [];
    return [{ kind: 'ellipse', cx: p.cx, cy: p.cy, rx: p.rx, ry: p.ry }];
  },
  done: (p, w) => w.time > p.activeAt + p.dustSec,
};

export const BOBCAT_ATTACKS: readonly AttackDef[] = [POUNCE];

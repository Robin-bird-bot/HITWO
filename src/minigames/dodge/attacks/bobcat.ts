/**
 * The bobcat's attacks (docs/design/12-minigames-dodge.md, section 6):
 *
 * - **Pounce:** a shadow grows where the bobcat will land, and the sprite is
 *   hit if it's in the shadow at the landing. Tier I: on a random third of
 *   the box. Tier II and up: centered on the sprite, two in a row. Tier III:
 *   sometimes a feint, the first shadow fading and the real one showing
 *   just before landing.
 * - **Stalk:** it comes in at an edge, then hops at the sprite 3 or 4 times.
 *   Before each hop an aim line and the landing spot show (aimed where the
 *   sprite is then); it hops, lands, crouches; after the last landing it
 *   leaves through the nearest wall. It hits during each hop.
 */
import { BALANCE } from '../../../config/balance';
import { int } from '../../../engine/rng';
import { between, coin, edges, onSide, oneOf, SIDES, type Box } from '../geometry';
import type { Point, Shape } from '../shapes';
import type { AttackCtx, AttackDef, PartRules, PouncePart, StalkPart } from '../types';
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
  kind: 'missile',
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

// ── Stalk ──────────────────────────────────────────────────────────────────

const K = D.stalk;

/** A spot the bobcat can land on: inside the box, with room for itself. */
function landing(box: Box, p: Point): Point {
  const e = edges(box);
  const m = K.radius;
  return {
    x: Math.min(e.right - m, Math.max(e.left + m, p.x)),
    y: Math.min(e.bottom - m, Math.max(e.top + m, p.y)),
  };
}

/** Where the bobcat is at a time, and whether it's mid-hop (when it can hit). */
export function stalkAt(p: StalkPart, time: number): { at: Point; hopping: boolean } {
  let here = p.start;
  for (const h of p.hops) {
    if (time < h.hopAt || !h.to) return { at: here, hopping: false };
    if (time <= h.landAt) {
      const u = (time - h.hopAt) / (h.landAt - h.hopAt);
      return {
        at: { x: here.x + (h.to.x - here.x) * u, y: here.y + (h.to.y - here.y) * u },
        hopping: true,
      };
    }
    here = h.to;
  }
  if (time < p.leaveAt || !p.exit) return { at: here, hopping: false };
  const u = Math.min(1, (time - p.leaveAt) / p.leaveSec);
  return {
    at: { x: here.x + (p.exit.x - here.x) * u, y: here.y + (p.exit.y - here.y) * u },
    hopping: false,
  };
}

/** Where a hop starts: the spot before it. */
export const hopFrom = (p: StalkPart, k: number): Point =>
  (k === 0 ? p.start : p.hops[k - 1]!.to) ?? p.start;

export const STALK: AttackDef = {
  id: 'stalk',
  name: 'Stalk',
  kind: 'missile',
  start(ctx) {
    // The aim shows a little shorter on faster tiers, never under the minimum.
    const aim = warnFor(K.aimSec / ctx.speed);
    const side = oneOf(ctx.rng, SIDES);
    const start = landing(ctx.box, onSide(ctx.box, side, between(ctx.rng, 0.2, 0.8)));
    const hops = Array.from({ length: K.hops[ctx.tier] }, (_, k) => {
      const aimAt = ctx.time + k * (aim + K.hopSec + K.crouchSec);
      return { aimAt, hopAt: aimAt + aim, landAt: aimAt + aim + K.hopSec };
    });
    const last = hops.at(-1)!;
    return {
      parts: [
        {
          kind: 'stalk',
          ...base(ctx, ctx.time, hops[0]!.hopAt),
          start,
          hops,
          leaveAt: last.landAt + K.crouchSec,
          leaveSec: K.leaveSec,
        },
      ],
      endsAt: 'parts',
    };
  },
};

export const STALK_RULES: PartRules<StalkPart> = {
  update(p, w) {
    // Each hop aims where the sprite is when its aim shows; it leaves through the nearest wall.
    const k = p.hops.findIndex((h) => !h.to && w.time >= h.aimAt);
    if (k >= 0) {
      const hops = p.hops.map((h, i) => (i === k ? { ...h, to: landing(w.box, w.pos) } : h));
      return { part: { ...p, hops } };
    }
    if (!p.exit && w.time >= p.leaveAt) {
      const at = stalkAt(p, w.time).at;
      const e = edges(w.box);
      const out = K.radius + 4;
      const ways = [
        { d: at.x - e.left, exit: { x: e.left - out, y: at.y } },
        { d: e.right - at.x, exit: { x: e.right + out, y: at.y } },
        { d: at.y - e.top, exit: { x: at.x, y: e.top - out } },
        { d: e.bottom - at.y, exit: { x: at.x, y: e.bottom + out } },
      ];
      const nearest = ways.reduce((a, b) => (b.d < a.d ? b : a));
      return { part: { ...p, exit: nearest.exit } };
    }
    return { part: p };
  },
  shapes(p, w, t0) {
    // During each hop, landing included.
    const hop = p.hops.find((h) => h.to && t0 < h.landAt && w.time >= h.hopAt);
    if (!hop) return [];
    const at = stalkAt(p, Math.min(w.time, hop.landAt)).at;
    return [{ kind: 'circle', x: at.x, y: at.y, r: K.radius } satisfies Shape];
  },
  done: (p, w) => w.time > p.leaveAt + p.leaveSec,
};

export const BOBCAT_ATTACKS: readonly AttackDef[] = [POUNCE, STALK];

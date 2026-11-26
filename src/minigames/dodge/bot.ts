/**
 * Dodge's demo bot (docs/design/20-challenge-popup.md, section 7; the
 * prototype's version, generalized): every [0.12–0.22 s] it looks a moment
 * ahead (the game stepped on with the sprite standing still), scores spots
 * in the box by how near every hit shape is, and steers to the safest one
 * near it. Now and then it hesitates, so the demo shows hits too.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { edges } from './geometry';
import { blocksNow, effectiveBox, hitShapes, step, type DodgeState } from './logic';
import { touches, type Point, type Shape } from './shapes';

type Memory = { at?: number; target?: Point; idleUntil?: number } & Record<string, unknown>;

/** How near a shape is to a point (0 inside, then in steps of 3 units up to 18). */
function nearness(shape: Shape, p: Point): number {
  for (let r = 0; r <= 18; r += 3) if (touches(shape, p, r)) return r;
  return 24;
}

/** The danger at a point: every hit shape, nearer is worse. */
const danger = (shapes: readonly Shape[], p: Point): number =>
  shapes.reduce((sum, sh) => sum + Math.exp(-nearness(sh, p) / 11), 0);

export function dodgeBot(
  s: DodgeState,
  memo: Record<string, unknown>,
  rng: RngState,
  time: number,
): Point | null {
  const mem = memo as Memory;
  if (s.over) return { x: 0, y: 0 };
  if (mem.idleUntil !== undefined && time < mem.idleUntil) return { x: 0, y: 0 };
  if (mem.at === undefined || time >= mem.at) {
    mem.at = time + 0.12 + nextFloat(rng) * 0.1;
    // Sometimes it hesitates for a moment.
    if (nextFloat(rng) < 0.18) {
      mem.idleUntil = time + 0.15 + nextFloat(rng) * 0.2;
      return { x: 0, y: 0 };
    }
    // A moment ahead: the game stepped on with the sprite still.
    let ahead = s;
    const shapes: Shape[] = [...hitShapes(s, 0.15)];
    for (let k = 0; k < 18 && !ahead.over; k++) {
      ahead = step(ahead, 1 / 60, { x: 0, y: 0 });
      if (k % 6 === 5) shapes.push(...hitShapes(ahead, 0.15));
    }
    const box = effectiveBox(s);
    const e = edges(box);
    const blocks = blocksNow(s);
    let best: Point = s.pos;
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 7; j++) {
        const p = {
          x: e.left + 8 + ((box.w - 16) * i) / 8,
          y: e.top + 8 + ((box.h - 16) * j) / 6,
        };
        if (blocks.some((b) => Math.hypot(p.x - b.x, p.y - b.y) < b.r + 6)) continue;
        // Danger first; then not too far, and not hugging the walls.
        const far = Math.hypot(p.x - s.pos.x, p.y - s.pos.y) / 200;
        const edge =
          Math.min(p.x - e.left, e.right - p.x, p.y - e.top, e.bottom - p.y) < 12 ? 0.05 : 0;
        const score = danger(shapes, p) + far + edge;
        if (score < bestScore) {
          bestScore = score;
          best = p;
        }
      }
    }
    mem.target = best;
  }
  const t = mem.target ?? s.pos;
  const dx = t.x - s.pos.x;
  const dy = t.y - s.pos.y;
  const d = Math.hypot(dx, dy);
  return d < 2 ? { x: 0, y: 0 } : { x: dx / d, y: dy / d };
}

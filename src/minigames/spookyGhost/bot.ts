/**
 * Spooky Ghost!'s demo bot (24-challenges-reset.md, section 6): it sweeps
 * the light toward the nearest mitten it hasn't found and taps it once it's
 * lit. When a ghost shows up close to the light, it turns away from it, a
 * bit late ([0.35 s]), then heads back for the mitten.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { ghostOpacity, lit, type Point, type SpookyGhostState } from './logic';

const G = BALANCE.minigames.spookyGhost;

export type SpookyAction = { kind: 'move'; to: Point } | { kind: 'tap'; at: Point };

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function spookyGhostBot(
  s: SpookyGhostState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): SpookyAction | null {
  if (s.over) return null;
  const last = (mem.last as number | undefined) ?? time;
  mem.last = time;
  const dt = Math.min(0.1, Math.max(0, time - last));
  const target = [...s.mittens].sort((a, b) => dist(a, s.light) - dist(b, s.light))[0];
  if (!target) return null;

  // Lit and close: tap it.
  if (dist(target, s.light) <= G.tapReach - 2 && lit(s, target)) {
    return { kind: 'tap', at: { x: target.x, y: target.y } };
  }

  // A ghost close to the light: after a moment, steer away from it.
  const ghost = s.ghosts.find(
    (g) => ghostOpacity(g, s.time) > 0.3 && dist(g, s.light) <= G.ghostNear + 10 && lit(s, g),
  );
  if (ghost) {
    const seen = (mem.seen as number | undefined) ?? time;
    mem.seen = seen;
    if (time - seen >= G.bot.lateSec) {
      const d = Math.max(1, dist(ghost, s.light));
      const step = G.bot.speed * dt;
      return {
        kind: 'move',
        to: {
          x: s.light.x + ((s.light.x - ghost.x) / d) * step,
          y: s.light.y + ((s.light.y - ghost.y) / d) * step,
        },
      };
    }
  } else {
    delete mem.seen;
  }

  // Sweep toward the mitten, with a little wobble.
  const d = dist(target, s.light);
  const step = Math.min(d, G.bot.speed * dt);
  const wobble = (nextFloat(rng) - 0.5) * 2;
  return {
    kind: 'move',
    to: {
      x: s.light.x + ((target.x - s.light.x) / Math.max(1, d)) * step + wobble,
      y: s.light.y + ((target.y - s.light.y) / Math.max(1, d)) * step + wobble,
    },
  };
}

/**
 * Fly Swatter's demo bot (docs/design/20-challenge-popup.md, section 7): it
 * taps the fly circles in the order they came, after a short look, missing
 * one now and then; it leaves the bees alone.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { FlySwatterState } from './logic';

export function flySwatterBot(
  s: FlySwatterState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): { x: number; y: number } | null {
  if (s.over) return null;
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  const target = s.circles.filter((c) => !c.bee).sort((a, b) => a.bornAt - b.bornAt)[0];
  if (!target) return null;
  if (s.turnTime - target.bornAt < 0.35) return null;
  mem.next = time + 0.25 + nextFloat(rng) * 0.15;
  // Now and then it misses by a bit.
  const off = nextFloat(rng) < 0.15 ? 18 : 0;
  return { x: target.x + off, y: target.y + off };
}

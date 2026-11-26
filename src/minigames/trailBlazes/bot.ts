/**
 * Trail Blazes' demo bot (docs/design/20-challenge-popup.md, section 7): it
 * taps as the lit pair comes level, a little off sometimes (early, or too
 * late so the pair passes).
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { isLevel, litGap, type TrailBlazesState } from './logic';

export function trailBlazesBot(
  s: TrailBlazesState,
  mem: Record<string, unknown>,
  rng: RngState,
): 'tap' | null {
  if (s.over) return null;
  const gap = litGap(s);
  if (gap === null) return null;
  // A new pair: decide whether this one goes right.
  if (Math.abs(gap) > s.level * 3) {
    mem.armed = true;
    mem.early = nextFloat(rng) < 0.15;
    return null;
  }
  if (!mem.armed) return null;
  if (isLevel(s) || (mem.early && Math.abs(gap) < s.level * 2)) {
    mem.armed = false;
    return 'tap';
  }
  return null;
}

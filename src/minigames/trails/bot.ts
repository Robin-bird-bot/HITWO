/**
 * Trails' demo bot (docs/design/20-challenge-popup.md, section 7): it aims
 * at the trail's middle a little ahead, with a lag and a wobble, so it
 * drifts off now and then.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { middleAt } from './course';
import type { TrailsState } from './logic';

export function trailsBot(
  s: TrailsState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): number | null {
  if (s.over) return null;
  const next = (mem.next as number | undefined) ?? 0;
  if (time < next) return null;
  mem.next = time + 0.12 + nextFloat(rng) * 0.1;
  // Now and then it lets its aim wander for a moment.
  if (nextFloat(rng) < 0.08) mem.wobble = (nextFloat(rng) * 2 - 1) * 26;
  else if (nextFloat(rng) < 0.3) mem.wobble = 0;
  return middleAt(s.course, s.d + 14) + ((mem.wobble as number | undefined) ?? 0);
}

/**
 * Sleeping Bear's demo bot (docs/design/20-challenge-popup.md, section 7):
 * it sneaks while he sleeps and stops when he stirs, sometimes a little late.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { SleepingBearState } from './logic';

export function sleepingBearBot(
  s: SleepingBearState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): boolean {
  if (s.over) return false;
  if (s.bear !== 'asleep') {
    // The stir: it stops, now and then a beat late.
    if (mem.stirAt === undefined) {
      mem.stirAt = time;
      mem.late = nextFloat(rng) < 0.2 ? 0.25 + nextFloat(rng) * 0.25 : 0;
    }
    return time - (mem.stirAt as number) < (mem.late as number);
  }
  mem.stirAt = undefined;
  return true;
}

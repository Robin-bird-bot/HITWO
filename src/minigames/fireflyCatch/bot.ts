/**
 * Firefly Catch's demo bot (docs/design/20-challenge-popup.md, section 7):
 * it taps when the firefly is near the ring's middle, and now and then a
 * little too early.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { FireflyState } from './logic';

export function fireflyBot(
  s: FireflyState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): 'tap' | null {
  if (s.over) return null;
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  const d = Math.hypot(s.fly.x - s.ringAt.x, s.fly.y - s.ringAt.y);
  const early = nextFloat(rng) < 0.004;
  if (d <= s.ring * 0.25 || (early && d <= s.ring * 0.9)) {
    mem.next = time + 0.5;
    return 'tap';
  }
  return null;
}

/**
 * Whackoon's demo bot (docs/design/20-challenge-popup.md, section 7): it
 * whacks raccoons as they pop up, after a short reaction delay, and now and
 * then a skunk by mistake.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { WhackoonState } from './logic';

export function whackoonBot(
  s: WhackoonState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): number | null {
  if (s.over) return null;
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  const live = s.cans
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c && s.time >= c.upAt + 0.25 && s.time < c.until);
  const pick =
    nextFloat(rng) < 0.06
      ? live.find(({ c }) => c?.kind !== 'raccoon')
      : live.find(({ c }) => c?.kind === 'raccoon');
  if (!pick) return null;
  mem.next = time + 0.3 + nextFloat(rng) * 0.2;
  return pick.i;
}

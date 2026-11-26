/**
 * Rafting's demo bot (docs/design/20-challenge-popup.md, section 7): it
 * looks ahead in its lane and slides to a free one when a rock is coming,
 * clipping one now and then.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import type { RaftingState } from './logic';

export function raftingBot(
  s: RaftingState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): -1 | 1 | null {
  if (s.over || s.slide) return null;
  const next = (mem.next as number | undefined) ?? 0;
  if (time < next) return null;
  mem.next = time + 0.15;
  const ahead = s.pace * 1.1;
  const rockIn = (lane: number) =>
    s.things.some(
      (t) =>
        t.kind === 'rock' &&
        !t.done &&
        lane >= t.lane &&
        lane < t.lane + t.lanes &&
        t.at > s.traveled - 10 &&
        t.at < s.traveled + ahead,
    );
  if (!rockIn(s.lane)) return null;
  // Sometimes it reacts too late.
  if (nextFloat(rng) < 0.12) {
    mem.next = time + 0.6;
    return null;
  }
  for (const dir of [-1, 1] as const) {
    const to = s.lane + dir;
    if (to >= 0 && to < s.lanes && !rockIn(to)) return dir;
  }
  return null;
}

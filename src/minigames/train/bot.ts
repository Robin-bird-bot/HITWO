/**
 * Train!'s demo bot (docs/design/20-challenge-popup.md, section 7): it moves
 * toward the nearest track with no train and no warning on it, and now and
 * then waits a moment too long.
 */
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { spriteTrack, type TrainState } from './logic';

export function trainBot(
  s: TrainState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): -1 | 1 | null {
  if (s.over || s.hop) return null;
  const next = (mem.next as number | undefined) ?? 0;
  if (time < next) return null;
  mem.next = time + 0.15 + (nextFloat(rng) < 0.15 ? 0.5 : 0);
  const busy = (track: number) =>
    s.trains.some((t) => t.track === track && s.time >= t.warnAt - 0.2 && s.time < t.leaveAt + 0.1);
  const here = spriteTrack(s);
  if (!busy(here)) return null;
  for (let k = 1; k < s.tracks; k++) {
    for (const dir of [-1, 1] as const) {
      const t = here + dir * k;
      if (t >= 0 && t < s.tracks && !busy(t)) return dir;
    }
  }
  return null;
}

/**
 * Falling Rocks' demo bot (23-minigames-final.md, section 2): it walks,
 * stops short of a growing shadow (or backs out from under one), and runs
 * for the nearest overhang when a boulder rumbles. It reacts a beat late,
 * and now and then too late. It returns the direction to walk, only when
 * that changes.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { playing } from '../quick/turns';
import { halfOf, underOverhang, type FallingRocksState } from './logic';

const F = BALANCE.minigames.fallingRocks;

export function fallingRocksBot(
  s: FallingRocksState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): -1 | 0 | 1 | null {
  if (s.over || !playing(s.turns)) return null;
  // It looks again every so often (a beat late, sometimes later).
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  mem.next = time + (nextFloat(rng) < 0.1 ? 0.45 : 0.15);
  let want: -1 | 0 | 1 = 1;
  // A boulder: get under the nearest overhang and wait there.
  if (s.hazards.some((h) => h.kind === 'boulder')) {
    const nearest = F.overhangs.reduce((a, b) =>
      Math.abs(b.x - s.x) < Math.abs(a.x - s.x) ? b : a,
    );
    want =
      underOverhang(s.x) && Math.abs(s.x - nearest.x) < nearest.half - 3
        ? 0
        : s.x < nearest.x
          ? 1
          : -1;
  } else {
    // Rocks about to land near where it is or is heading: stop, or back out from under.
    for (const h of s.hazards) {
      if (h.kind !== 'rock' || h.landed) continue;
      const reach = halfOf(h.size) + 6;
      const soon = h.landAt - s.time;
      const ahead = h.x - s.x;
      if (Math.abs(ahead) <= reach) want = ahead >= 0 ? -1 : 1;
      else if (ahead > 0 && ahead <= reach + F.walk * soon && want === 1) want = 0;
    }
  }
  if (want === s.dir) return null;
  return want;
}

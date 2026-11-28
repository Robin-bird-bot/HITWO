/**
 * Fallen Branch's demo bot (docs/design/30-quick-minigames.md, section 3): it
 * strokes at the zone's middle tempo, give or take a little, slips now and
 * then, and slows for a knot a moment late.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { knotNow, zoneNow, type FallenBranchState, type SawKey } from './logic';

const F = BALANCE.minigames.fallenBranch;
const BOT = F.bot;

export function fallenBranchBot(
  s: FallenBranchState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): SawKey | null {
  if (s.over) return null;
  // It notices a knot a moment late.
  const knot = knotNow(s);
  if (knot && mem.knot !== knot.at) {
    mem.knot = knot.at;
    mem.knotSeen = time + BOT.knotLateSec;
  }
  if (time < ((mem.next as number | undefined) ?? 0)) return null;
  const [lo, hi] = zoneNow(s);
  const late = knot && time < (mem.knotSeen as number);
  const mid = (lo + hi) / 2 - (late ? F.knot.slowerSec : 0);
  mem.next = time + mid * (1 + (nextFloat(rng) * 2 - 1) * BOT.jitter);
  const other: SawKey = s.lastKey === 'a' ? 'd' : 'a';
  if (s.lastKey && nextFloat(rng) < BOT.slipChance) return s.lastKey;
  return other;
}

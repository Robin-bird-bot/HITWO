/**
 * Rock Climb's demo bot (22-minigame-revisions.md, section 2): it waits
 * for the arrow to point at the next hold of its color (or straight up at
 * the top line on the last move), holds for about the right power, and
 * grabs that hold during the jump. It misjudges now and then, so the demo
 * shows a fall too.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { aimNow, nextHold, onLastMove, powerNow, type RockClimbState } from './logic';

const R = BALANCE.minigames.rockClimb;

export type ClimbAction = { kind: 'press' } | { kind: 'release' } | { kind: 'grab'; hold: number };

/** Where the next move should go: the next path hold, or above the top line. */
function target(s: RockClimbState): { x: number; h: number; hold: number | null } {
  if (onLastMove(s)) return { x: s.at.x, h: s.topH + 12, hold: null };
  const h = nextHold(s);
  return h ? { x: h.x, h: h.h, hold: h.id } : { x: s.at.x, h: s.at.h + 60, hold: null };
}

export function rockClimbBot(
  s: RockClimbState,
  mem: Record<string, unknown>,
  rng: RngState,
): ClimbAction | null {
  if (s.over) return null;
  // A new move: decide how far off it'll be this time (mostly close; now and then a miss).
  if (mem.move !== s.moves || mem.phaseAt === undefined) {
    const miss = nextFloat(rng) < 0.15;
    mem.move = s.moves;
    mem.aimErr = (nextFloat(rng) * 2 - 1) * (miss ? 18 : 4);
    mem.powErr = (nextFloat(rng) * 2 - 1) * (miss ? 0.2 : 0.04);
    mem.phaseAt = s.phaseAt;
  }
  const t = target(s);
  const dx = t.x - s.at.x;
  const dh = t.h - s.at.h;
  if (s.phase === 'aim') {
    const want = (Math.atan2(dh, dx) * 180) / Math.PI + (mem.aimErr as number);
    return Math.abs(aimNow(s) - want) < 4 ? { kind: 'press' } : null;
  }
  if (s.phase === 'power') {
    const [lo, hi] = R.power;
    const dist = Math.hypot(dx, dh);
    const want = Math.max(0, Math.min(1, (dist - lo) / (hi - lo) + (mem.powErr as number)));
    return Math.abs(powerNow(s) - want) < 0.04 ? { kind: 'release' } : null;
  }
  if (s.phase === 'jump' && s.jump && t.hold !== null && s.jump.queued == null) {
    return { kind: 'grab', hold: t.hold };
  }
  return null;
}

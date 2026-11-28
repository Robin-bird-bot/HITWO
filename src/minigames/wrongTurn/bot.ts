/**
 * Wrong Turn's demo bot (docs/design/30-quick-minigames.md, section 2): it
 * reads the bearing, turns toward the notch, lets go a little early (where
 * it thinks the needle will coast to, misjudging a little), and corrects.
 * Now and then it overshoots and comes back. Once the notch hides, it aims
 * by the dial's marks, a few degrees off, and tries again a little to the
 * side when nothing fills.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { bearingNow, notchHidden, turnTo, wobbleAt, type Turn, type WrongTurnState } from './logic';

const W = BALANCE.minigames.wrongTurn;
const BOT = W.bot;

const span = (rng: RngState, [a, b]: readonly [number, number]) => a + nextFloat(rng) * (b - a);

export function wrongTurnBot(
  s: WrongTurnState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): Turn | null {
  const b = bearingNow(s);
  if (s.over || s.flash > 0 || b === null) return s.turn !== 0 ? 0 : null;
  // A new bearing: read it, and decide whether this time it overshoots.
  if (mem.at !== s.at) {
    mem.at = s.at;
    mem.next = time + span(rng, BOT.readSec);
    const by = nextFloat(rng) < BOT.overshootChance ? span(rng, BOT.overshootDeg) : 0;
    mem.past = by * Math.sign(turnTo(s.needle, b) || 1);
    mem.off = 0;
    mem.stuck = 0;
  }
  if (time < (mem.next as number)) return null;
  mem.next = time + BOT.everySec;
  // Once the notch hides, it aims by the dial's marks, a little off; when
  // nothing fills for a while, it tries a little to the side.
  if (notchHidden(s)) {
    if (mem.off === 0) mem.off = span(rng, [-BOT.hiddenOffDeg, BOT.hiddenOffDeg]);
    mem.stuck = s.hold > 0 ? 0 : (mem.stuck as number) + BOT.everySec;
    if ((mem.stuck as number) > BOT.retrySec) {
      mem.off = span(rng, [-BOT.hiddenOffDeg, BOT.hiddenOffDeg]);
      mem.stuck = 0;
    }
  }
  const past = mem.past as number;
  const target = b + past + (mem.off as number);
  if (past !== 0 && Math.abs(turnTo(s.needle, target)) < s.notchDeg) mem.past = 0;
  // Where it thinks the needle will settle if it lets go now.
  const judge = 1 + span(rng, [-BOT.misjudge, BOT.misjudge]);
  const rest = s.aim + s.aimSpeed * W.needle.coastSec * judge + wobbleAt(s);
  const err = turnTo(rest, target);
  if (Math.abs(err) <= s.notchDeg * BOT.inside) return s.turn !== 0 ? 0 : null;
  const want: Turn = err > 0 ? 1 : -1;
  return want === s.turn ? null : want;
}

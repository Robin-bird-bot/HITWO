/**
 * Incoming Bike!'s demo bot (docs/design/30-quick-minigames.md, section 1):
 * it presses the right key a moment after it shows, and now and then the
 * wrong one. It leaves crossed-out bikes alone.
 */
import { BALANCE } from '../../config/balance';
import { nextFloat } from '../../engine/rng';
import type { RngState } from '../../engine/types';
import { playing } from '../quick/turns';
import { onTrail, stumbling, type BikeState } from './logic';

const BOT = BALANCE.minigames.incomingBike.bot;

export function incomingBikeBot(
  s: BikeState,
  mem: Record<string, unknown>,
  rng: RngState,
  time: number,
): string | null {
  if (s.over || !playing(s.turns) || stumbling(s)) return null;
  const bike = onTrail(s)
    .filter((b) => !b.crossed)
    .sort((a, b) => a.closeAt - b.closeAt)[0];
  if (!bike) return null;
  // A new key to press: when to press it, and whether it'll be the wrong one.
  const on = `${bike.id}:${bike.done}`;
  if (mem.on !== on) {
    const [a, b] = BOT.reactSec;
    mem.on = on;
    mem.at = time + a + nextFloat(rng) * (b - a);
    mem.wrong = nextFloat(rng) < BOT.wrongChance;
  }
  if (time < (mem.at as number)) return null;
  mem.at = Infinity;
  const want = bike.signs[bike.done]!;
  if (!mem.wrong) return want;
  const others = s.signs.filter((k) => k !== want);
  return others[Math.floor(nextFloat(rng) * others.length)] ?? want;
}
